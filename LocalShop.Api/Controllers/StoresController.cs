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
[AllowAnonymous]
public class StoresController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IHubContext<OrderHub> _hubContext;

    public StoresController(StoreDbContext context, IHubContext<OrderHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    // GET: api/stores
    [HttpGet]
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
    public async Task<IActionResult> UpdateStoreProfile([FromBody] StoreProfile updateData)
    {
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
            profile.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(profile ?? updateData);
    }

    // PUT: api/stores/toggle-open
    [HttpPut("toggle-open")]
    public async Task<IActionResult> ToggleStoreOpen([FromQuery] string shopName = "Tarama Stores")
    {
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
    public async Task<IActionResult> SubmitKyc([FromBody] KycSubmission submission)
    {
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
