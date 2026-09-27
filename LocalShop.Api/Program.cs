using System.Text;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<StoreDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("MobileAppPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:8081",
                "http://127.0.0.1:8081",
                "http://localhost:8082",
                "http://127.0.0.1:8082",
                "http://localhost:19006",
                "http://localhost:3000",
                "http://127.0.0.1:19006",
                "http://127.0.0.1:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var jwtKey = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_KEY") ?? builder.Configuration["Jwt:Key"] ?? "LocalShop-Dev-Key-Replace-In-Production-2026!";
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
});

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
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

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
    db.Database.ExecuteSqlRaw("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    EnsureUserSecurityColumns(db);
}
catch (Exception ex)
{
    Console.WriteLine($"[DB Note] Startup lock: {ex.Message}");
}

SeedDemoAccounts(app.Services);

app.MapControllers().RequireRateLimiting("auth");
app.MapHub<LocalShop.Api.Hubs.OrderHub>("/hubs/orders");
app.Urls.Add("http://*:5000");

app.Run();

static void EnsureUserSecurityColumns(StoreDbContext db)
{
    var connection = db.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
    {
        connection.Open();
    }

    using var command = connection.CreateCommand();
    command.CommandText = "PRAGMA table_info('Users');";

    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using var reader = command.ExecuteReader();
    while (reader.Read())
    {
        var columnName = reader.GetString(1);
        columns.Add(columnName);
    }

    if (!columns.Contains("FailedLoginAttempts"))
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ADD COLUMN \"FailedLoginAttempts\" INTEGER NOT NULL DEFAULT 0;");
    }

    if (!columns.Contains("LockoutUntilUtc"))
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ADD COLUMN \"LockoutUntilUtc\" TEXT NULL;");
    }
}

static void SeedDemoAccounts(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();

    EnsureDemoUser(db, "Customer", "9876543210", "Demo Customer", "Customer@2026!", "Downtown Residency");
    EnsureDemoUser(db, "Admin", "superadmin", "System Admin", "Admin@2026!", "Head Office");
    EnsureDemoUser(db, "Merchant", "9876500000", "Kirana Junction", "Merchant@2026!", "Main Market");
    EnsureDemoUser(db, "Delivery", "delivery001", "Rohan Das", "Delivery@2026!", "City Hub");

    db.SaveChanges();
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

    user.Name = name;
    user.PasswordHash = PasswordHasher.HashPassword(password);
    user.Address = address;
    user.Status = "Active";
    user.Role = role;
}