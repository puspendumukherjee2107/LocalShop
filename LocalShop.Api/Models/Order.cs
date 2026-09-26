namespace LocalShop.Api.Models;

public class Order
{
    public string Id { get; set; } = $"ORD-{Guid.NewGuid().ToString()[..6].ToUpper()}";
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string ShopName { get; set; } = "Kirana Junction";
    public int ItemsCount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = "Placed"; // QuoteRequested, PriceQuoted, Placed, Processing, Delivered, Cancelled
    public string RefundStatus { get; set; } = "None"; // None, Pending, Processed
    public string PaymentMethod { get; set; } = "UPI"; // UPI, Card, Cash
    public string OrderType { get; set; } = "CustomList"; // CustomList, Catalog, QuickBill
    public string ItemsText { get; set; } = string.Empty; // Customer's written grocery list or order note
    public decimal? QuotedAmount { get; set; }
    public string DeliveryOtp { get; set; } = string.Empty; // 4-digit code for customer handoff verification
    public string? DeliveryPartnerName { get; set; }
    public string? DeliveryPartnerPhone { get; set; }
    public decimal DiscountAmount { get; set; } = 0m;
    public string? CouponCode { get; set; }
    public int? Rating { get; set; } // 1-5 stars
    public string? ReviewComment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; set; } = new();
}