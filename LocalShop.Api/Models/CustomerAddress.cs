namespace LocalShop.Api.Models;

public class CustomerAddress
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CustomerPhone { get; set; } = string.Empty;
    public string Label { get; set; } = "Home"; // Home, Work, Other
    public string AddressLine { get; set; } = string.Empty;
    public bool IsDefault { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
