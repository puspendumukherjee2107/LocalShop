using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Hubs;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class OrdersController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IHubContext<OrderHub> _hubContext;

    public OrdersController(StoreDbContext context, IHubContext<OrderHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    // GET: api/orders
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Order>>> GetAllOrders()
    {
        return await _context.Orders
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    // GET: api/orders/shop/{shopName}
    [HttpGet("shop/{shopName}")]
    public async Task<ActionResult<IEnumerable<Order>>> GetShopOrders(string shopName)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .Where(o => o.ShopName.ToLower() == shopName.ToLower())
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    // GET: api/orders/customer/{customerName}
    [HttpGet("customer/{customerName}")]
    public async Task<ActionResult<IEnumerable<Order>>> GetCustomerOrders(string customerName)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .Where(o => o.CustomerName.ToLower() == customerName.ToLower())
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    // GET: api/orders/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Order>> GetOrder(string id)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });
        return Ok(order);
    }

    // POST: api/orders/custom-list
    // POST: api/orders/list
    // Allows customer to submit an uncataloged grocery list without requiring merchant inventory
    [HttpPost("custom-list")]
    [HttpPost("list")]
    public async Task<ActionResult<Order>> CreateCustomListOrder([FromBody] CustomListOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ItemsText))
        {
            return BadRequest(new { message = "Grocery items list cannot be empty." });
        }

        var lines = request.ItemsText.Split(new[] { '\r', '\n', ',' }, StringSplitOptions.RemoveEmptyEntries);
        int estimatedCount = Math.Max(1, lines.Length);

        var order = new Order
        {
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Guest Customer" : request.CustomerName.Trim(),
            CustomerPhone = request.CustomerPhone?.Trim() ?? string.Empty,
            ShopName = string.IsNullOrWhiteSpace(request.ShopName) ? "Tarama Stores" : request.ShopName.Trim(),
            ItemsCount = estimatedCount,
            TotalAmount = 0,
            Status = "QuoteRequested",
            OrderType = "CustomList",
            ItemsText = request.ItemsText.Trim(),
            PaymentMethod = "UPI",
            DeliveryOtp = Random.Shared.Next(1000, 9999).ToString(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("ReceiveNewOrder", order);

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
    }

    // POST: api/orders/catalog
    // Handles catalog cart checkouts with itemized OrderItems and automated stock decrement
    [HttpPost("catalog")]
    public async Task<ActionResult<Order>> CreateCatalogOrder([FromBody] CatalogOrderRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "Cart cannot be empty." });
        }

        var order = new Order
        {
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Guest Customer" : request.CustomerName.Trim(),
            CustomerPhone = request.CustomerPhone?.Trim() ?? string.Empty,
            ShopName = string.IsNullOrWhiteSpace(request.ShopName) ? "Tarama Stores" : request.ShopName.Trim(),
            Status = "Processing",
            OrderType = "Catalog",
            PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "UPI" : request.PaymentMethod,
            DeliveryOtp = Random.Shared.Next(1000, 9999).ToString(),
            DiscountAmount = Math.Max(0, request.DiscountAmount),
            CouponCode = request.CouponCode,
            CreatedAt = DateTime.UtcNow
        };

        decimal total = 0;
        int totalQuantity = 0;
        var summaryLines = new List<string>();

        foreach (var item in request.Items)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product == null)
            {
                return NotFound(new { message = $"Product {item.ProductId} not found." });
            }

            if (product.Stock < item.Quantity)
            {
                return BadRequest(new { message = $"Insufficient stock for {product.Name}. Available: {product.Stock}, Requested: {item.Quantity}" });
            }

            // Auto-deduct stock
            product.Stock -= item.Quantity;
            if (product.Stock <= 0)
            {
                product.IsAvailable = false;
            }

            var orderItem = new OrderItem
            {
                OrderId = order.Id,
                ProductId = product.Id,
                ProductName = product.Name,
                UnitPrice = product.Price,
                Quantity = item.Quantity
            };

            order.Items.Add(orderItem);
            total += orderItem.Subtotal;
            totalQuantity += item.Quantity;
            summaryLines.Add($"• {item.Quantity}x {product.Name} (₹{product.Price})");
        }

        order.ItemsCount = totalQuantity;
        order.TotalAmount = Math.Max(0, total - order.DiscountAmount);
        order.QuotedAmount = order.TotalAmount;
        order.ItemsText = string.Join("\n", summaryLines);

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("ReceiveNewOrder", order);

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
    }

    // POST: api/orders/quick-bill
    // Merchant directly sells products at counter without maintaining inventory
    [HttpPost("quick-bill")]
    public async Task<ActionResult<Order>> CreateQuickBill([FromBody] QuickBillRequest request)
    {
        if (request.TotalAmount <= 0)
        {
            return BadRequest(new { message = "Total amount must be greater than zero." });
        }

        var order = new Order
        {
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Walk-in Customer" : request.CustomerName.Trim(),
            CustomerPhone = request.CustomerPhone?.Trim() ?? string.Empty,
            ShopName = string.IsNullOrWhiteSpace(request.ShopName) ? "Tarama Stores" : request.ShopName.Trim(),
            ItemsCount = request.ItemsCount > 0 ? request.ItemsCount : 1,
            TotalAmount = request.TotalAmount,
            QuotedAmount = request.TotalAmount,
            Status = "Processing",
            OrderType = "QuickBill",
            ItemsText = request.ItemsText?.Trim() ?? "Counter Quick Sale",
            PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Cash" : request.PaymentMethod,
            DeliveryOtp = Random.Shared.Next(1000, 9999).ToString(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("ReceiveNewOrder", order);

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
    }

    // PUT: api/orders/{id}/quote
    // Merchant reviews the customer's grocery list and quotes the total price
    [HttpPut("{id}/quote")]
    public async Task<IActionResult> QuotePrice(string id, [FromBody] QuoteRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (request.QuotedAmount <= 0)
        {
            return BadRequest(new { message = "Quoted amount must be greater than zero." });
        }

        order.QuotedAmount = request.QuotedAmount;
        order.TotalAmount = request.QuotedAmount;
        order.Status = "PriceQuoted";
        
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("ReceivePriceQuote", new { orderId = order.Id, quoteAmount = order.QuotedAmount, order });

        return Ok(order);
    }

    // PUT: api/orders/{id}/accept-quote
    // PUT: api/orders/{id}/approve
    // Customer accepts the merchant's quote and approves the order
    [HttpPut("{id}/accept-quote")]
    [HttpPut("{id}/approve")]
    public async Task<IActionResult> AcceptQuote(string id, [FromBody] AcceptQuoteRequest? request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.PaymentMethod = string.IsNullOrWhiteSpace(request?.PaymentMethod) ? "Direct Transfer" : request.PaymentMethod;
        order.Status = "Approved";

        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });

        return Ok(order);
    }

    // PUT: api/orders/{id}/disapprove
    // PUT: api/orders/{id}/reject
    // PUT: api/orders/{id}/reject-quote
    // PUT: api/orders/{id}/decline
    // Customer or Merchant chooses not to approve the order or price quote
    [HttpPut("{id}/disapprove")]
    [HttpPut("{id}/reject")]
    [HttpPut("{id}/reject-quote")]
    [HttpPut("{id}/decline")]
    public async Task<IActionResult> DisapproveOrder(string id, [FromBody] RejectOrderRequest? request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        string role = request?.Role?.Trim().ToLower() ?? string.Empty;
        string reason = request?.Reason?.Trim() ?? string.Empty;

        if (role == "customer")
        {
            order.Status = "DeclinedByCustomer";
        }
        else if (role == "merchant")
        {
            order.Status = "RejectedByMerchant";
        }
        else
        {
            order.Status = "Cancelled";
        }

        if (!string.IsNullOrEmpty(reason))
        {
            order.ReviewComment = string.IsNullOrEmpty(order.ReviewComment)
                ? $"Status Note: {reason}"
                : $"{order.ReviewComment} | Note: {reason}";
        }

        if (order.PaymentMethod != "Cash" && order.TotalAmount > 0)
        {
            order.RefundStatus = "Pending";
        }

        // Restore catalog item stock in Products table
        var items = await _context.OrderItems.Where(i => i.OrderId == id).ToListAsync();
        foreach (var item in items)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.Stock += item.Quantity;
                product.IsAvailable = true;
            }
        }

        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });

        return Ok(order);
    }

    // PUT: api/orders/{id}/packed
    // Merchant sends confirmation once order is packed
    [HttpPut("{id}/packed")]
    public async Task<IActionResult> MarkPacked(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.Status = "Packed";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });
        return Ok(order);
    }

    // PUT: api/orders/{id}/delivered-and-paid
    // Merchant marks order delivered and payment done
    [HttpPut("{id}/delivered-and-paid")]
    public async Task<IActionResult> MarkDeliveredAndPaid(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.Status = "DeliveredAndPaymentDone";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });
        return Ok(order);
    }

    // PUT: api/orders/{id}/customer-confirm
    // Customer approves that delivery and payment are done
    [HttpPut("{id}/customer-confirm")]
    public async Task<IActionResult> CustomerConfirmCompleted(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.Status = "Completed";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });
        return Ok(order);
    }

    // PUT: api/orders/{id}/status
    // Updates order processing state
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.Status = request.Status;
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });

        return Ok(order);
    }

    // GET: api/orders/customer/{phone}/payments
    // Returns payment ledger transactions for a customer
    [HttpGet("customer/{phone}/payments")]
    public async Task<IActionResult> GetCustomerPayments(string phone)
    {
        var orders = await _context.Orders
            .Where(o => o.CustomerPhone == phone && o.TotalAmount > 0)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        var payments = orders.Select(o => new
        {
            id = o.Id,
            storeName = o.ShopName,
            amount = o.TotalAmount,
            method = o.PaymentMethod ?? "UPI",
            status = (o.Status == "Cancelled" || o.Status == "DeclinedByCustomer" || o.Status == "RejectedByMerchant") ? "Refunded" : "Successful",
            date = o.CreatedAt.ToString("dd MMMM yyyy")
        });

        return Ok(payments);
    }

    // PUT: api/orders/{id}/cancel
    // Cancels order, triggers refund, and restores catalog stock
    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelOrder(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.Status = "Cancelled";
        if (order.PaymentMethod != "Cash" && order.TotalAmount > 0)
        {
            order.RefundStatus = "Pending";
        }

        // Restore catalog item stock in Products table
        var items = await _context.OrderItems.Where(i => i.OrderId == id).ToListAsync();
        foreach (var item in items)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.Stock += item.Quantity;
                product.IsAvailable = true;
            }
        }

        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });

        return Ok(order);
    }

    // PUT: api/orders/{id}/assign-driver
    // Merchant assigns order to delivery partner
    [HttpPut("{id}/assign-driver")]
    public async Task<IActionResult> AssignDriver(string id, [FromBody] AssignDriverRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.DeliveryPartnerName = request.DriverName;
        order.DeliveryPartnerPhone = request.DriverPhone;
        order.Status = "Out for Delivery";

        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });
        return Ok(order);
    }

    // PUT: api/orders/{id}/verify-otp-deliver
    // Delivery partner enters customer's 4-digit OTP to complete delivery
    [HttpPut("{id}/verify-otp-deliver")]
    public async Task<IActionResult> VerifyOtpAndDeliver(string id, [FromBody] VerifyOtpRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (string.IsNullOrWhiteSpace(request.Otp) || order.DeliveryOtp.Trim() != request.Otp.Trim())
        {
            return BadRequest(new { message = "Invalid Delivery OTP. Please verify the 4-digit code provided by the customer." });
        }

        order.Status = "Delivered";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order });
        return Ok(order);
    }

    // PUT: api/orders/{id}/rate
    // Customer submits rating and review for delivered order
    [HttpPut("{id}/rate")]
    public async Task<IActionResult> RateOrder(string id, [FromBody] RateOrderRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        order.Rating = Math.Clamp(request.Rating, 1, 5);
        order.ReviewComment = request.GetEffectiveComment()?.Trim();

        await _context.SaveChangesAsync();
        return Ok(order);
    }

    // GET: api/orders/{id}/messages
    [HttpGet("{id}/messages")]
    public async Task<IActionResult> GetOrderMessages(string id)
    {
        var messages = await _context.OrderMessages
            .Where(m => m.OrderId == id)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();
        return Ok(messages);
    }

    // POST: api/orders/{id}/messages
    [HttpPost("{id}/messages")]
    public async Task<IActionResult> SendOrderMessage(string id, [FromBody] SendMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.MessageText))
        {
            return BadRequest(new { message = "Message text cannot be empty." });
        }

        var message = new OrderMessage
        {
            OrderId = id,
            SenderRole = request.SenderRole ?? "Customer",
            SenderName = request.SenderName ?? "User",
            MessageText = request.MessageText.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.OrderMessages.Add(message);
        await _context.SaveChangesAsync();

        // Broadcast to SignalR
        await _hubContext.Clients.All.SendAsync("ReceiveOrderMessage", message);

        return Ok(message);
    }

    // GET: api/orders/{id}/whatsapp-link?recipient=merchant|customer|delivery
    [HttpGet("{id}/whatsapp-link")]
    public async Task<IActionResult> GetWhatsAppLink(string id, [FromQuery] string recipient = "merchant")
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        string targetPhone = "";
        string message = "";

        if (recipient.ToLower() == "merchant")
        {
            targetPhone = "9876500000"; // store default
            message = $"Hello {order.ShopName}! Regarding my Order #{order.Id}:\nItems: {order.ItemsText}\nCustomer: {order.CustomerName} ({order.CustomerPhone})\nPlease update me on the order status.";
        }
        else if (recipient.ToLower() == "delivery")
        {
            targetPhone = string.IsNullOrWhiteSpace(order.CustomerPhone) ? "9876543210" : order.CustomerPhone;
            message = $"Hello {order.CustomerName}! I am your delivery partner for LocalStore Order #{order.Id}. I am en route with your items. Please keep Delivery OTP {order.DeliveryOtp} ready.";
        }
        else // to customer
        {
            targetPhone = string.IsNullOrWhiteSpace(order.CustomerPhone) ? "9876543210" : order.CustomerPhone;
            message = $"Hello {order.CustomerName}! Greetings from {order.ShopName}.\nYour Order #{order.Id} bill is ₹{order.TotalAmount}.\nDelivery OTP: {order.DeliveryOtp}\nThank you for shopping with us!";
        }

        string cleanPhone = targetPhone.Replace("+", "").Replace(" ", "").Replace("-", "");
        if (!cleanPhone.StartsWith("91") && cleanPhone.Length == 10) cleanPhone = "91" + cleanPhone;

        string encoded = Uri.EscapeDataString(message);
        string waUrl = $"https://wa.me/{cleanPhone}?text={encoded}";

        return Ok(new { targetPhone = cleanPhone, message, url = waUrl });
    }
}

public record CustomListOrderRequest(string? CustomerName, string? CustomerPhone, string? ShopName, string ItemsText);
public record QuickBillRequest(string? CustomerName, string? CustomerPhone, string? ShopName, string? ItemsText, int ItemsCount, decimal TotalAmount, string? PaymentMethod);
public record QuoteRequest(decimal QuotedAmount);
public record AcceptQuoteRequest(string? PaymentMethod);
public record UpdateStatusRequest(string Status);
public record CatalogCartItem(string ProductId, int Quantity);
public record CatalogOrderRequest(string? CustomerName, string? CustomerPhone, string? ShopName, string? PaymentMethod, List<CatalogCartItem> Items, decimal DiscountAmount = 0m, string? CouponCode = null);
public record AssignDriverRequest(string DriverName, string DriverPhone);
public record VerifyOtpRequest(string Otp);
public class RateOrderRequest
{
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public string? ReviewComment { get; set; }
    public string? GetEffectiveComment() => !string.IsNullOrWhiteSpace(ReviewComment) ? ReviewComment : Comment;
}
public record SendMessageRequest(string? SenderRole, string? SenderName, string MessageText);
public record RejectOrderRequest(string? Role, string? Reason);
