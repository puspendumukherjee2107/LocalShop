namespace LocalShop.Api.Models;

public class OrderMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderId { get; set; } = string.Empty;
    public string SenderRole { get; set; } = "Customer"; // Customer, Merchant, Delivery
    public string SenderName { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
