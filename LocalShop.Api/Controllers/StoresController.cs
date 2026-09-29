using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Hubs;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StoresController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IHubContext<OrderHub> _hubContext;

    public StoresController(StoreDbContext context, IHubContext<OrderHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    private bool CanManageStore(string shopName)
    {
        if (User.IsInRole("Admin")) return true;
        var callerName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        var callerPhone = User.FindFirst("phone")?.Value;
        return string.Equals(callerName, shopName, StringComparison.OrdinalIgnoreCase) ||
               _context.StoreProfiles.Any(s => s.ShopName.ToLower() == shopName.ToLower() && (s.Phone == callerPhone || s.OwnerName == callerName));
    }

    // GET: api/stores
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAllStores()
    {
        var stores = await _context.StoreProfiles.ToListAsync();
        if (!stores.Any(s => s.ShopName == "Gupta Supermarket"))
        {
            var extraStores = new List<StoreProfile>
            {
                new() { ShopName = "Gupta Supermarket", Category = "Groceries & Spices", IsOpen = true, OperatingHours = "07:30 AM - 10:00 PM", DeliveryRadiusKm = 4.5, MinOrderAmount = 200m, TradeLicense = "TRD-998271", KycStatus = "Approved" },
                new() { ShopName = "Deluxe Dairy Hub", Category = "Dairy & Bakery", IsOpen = false, OperatingHours = "06:00 AM - 08:30 PM", DeliveryRadiusKm = 2.0, MinOrderAmount = 100m, TradeLicense = "TRD-884710", KycStatus = "Pending" }
            };
            _context.StoreProfiles.AddRange(extraStores);
            await _context.SaveChangesAsync();
            stores = await _context.StoreProfiles.ToListAsync();
        }

        return Ok(stores.Select(s => new
        {
            s.Id,
            s.ShopName,
            s.Category,
            s.IsOpen,
            s.OperatingHours,
            s.DeliveryRadiusKm,
            s.MinOrderAmount,
            s.KycStatus,
            rating = 4.8,
            distanceKm = 1.2
        }));
    }

    // GET: api/stores/profile?shopName=Tarama Stores
    [HttpGet("profile")]
    [AllowAnonymous]
    public async Task<IActionResult> GetStoreProfile([FromQuery] string shopName = "Tarama Stores")
    {
        var profile = await _context.StoreProfiles.FirstOrDefaultAsync(s => s.ShopName == shopName);

        if (profile == null)
        {
            profile = new StoreProfile
            {
                ShopName = shopName,
                Category = "Groceries & Daily Essentials",
                IsOpen = true,
                OperatingHours = "08:00 AM - 09:30 PM",
                DeliveryRadiusKm = 3.0,
                MinOrderAmount = 150m,
                TradeLicense = "TRD-992817",
                KycStatus = "Approved",
                UpdatedAt = DateTime.UtcNow
            };
            _context.StoreProfiles.Add(profile);
            await _context.SaveChangesAsync();
        }

        return Ok(profile);
    }

    // PUT: api/stores/profile
    [HttpPut("profile")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> UpdateStoreProfile([FromBody] StoreProfile updateData)
    {
        if (!CanManageStore(updateData.ShopName))
        {
            return Forbid();
        }

        var profile = await _context.StoreProfiles.FirstOrDefaultAsync(s => s.ShopName == updateData.ShopName);
        if (profile == null)
        {
            updateData.Id = Guid.NewGuid().ToString();
            updateData.UpdatedAt = DateTime.UtcNow;
            _context.StoreProfiles.Add(updateData);
        }
        else
        {
            profile.OperatingHours = updateData.OperatingHours;
            profile.DeliveryRadiusKm = updateData.DeliveryRadiusKm;
            profile.MinOrderAmount = updateData.MinOrderAmount;
            if (!string.IsNullOrEmpty(updateData.Phone)) profile.Phone = updateData.Phone;
            if (!string.IsNullOrEmpty(updateData.OwnerName)) profile.OwnerName = updateData.OwnerName;
            profile.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(profile ?? updateData);
    }

    // PUT: api/stores/toggle-open
    [HttpPut("toggle-open")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> ToggleStoreOpen([FromQuery] string shopName = "Tarama Stores")
    {
        if (!CanManageStore(shopName))
        {
            return Forbid();
        }

        var profile = await _context.StoreProfiles.FirstOrDefaultAsync(s => s.ShopName == shopName);
        if (profile == null)
        {
            return NotFound(new { message = "Store profile not found." });
        }

        profile.IsOpen = !profile.IsOpen;
        profile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("StoreStatusUpdated", new { shopName = profile.ShopName, isOpen = profile.IsOpen });

        return Ok(new { isOpen = profile.IsOpen, message = profile.IsOpen ? "Store is now OPEN" : "Store is now CLOSED" });
    }

    // POST: api/stores/submit-kyc
    [HttpPost("submit-kyc")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> SubmitKyc([FromBody] KycSubmission submission)
    {
        if (!CanManageStore(submission.ShopName))
        {
            return Forbid();
        }

        var profile = await _context.StoreProfiles.FirstOrDefaultAsync(s => s.ShopName == submission.ShopName);
        if (profile == null)
        {
            return NotFound(new { message = "Store profile not found." });
        }

        profile.TradeLicense = submission.TradeLicense.Trim();
        profile.KycStatus = "Pending";
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "KYC credentials submitted successfully. Admin review staged.",
            profile
        });
    }
}

public record KycSubmission(string ShopName, string TradeLicense);
