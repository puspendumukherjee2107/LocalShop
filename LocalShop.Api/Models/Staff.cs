namespace LocalShop.Api.Models;

public class Staff
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ShopName { get; set; } = "Tarama Stores";
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "Delivery Partner";
    public string Phone { get; set; } = string.Empty;
    public string Status { get; set; } = "Active"; // Active, Suspended
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
