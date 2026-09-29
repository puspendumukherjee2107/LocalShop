using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Security;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly StoreDbContext _context;
    private static decimal _platformFeePercent = 2.5m;
    private static bool _maintenanceMode = false;

    public AdminController(StoreDbContext context)
    {
        _context = context;
    }

    // GET: api/admin/overview
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var totalOrders = await _context.Orders.CountAsync();
        var totalGmv = await _context.Orders.SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;
        var totalSettled = await _context.Settlements.SumAsync(s => (decimal?)s.Amount) ?? 0m;
        var activeStores = await _context.StoreProfiles.CountAsync(s => s.IsOpen);
        var totalCustomers = await _context.Users.CountAsync(u => u.Role == "Customer");

        // If no orders yet, provide base simulation GMV
        if (totalGmv == 0) totalGmv = 482900m;
        if (totalOrders == 0) totalOrders = 1412;
        if (totalSettled == 0) totalSettled = 470827.50m;

        var platformCommission = Math.Round(totalGmv * (_platformFeePercent / 100m), 2);

        return Ok(new
        {
            grossMerchandiseVolume = totalGmv,
            totalInvoices = totalOrders,
            platformFeePercent = _platformFeePercent,
            collectedPlatformFee = platformCommission,
            settledMerchantAssets = totalSettled,
            activeStores = Math.Max(1, activeStores),
            totalCustomers = Math.Max(1, totalCustomers),
            maintenanceMode = _maintenanceMode
        });
    }

    // GET: api/admin/merchants (Includes phone numbers for password management)
    [HttpGet("merchants")]
    public async Task<IActionResult> GetMerchants()
    {
        var stores = await _context.StoreProfiles.ToListAsync();
        var merchantUsers = await _context.Users.Where(u => u.Role == "Merchant").ToListAsync();

        if (stores.Count == 0)
        {
            var seed = new List<StoreProfile>
            {
                new() { ShopName = "Tarama Stores", Category = "Groceries & Daily Essentials", TradeLicense = "TRD-992817", KycStatus = "Approved", IsOpen = true, Phone = "9876500000", OwnerName = "Tarama Stores" },
                new() { ShopName = "Mishra Kirana Store", Category = "Groceries", TradeLicense = "TRD-998271", KycStatus = "Pending", IsOpen = true, Phone = "9876511111", OwnerName = "Mishra Ji" },
                new() { ShopName = "Deluxe Dairy Hub", Category = "Dairy", TradeLicense = "TRD-884710", KycStatus = "Pending", IsOpen = true, Phone = "9876522222", OwnerName = "Dairy Hub" }
            };
            _context.StoreProfiles.AddRange(seed);
            await _context.SaveChangesAsync();
            stores = seed;
        }

        var result = new List<object>();
        var seenShopNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var s in stores)
        {
            seenShopNames.Add(s.ShopName);
            var mUser = merchantUsers.FirstOrDefault(u => 
                u.Name.Equals(s.ShopName, StringComparison.OrdinalIgnoreCase) || 
                (!string.IsNullOrEmpty(s.Phone) && u.Phone == s.Phone));

            var phone = !string.IsNullOrWhiteSpace(s.Phone) ? s.Phone : (mUser?.Phone ?? "9876500000");
            var owner = !string.IsNullOrWhiteSpace(s.OwnerName) ? s.OwnerName : (mUser?.Name ?? s.ShopName);

            result.Add(new
            {
                id = s.Id,
                shopName = s.ShopName,
                category = s.Category,
                phone = phone,
                ownerName = owner,
                tradeLicense = s.TradeLicense,
                kycStatus = s.KycStatus,
                isOpen = s.IsOpen,
                status = mUser?.Status ?? "Active"
            });
        }

        foreach (var m in merchantUsers)
        {
            if (!seenShopNames.Contains(m.Name))
            {
                result.Add(new
                {
                    id = m.Id,
                    shopName = m.Name,
                    category = !string.IsNullOrWhiteSpace(m.Address) ? m.Address : "Groceries",
                    phone = m.Phone,
                    ownerName = m.Name,
                    tradeLicense = "TRD-AUTO",
                    kycStatus = "Approved",
                    isOpen = true,
                    status = m.Status
                });
            }
        }

        return Ok(result);
    }

    // PUT: api/admin/merchants/{id}/kyc
    [HttpPut("merchants/{id}/kyc")]
    public async Task<IActionResult> UpdateMerchantKyc(string id, [FromBody] KycUpdateRequest request)
    {
        var store = await _context.StoreProfiles.FindAsync(id);
        if (store == null)
        {
            return NotFound(new { message = "Store profile not found." });
        }

        store.KycStatus = request.KycStatus; // "Approved" or "Rejected"
        store.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(store);
    }

    // POST: api/admin/reset-user-password (Admin direct password reset for Customer or Merchant)
    [HttpPost("reset-user-password")]
    public async Task<IActionResult> AdminResetUserPassword([FromBody] AdminResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Mobile number and new password are required." });
        }

        if (request.NewPassword.Length < 8)
        {
            return BadRequest(new { message = "New password must be at least 8 characters long." });
        }

        var phone = request.Phone.Trim();
        var role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Phone == phone && (role == null || u.Role == role));
        if (user == null)
        {
            user = await _context.Users.FirstOrDefaultAsync(u => u.Phone == phone);
        }

        if (user == null)
        {
            return NotFound(new { message = $"No registered account found with mobile number {phone}." });
        }

        user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword.Trim());
        user.FailedLoginAttempts = 0;
        user.LockoutUntilUtc = null;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Password reset successfully for {user.Role} '{user.Name}' ({user.Phone}).",
            phone = user.Phone,
            role = user.Role,
            name = user.Name
        });
    }

    // GET: api/admin/customers
    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers()
    {
        var customers = await _context.Users
            .Where(u => u.Role == "Customer")
            .ToListAsync();

        if (customers.Count == 0)
        {
            var seed = new List<User>
            {
                new() { Name = "Turja Mukherjee", Phone = "9876543210", Address = "Flat 4B, Greenfield Apartments", Status = "Active" },
                new() { Name = "Rahul Verma", Phone = "9123456789", Address = "Pocket 2, Mayur Vihar", Status = "Flagged" }
            };
            _context.Users.AddRange(seed);
            await _context.SaveChangesAsync();
            customers = seed;
        }

        return Ok(customers.Select(c => new
        {
            c.Id,
            c.Name,
            c.Phone,
            c.Address,
            c.Status
        }));
    }

    // PUT: api/admin/customers/{id}/toggle-status
    [HttpPut("customers/{id}/toggle-status")]
    public async Task<IActionResult> ToggleCustomerStatus(string id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.Status = user.Status == "Active" ? "Flagged" : "Active";
        await _context.SaveChangesAsync();

        return Ok(new { user.Id, user.Name, user.Status });
    }

    // GET: api/admin/logs
    [HttpGet("logs")]
    public async Task<IActionResult> GetAuditLogs()
    {
        var logs = new List<object>();

        // Recent settlements
        var settlements = await _context.Settlements
            .OrderByDescending(s => s.DispatchedAt)
            .Take(3)
            .ToListAsync();

        foreach (var s in settlements)
        {
            logs.Add(new
            {
                id = $"LOG-SET-{s.Id}",
                @event = $"Merchant {s.Id} Settlement Dispatched (₹{s.Amount})",
                time = s.DispatchedAt.ToString("HH:mm tt"),
                actor = "SYSTEM"
            });
        }

        // Recent orders
        var recentOrders = await _context.Orders
            .OrderByDescending(o => o.CreatedAt)
            .Take(3)
            .ToListAsync();

        foreach (var o in recentOrders)
        {
            logs.Add(new
            {
                id = $"LOG-ORD-{o.Id}",
                @event = $"Order {o.Id} {o.Status} ({o.ShopName} • ₹{o.TotalAmount})",
                time = o.CreatedAt.ToString("HH:mm tt"),
                actor = o.CustomerName ?? "CUSTOMER"
            });
        }

        // System baseline logs
        logs.Add(new
        {
            id = "LOG-ROOT-87",
            @event = "Root Console Authenticated (superadmin)",
            time = DateTime.UtcNow.ToString("HH:mm tt"),
            actor = "ADMIN_CONSOLE"
        });

        return Ok(logs);
    }

    // GET: api/admin/config
    [HttpGet("config")]
    public IActionResult GetConfig()
    {
        return Ok(new
        {
            platformFeePercent = _platformFeePercent,
            maintenanceMode = _maintenanceMode
        });
    }

    // PUT: api/admin/config
    [HttpPut("config")]
    public IActionResult UpdateConfig([FromBody] ConfigUpdateRequest request)
    {
        if (request.PlatformFeePercent.HasValue)
        {
            _platformFeePercent = Math.Clamp(request.PlatformFeePercent.Value, 0m, 50m);
        }
        if (request.MaintenanceMode.HasValue)
        {
            _maintenanceMode = request.MaintenanceMode.Value;
        }

        return Ok(new
        {
            platformFeePercent = _platformFeePercent,
            maintenanceMode = _maintenanceMode
        });
    }
}

public record KycUpdateRequest(string KycStatus);
public record ConfigUpdateRequest(decimal? PlatformFeePercent, bool? MaintenanceMode);
public record AdminResetPasswordRequest(string Phone, string NewPassword, string? Role = null);
