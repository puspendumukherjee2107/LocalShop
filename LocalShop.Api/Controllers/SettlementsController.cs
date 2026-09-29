using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettlementsController : ControllerBase
{
    private readonly StoreDbContext _context;

    public SettlementsController(StoreDbContext context)
    {
        _context = context;
    }

    // GET: api/settlements?shopName=Tarama Stores
    [HttpGet]
    public async Task<IActionResult> GetSettlementOverview([FromQuery] string shopName = "Tarama Stores")
    {
        // 1. Calculate Gross Digital Sales Delivered
        var digitalDeliveredSales = await _context.Orders
            .Where(o => o.ShopName == shopName && o.Status == "Delivered" && o.PaymentMethod == "UPI")
            .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

        // 2. Calculate Total Settled Funds
        var pastSettlements = await _context.Settlements
            .Where(s => s.ShopName == shopName)
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

        var totalPayouts = pastSettlements.Sum(s => s.Amount);
        
        // Base seed balance for demonstration + live digital sales
        var withdrawableBalance = Math.Max(0, 14850m + digitalDeliveredSales);

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
        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Payout amount must be greater than zero." });
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
            settlement
        });
    }
}

public record PayoutRequest(string ShopName, decimal Amount, string? BankAccount);
