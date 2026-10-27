using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Security;
using Xunit;

namespace LocalShop.Api.Tests;

public class StoreDomainAndSecurityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly StoreDbContext _context;

    public StoreDomainAndSecurityTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<StoreDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new StoreDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void PasswordHasher_ShouldGenerateSecureUniquePbkdf2Hashes()
    {
        var password = "CustomerSecure2026!";
        var hash1 = PasswordHasher.HashPassword(password);
        var hash2 = PasswordHasher.HashPassword(password);

        Assert.StartsWith("pbkdf2$", hash1);
        Assert.StartsWith("pbkdf2$", hash2);
        // Salt should ensure two hashes of same password are distinct
        Assert.NotEqual(hash1, hash2);

        // Both must verify successfully
        Assert.True(PasswordHasher.VerifyPassword(password, hash1));
        Assert.True(PasswordHasher.VerifyPassword(password, hash2));
    }

    [Fact]
    public void PasswordHasher_ShouldRejectWrongPassword()
    {
        var password = "MerchantSecure2026!";
        var hash = PasswordHasher.HashPassword(password);

        Assert.False(PasswordHasher.VerifyPassword("WrongPassword!", hash));
        Assert.False(PasswordHasher.VerifyPassword("", hash));
        Assert.False(PasswordHasher.VerifyPassword(password, "invalid_hash_string"));
    }

    [Fact]
    public async Task StoreProfile_ShouldCreateAndPersistCorrectly()
    {
        var store = new StoreProfile
        {
            ShopName = "Tarama Stores",
            OwnerName = "Tarama Stores",
            Phone = "9876500000",
            Category = "Groceries & Daily Essentials",
            IsOpen = true,
            OperatingHours = "08:00 AM - 09:30 PM",
            DeliveryRadiusKm = 3.5,
            MinOrderAmount = 100m,
            TradeLicense = "TRD-992817",
            KycStatus = "Approved"
        };

        _context.StoreProfiles.Add(store);
        await _context.SaveChangesAsync();

        var retrieved = await _context.StoreProfiles.FirstOrDefaultAsync(s => s.ShopName == "Tarama Stores");
        Assert.NotNull(retrieved);
        Assert.True(retrieved.IsOpen);
        Assert.Equal(100m, retrieved.MinOrderAmount);
        Assert.Equal("9876500000", retrieved.Phone);
    }

    [Fact]
    public async Task OrderWorkflow_CustomListToQuotedToApproved_ShouldSucceed()
    {
        // 1. Customer creates custom list order
        var order = new Order
        {
            Id = "ORD-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant(),
            CustomerName = "Turja Mukherjee",
            CustomerPhone = "9876543210",
            ShopName = "Tarama Stores",
            ItemsText = "1x Basmati Rice (1kg)\n2x Mustard Oil (1L)",
            ItemsCount = 2,
            TotalAmount = 0,
            Status = "QuoteRequested",
            OrderType = "CustomList",
            DeliveryOtp = "4821",
            CreatedAt = DateTime.UtcNow
        };

        order.Items.Add(new OrderItem { ProductName = "Basmati Rice (1kg)", Quantity = 1, UnitPrice = 0, IsAvailable = true });
        order.Items.Add(new OrderItem { ProductName = "Mustard Oil (1L)", Quantity = 2, UnitPrice = 0, IsAvailable = true });

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // 2. Merchant reviews and quotes prices
        var fetchedOrder = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(fetchedOrder);
        Assert.Equal("QuoteRequested", fetchedOrder.Status);
        Assert.Equal(2, fetchedOrder.Items.Count);

        fetchedOrder.QuotedAmount = 450m;
        fetchedOrder.DiscountAmount = 25m;
        fetchedOrder.TotalAmount = 425m;
        fetchedOrder.Status = "PriceQuoted";
        fetchedOrder.Items[0].UnitPrice = 150m;
        fetchedOrder.Items[1].UnitPrice = 150m;

        await _context.SaveChangesAsync();

        // 3. Customer accepts quote
        var quotedOrder = await _context.Orders.FindAsync(order.Id);
        Assert.NotNull(quotedOrder);
        Assert.Equal("PriceQuoted", quotedOrder.Status);
        Assert.Equal(425m, quotedOrder.TotalAmount);

        quotedOrder.Status = "Approved";
        await _context.SaveChangesAsync();

        var finalOrder = await _context.Orders.FindAsync(order.Id);
        Assert.NotNull(finalOrder);
        Assert.Equal("Approved", finalOrder.Status);
    }

    [Fact]
    public async Task OrderChat_ShouldStoreAndRetrieveThreadInOrder()
    {
        var orderId = "ORD-TEST-CHAT";
        var order = new Order
        {
            Id = orderId,
            CustomerName = "Turja Mukherjee",
            CustomerPhone = "9876543210",
            ShopName = "Tarama Stores",
            Status = "QuoteRequested",
            ItemsCount = 1,
            TotalAmount = 0
        };
        _context.Orders.Add(order);

        // Add 2 chat messages
        var msg1 = new OrderMessage
        {
            OrderId = orderId,
            SenderRole = "Customer",
            SenderName = "Turja Mukherjee",
            MessageText = "Please send fresh pack",
            CreatedAt = DateTime.UtcNow.AddSeconds(-10)
        };
        var msg2 = new OrderMessage
        {
            OrderId = orderId,
            SenderRole = "Merchant",
            SenderName = "Tarama Stores",
            MessageText = "Yes, freshly packed today",
            CreatedAt = DateTime.UtcNow
        };

        _context.OrderMessages.AddRange(msg1, msg2);
        await _context.SaveChangesAsync();

        var messages = await _context.OrderMessages
            .Where(m => m.OrderId == orderId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        Assert.Equal(2, messages.Count);
        Assert.Equal("Customer", messages[0].SenderRole);
        Assert.Equal("Please send fresh pack", messages[0].MessageText);
        Assert.Equal("Merchant", messages[1].SenderRole);
        Assert.Equal("Yes, freshly packed today", messages[1].MessageText);
    }
}
