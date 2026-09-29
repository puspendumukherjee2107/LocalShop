namespace LocalShop.Api.Models;

public class Product
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Category { get; set; } = "General";
    public int Stock { get; set; }
    public bool IsAvailable { get; set; } = true;
    public string ShopName { get; set; } = "Tarama Stores";
}