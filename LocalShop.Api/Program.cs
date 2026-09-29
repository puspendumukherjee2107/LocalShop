using System.Text;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://*:{port}");
}
else if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://0.0.0.0:5000");
}

var (dbProvider, dbConnectionString) = GetDatabaseConfiguration(builder.Configuration);

builder.Services.AddDbContext<StoreDbContext>(options =>
{
    if (dbProvider == "PostgreSQL")
    {
        options.UseNpgsql(dbConnectionString, npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        });
    }
    else
    {
        options.UseSqlite(dbConnectionString);
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("MobileAppPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var jwtKey = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_KEY") ?? builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
{
    if (builder.Environment.IsProduction())
    {
        throw new InvalidOperationException("CRITICAL CONFIGURATION ERROR: A secure JWT signing key must be set via the LOCALSHOP_JWT_KEY environment variable in production.");
    }
    jwtKey = "LocalShop-Dev-Strict-Key-2026-Secure-Random!";
}
else if (builder.Environment.IsProduction() && (jwtKey.Contains("Replace-In-Production") || jwtKey.Contains("Change-In-Production") || jwtKey.Length < 32))
{
    throw new InvalidOperationException("CRITICAL SECURITY ERROR: The configured JWT signing key is insecure or uses default placeholder text.");
}

var jwtIssuer = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_ISSUER") ?? builder.Configuration["Jwt:Issuer"] ?? "LocalShop.Api";
var jwtAudience = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_AUDIENCE") ?? builder.Configuration["Jwt:Audience"] ?? "LocalShop.Mobile";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.FromMinutes(2)
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 5;
    });
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("MobileAppPolicy");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
    try
    {
        EnsureLegacySqliteSchemaAligned(db);
        db.Database.Migrate();
        Console.WriteLine($"[DB] Database schema migrated successfully on provider: {db.Database.ProviderName}");
    }
    catch (Exception ex)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"[DB Critical Error] Database migration failed on provider '{db.Database.ProviderName}': {ex.Message}");
        Console.ResetColor();
        throw; // Do not catch and call EnsureCreated(). Fail loudly so schema issues are visible.
    }

    if (db.Database.IsSqlite() && !app.Environment.IsDevelopment())
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("[DB Warning] Running with local SQLite in non-development environment.");
        Console.WriteLine("[DB Warning] Cloud Run instances have ephemeral filesystems and do not share disk across instances.");
        Console.WriteLine("[DB Warning] Set DATABASE_URL or POSTGRES_CONNECTION_STRING to connect to Cloud SQL / PostgreSQL for durable, multi-instance data persistence.");
        Console.ResetColor();
    }

    var allowDemoSeeding = app.Environment.IsDevelopment() || 
                           app.Configuration.GetValue<bool>("EnableDemoSeeding", false) ||
                           string.Equals(Environment.GetEnvironmentVariable("ALLOW_DEMO_SEEDING"), "true", StringComparison.OrdinalIgnoreCase);
    if (allowDemoSeeding)
    {
        SeedDemoAccounts(app.Services);
    }
}

app.MapControllers();
app.MapHub<LocalShop.Api.Hubs.OrderHub>("/hubs/orders");
app.Run();

static (string provider, string connectionString) GetDatabaseConfiguration(IConfiguration config)
{
    var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    if (!string.IsNullOrWhiteSpace(dbUrl))
    {
        return ("PostgreSQL", ConvertPostgresUriToConnectionString(dbUrl));
    }

    var pgConn = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");
    if (!string.IsNullOrWhiteSpace(pgConn))
    {
        return ("PostgreSQL", pgConn);
    }

    var defaultConn = config.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrWhiteSpace(defaultConn) && 
        (defaultConn.Contains("Host=", StringComparison.OrdinalIgnoreCase) || 
         defaultConn.Contains("Server=", StringComparison.OrdinalIgnoreCase) ||
         defaultConn.StartsWith("postgres", StringComparison.OrdinalIgnoreCase)))
    {
        return ("PostgreSQL", defaultConn.StartsWith("postgres", StringComparison.OrdinalIgnoreCase) 
            ? ConvertPostgresUriToConnectionString(defaultConn) 
            : defaultConn);
    }

    var customSqlitePath = Environment.GetEnvironmentVariable("DATABASE_PATH") ?? Environment.GetEnvironmentVariable("SQLITE_PATH");
    if (!string.IsNullOrWhiteSpace(customSqlitePath))
    {
        return ("Sqlite", $"Data Source={customSqlitePath};Default Timeout=30;");
    }

    var sqliteConn = defaultConn;
    if (string.IsNullOrWhiteSpace(sqliteConn))
    {
        sqliteConn = "Data Source=LocalStore.db;Default Timeout=30;";
    }

    return ("Sqlite", sqliteConn);
}

static string ConvertPostgresUriToConnectionString(string uriString)
{
    if (uriString.StartsWith("Host=", StringComparison.OrdinalIgnoreCase) || 
        uriString.StartsWith("Server=", StringComparison.OrdinalIgnoreCase))
    {
        return uriString;
    }

    try
    {
        var uri = new Uri(uriString);
        var userInfo = uri.UserInfo.Split(':');
        var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var database = uri.AbsolutePath.TrimStart('/');
        var port = uri.Port > 0 ? uri.Port : 5432;

        return $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Prefer;Trust Server Certificate=true;";
    }
    catch
    {
        return uriString;
    }
}

static void EnsureLegacySqliteSchemaAligned(StoreDbContext db)
{
    if (!db.Database.IsSqlite()) return;

    var connection = db.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
    {
        connection.Open();
    }

    try
    {
        using var pragmaCmd = connection.CreateCommand();
        pragmaCmd.CommandText = "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;";
        pragmaCmd.ExecuteNonQuery();
    }
    catch { }

    try
    {
        using var checkTableCmd = connection.CreateCommand();
        checkTableCmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Users';";
        var usersTableExists = Convert.ToInt64(checkTableCmd.ExecuteScalar() ?? 0) > 0;

        if (usersTableExists)
        {
            using var createHistCmd = connection.CreateCommand();
            createHistCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                    ""MigrationId"" TEXT NOT NULL CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY,
                    ""ProductVersion"" TEXT NOT NULL
                );
            ";
            createHistCmd.ExecuteNonQuery();

            using var checkColCmd = connection.CreateCommand();
            checkColCmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info('Users') WHERE name = 'FailedLoginAttempts';";
            var hasColumn = Convert.ToInt64(checkColCmd.ExecuteScalar() ?? 0) > 0;

            if (hasColumn)
            {
                using var markCmd = connection.CreateCommand();
                markCmd.CommandText = @"
                    INSERT OR IGNORE INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                    VALUES ('20260929171523_SyncCurrentSchema', '10.0.9');
                ";
                markCmd.ExecuteNonQuery();
            }
        }
    }
    catch { }
}

static void SeedDemoAccounts(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();

    EnsureDemoUser(db, "Customer", "9876543210", "Turja Mukherjee", "Customer@2026!", "Flat 4B, Greenfield Apartments");
    EnsureDemoUser(db, "Admin", "superadmin", "System Admin", "Admin@2026!", "Head Office");
    EnsureDemoUser(db, "Merchant", "9876500000", "Tarama Stores", "Merchant@2026!", "Main Market");
    EnsureDemoUser(db, "Delivery", "delivery001", "Rohan Das", "Delivery@2026!", "City Hub");

    db.SaveChanges();

    // Migrate any existing records with the legacy Kirana Junction shop name
    try
    {
        db.Database.ExecuteSqlRaw("UPDATE \"Orders\" SET \"ShopName\" = 'Tarama Stores' WHERE \"ShopName\" = 'Kirana Junction';");
        db.Database.ExecuteSqlRaw("UPDATE \"StoreProfiles\" SET \"ShopName\" = 'Tarama Stores' WHERE \"ShopName\" = 'Kirana Junction';");
        db.Database.ExecuteSqlRaw("UPDATE \"Staff\" SET \"ShopName\" = 'Tarama Stores' WHERE \"ShopName\" = 'Kirana Junction';");
        db.Database.ExecuteSqlRaw("UPDATE \"Settlements\" SET \"ShopName\" = 'Tarama Stores' WHERE \"ShopName\" = 'Kirana Junction';");
    }
    catch { }
}

static void EnsureDemoUser(StoreDbContext db, string role, string phone, string name, string password, string address)
{
    var user = db.Users.FirstOrDefault(u => u.Role == role && u.Phone == phone);
    if (user == null)
    {
        db.Users.Add(new User
        {
            Name = name,
            Phone = phone,
            PasswordHash = PasswordHasher.HashPassword(password),
            Role = role,
            Address = address,
            Status = "Active"
        });
        return;
    }

    // Do NOT overwrite existing user's password, status, or details on restart
}