namespace LocalShop.Api.Models;

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Customer"; // Customer, Merchant, Admin
    public string Address { get; set; } = string.Empty;
    public string Status { get; set; } = "Active"; // Active, Flagged
    public int FailedLoginAttempts { get; set; }
    public DateTimeOffset? LockoutUntilUtc { get; set; }
}