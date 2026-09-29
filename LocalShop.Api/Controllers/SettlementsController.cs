using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Merchant,Admin")]
public class SettlementsController : ControllerBase
{
    private readonly StoreDbContext _context;

    public SettlementsController(StoreDbContext context)
    {
        _context = context;
    }

    private bool CanManageStore(string shopName)
    {
        if (User.IsInRole("Admin")) return true;
        var callerName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        var callerPhone = User.FindFirst("phone")?.Value;
        return string.Equals(callerName, shopName, StringComparison.OrdinalIgnoreCase) ||
               _context.StoreProfiles.Any(s => s.ShopName.ToLower() == shopName.ToLower() && (s.Phone == callerPhone || s.OwnerName == callerName));
    }

    private async Task<decimal> CalculateAvailableBalance(string shopName)
    {
        var deliveredSales = await _context.Orders
            .Where(o => o.ShopName.ToLower() == shopName.ToLower() && 
                        (o.Status == "Delivered" || o.Status == "Completed" || o.Status == "DeliveredAndPaymentDone") && 
                        o.PaymentMethod == "UPI")
            .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

        var pastPayouts = await _context.Settlements
            .Where(s => s.ShopName.ToLower() == shopName.ToLower() && (s.Status == "Settled" || s.Status == "Processing"))
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        // Base ledger credit (₹58,250) + live delivered digital sales minus all requested and settled payouts
        var grossAvailable = 58250m + deliveredSales;
        return Math.Max(0, grossAvailable - pastPayouts);
    }

    // GET: api/settlements?shopName=Tarama Stores
    [HttpGet]
    public async Task<IActionResult> GetSettlementOverview([FromQuery] string shopName = "Tarama Stores")
    {
        if (!CanManageStore(shopName))
        {
            return Forbid();
        }

        var pastSettlements = await _context.Settlements
            .Where(s => s.ShopName.ToLower() == shopName.ToLower())
            .OrderByDescending(s => s.DispatchedAt)
            .ToListAsync();

        if (pastSettlements.Count == 0)
        {
            var seed = new List<Settlement>
            {
                new() { Id = "SET-9902", ShopName = shopName, Amount = 24500, BankAccount = "HDFC ****4321", Status = "Settled", DispatchedAt = DateTime.UtcNow.AddDays(-3) },
                new() { Id = "SET-9511", ShopName = shopName, Amount = 18900, BankAccount = "HDFC ****4321", Status = "Settled", DispatchedAt = DateTime.UtcNow.AddDays(-10) }
            };
            _context.Settlements.AddRange(seed);
            await _context.SaveChangesAsync();
            pastSettlements = seed;
        }

        var withdrawableBalance = await CalculateAvailableBalance(shopName);

        return Ok(new
        {
            withdrawableBalance,
            bankAccount = "HDFC ****4321",
            history = pastSettlements
        });
    }

    // POST: api/settlements/payout
    [HttpPost("payout")]
    public async Task<IActionResult> RequestPayout([FromBody] PayoutRequest request)
    {
        if (!CanManageStore(request.ShopName))
        {
            return Forbid();
        }

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Payout amount must be greater than zero." });
        }

        var availableBalance = await CalculateAvailableBalance(request.ShopName);
        if (request.Amount > availableBalance)
        {
            return BadRequest(new
            {
                message = $"Insufficient withdrawable balance. Available: ₹{availableBalance}, Requested: ₹{request.Amount}"
            });
        }

        var settlement = new Settlement
        {
            Id = $"SET-{Random.Shared.Next(1000, 9999)}",
            ShopName = request.ShopName,
            Amount = request.Amount,
            BankAccount = request.BankAccount ?? "HDFC ****4321",
            Status = "Processing",
            DispatchedAt = DateTime.UtcNow
        };

        _context.Settlements.Add(settlement);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Payout initiated successfully. Funds will clear within 2-4 hours.",
            settlement,
            remainingBalance = availableBalance - request.Amount
        });
    }
}

public record PayoutRequest(string ShopName, decimal Amount, string? BankAccount);
