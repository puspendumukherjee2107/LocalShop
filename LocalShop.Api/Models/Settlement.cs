namespace LocalShop.Api.Models;

public class Settlement
{
    public string Id { get; set; } = $"SET-{Random.Shared.Next(1000, 9999)}";
    public string ShopName { get; set; } = "Kirana Junction";
    public decimal Amount { get; set; }
    public string BankAccount { get; set; } = "HDFC ****4321";
    public string Status { get; set; } = "Settled"; // Settled, Processing
    public DateTime DispatchedAt { get; set; } = DateTime.UtcNow;
}
