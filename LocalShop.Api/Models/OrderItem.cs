namespace LocalShop.Api.Models;

public class OrderItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderId { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
    public bool IsAvailable { get; set; } = true;
    public decimal Subtotal => IsAvailable ? UnitPrice * Quantity : 0m;
}
