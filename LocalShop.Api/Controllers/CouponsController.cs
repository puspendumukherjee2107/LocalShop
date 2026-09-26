using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CouponsController : ControllerBase
{
    private readonly StoreDbContext _context;

    public CouponsController(StoreDbContext context)
    {
        _context = context;
    }

    // GET: api/coupons
    [HttpGet]
    public async Task<IActionResult> GetCoupons([FromQuery] string? shopName = null)
    {
        var coupons = await _context.Coupons.Where(c => c.IsActive).ToListAsync();
        if (coupons.Count == 0)
        {
            var seed = new List<Coupon>
            {
                new() { Code = "FIRST50", Description = "Flat ₹50 OFF on orders above ₹150", DiscountType = "Flat", DiscountValue = 50m, MinOrderAmount = 150m, IsActive = true },
                new() { Code = "KIRANA10", Description = "10% OFF on grocery orders above ₹200", DiscountType = "Percent", DiscountValue = 10m, MinOrderAmount = 200m, IsActive = true },
                new() { Code = "FLAT20", Description = "Instant ₹20 OFF on daily essentials", DiscountType = "Flat", DiscountValue = 20m, MinOrderAmount = 100m, IsActive = true }
            };
            _context.Coupons.AddRange(seed);
            await _context.SaveChangesAsync();
            coupons = seed;
        }

        return Ok(coupons);
    }

    // POST: api/coupons/validate
    [HttpPost("validate")]
    public async Task<IActionResult> ValidateCoupon([FromBody] ValidateCouponRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(new { valid = false, isValid = false, message = "Coupon code cannot be empty." });
        }

        var coupon = await _context.Coupons.FirstOrDefaultAsync(c => c.Code.ToUpper() == request.Code.Trim().ToUpper() && c.IsActive);
        if (coupon == null)
        {
            return Ok(new { valid = false, isValid = false, discountAmount = 0m, message = "Invalid coupon code." });
        }

        var amount = request.GetEffectiveAmount();
        if (amount < coupon.MinOrderAmount)
        {
            return Ok(new
            {
                valid = false,
                isValid = false,
                discountAmount = 0m,
                message = $"Minimum order amount for code {coupon.Code} is ₹{coupon.MinOrderAmount}."
            });
        }

        decimal discount = 0m;
        if (coupon.DiscountType == "Flat")
        {
            discount = coupon.DiscountValue;
        }
        else if (coupon.DiscountType == "Percent")
        {
            discount = Math.Round(amount * (coupon.DiscountValue / 100m), 2);
        }

        discount = Math.Min(discount, amount);

        return Ok(new
        {
            valid = true,
            isValid = true,
            code = coupon.Code,
            discountAmount = discount,
            message = $"Coupon {coupon.Code} applied! You saved ₹{discount}."
        });
    }
}

public class ValidateCouponRequest
{
    public string Code { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal OrderAmount { get; set; }
    public string? ShopName { get; set; }

    public decimal GetEffectiveAmount() => Subtotal > 0 ? Subtotal : OrderAmount;
}
