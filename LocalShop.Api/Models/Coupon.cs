namespace LocalShop.Api.Models;

public class Coupon
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Code { get; set; } = string.Empty; // e.g. FIRST50, KIRANA10
    public string Description { get; set; } = string.Empty;
    public string DiscountType { get; set; } = "Flat"; // Flat, Percent
    public decimal DiscountValue { get; set; } = 50m;
    public decimal MinOrderAmount { get; set; } = 150m;
    public bool IsActive { get; set; } = true;
    public string? ShopName { get; set; } // null for all shops, or store-specific
    public DateTime ExpiryDate { get; set; } = DateTime.UtcNow.AddYears(1);
}
