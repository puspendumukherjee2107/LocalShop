namespace LocalShop.Api.Models;

public class StoreProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ShopName { get; set; } = "Tarama Stores";
    public string Category { get; set; } = "Groceries & Daily Essentials";
    public bool IsOpen { get; set; } = true;
    public string OperatingHours { get; set; } = "08:00 AM - 09:30 PM";
    public double DeliveryRadiusKm { get; set; } = 3.0;
    public decimal MinOrderAmount { get; set; } = 150.0m;
    public string TradeLicense { get; set; } = "TRD-992817";
    public string KycStatus { get; set; } = "Approved"; // Pending, Approved, Rejected
    public string Phone { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
