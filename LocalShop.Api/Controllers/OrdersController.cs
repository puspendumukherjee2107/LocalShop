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
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IHubContext<OrderHub> _hubContext;

    public OrdersController(StoreDbContext context, IHubContext<OrderHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    private string? CallerPhone => User.FindFirst("phone")?.Value;
    private string? CallerName => User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
    private string? CallerId => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
    private bool IsAdmin => User.IsInRole("Admin");
    private bool IsMerchant => User.IsInRole("Merchant");
    private bool IsCustomer => User.IsInRole("Customer");
    private bool IsDelivery => User.IsInRole("Delivery");

    private bool CanManageStore(string shopName)
    {
        if (IsAdmin) return true;
        var phone = CallerPhone;
        var name = CallerName;
        return string.Equals(name, shopName, StringComparison.OrdinalIgnoreCase) ||
               _context.StoreProfiles.Any(s => s.ShopName.ToLower() == shopName.ToLower() &&
                   ((phone != null && s.Phone == phone) || (name != null && s.OwnerName == name)));
    }

    private List<string> GetCallerManagedStores()
    {
        if (IsAdmin)
        {
            return _context.StoreProfiles.Select(s => s.ShopName).ToList();
        }

        var phone = CallerPhone;
        var name = CallerName;
        var stores = _context.StoreProfiles
            .Where(s => (phone != null && s.Phone == phone) ||
                        (name != null && (s.OwnerName == name || s.ShopName == name)))
            .Select(s => s.ShopName)
            .ToList();

        if (name != null && !stores.Contains(name, StringComparer.OrdinalIgnoreCase))
        {
            stores.Add(name);
        }
        return stores;
    }

    private bool CanAccessOrder(Order order)
    {
        if (IsAdmin) return true;

        if (IsCustomer)
        {
            return !string.IsNullOrEmpty(CallerPhone) && string.Equals(CallerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase);
        }

        if (IsMerchant)
        {
            return CanManageStore(order.ShopName);
        }

        if (IsDelivery)
        {
            return !string.IsNullOrEmpty(CallerPhone) && string.Equals(CallerPhone, order.DeliveryPartnerPhone, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private Order SanitizeOrder(Order order)
    {
        var callerPhone = CallerPhone;
        var isPlacingCustomer = !string.IsNullOrEmpty(callerPhone) && string.Equals(callerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase);

        if (!IsAdmin && !isPlacingCustomer)
        {
            order.DeliveryOtp = string.Empty;
        }
        return order;
    }

    private IEnumerable<Order> SanitizeOrders(IEnumerable<Order> orders)
    {
        var callerPhone = CallerPhone;

        foreach (var order in orders)
        {
            var isPlacingCustomer = !string.IsNullOrEmpty(callerPhone) && string.Equals(callerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase);
            if (!IsAdmin && !isPlacingCustomer)
            {
                order.DeliveryOtp = string.Empty;
            }
        }
        return orders;
    }

    private static object StripOtpForBroadcast(Order order)
    {
        return new
        {
            order.Id,
            order.CustomerName,
            order.CustomerPhone,
            order.ShopName,
            order.ItemsCount,
            order.TotalAmount,
            order.Status,
            order.RefundStatus,
            order.PaymentMethod,
            order.OrderType,
            order.ItemsText,
            order.QuotedAmount,
            DeliveryOtp = string.Empty,
            order.DeliveryPartnerName,
            order.DeliveryPartnerPhone,
            order.DiscountAmount,
            order.CouponCode,
            order.Rating,
            order.ReviewComment,
            order.CreatedAt,
            order.IsDeletedByCustomer,
            order.IsDeletedByMerchant,
            order.StockRestored,
            order.Items
        };
    }

    private static readonly HashSet<string> TerminalStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cancelled",
        "DeclinedByCustomer",
        "RejectedByMerchant",
        "Completed"
    };

    private static readonly HashSet<string> AllKnownStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Placed",
        "QuoteRequested",
        "PendingQuote",
        "PriceQuoted",
        "Approved",
        "Processing",
        "Packed",
        "Out for Delivery",
        "Delivered",
        "DeliveredAndPaymentDone",
        "Completed",
        "Cancelled",
        "DeclinedByCustomer",
        "RejectedByMerchant"
    };

    private static string? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;
        var clean = status.Trim();
        foreach (var known in AllKnownStatuses)
        {
            if (string.Equals(known, clean, StringComparison.OrdinalIgnoreCase))
            {
                return known;
            }
        }
        return null;
    }

    private static readonly Dictionary<string, HashSet<string>> AllowedTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Placed"] = new(StringComparer.OrdinalIgnoreCase) { "PendingQuote", "PriceQuoted", "Approved", "Processing", "Cancelled", "DeclinedByCustomer", "RejectedByMerchant" },
        ["QuoteRequested"] = new(StringComparer.OrdinalIgnoreCase) { "PendingQuote", "PriceQuoted", "Approved", "Processing", "Cancelled", "DeclinedByCustomer", "RejectedByMerchant" },
        ["PendingQuote"] = new(StringComparer.OrdinalIgnoreCase) { "PriceQuoted", "Approved", "Processing", "Cancelled", "DeclinedByCustomer", "RejectedByMerchant" },
        ["PriceQuoted"] = new(StringComparer.OrdinalIgnoreCase) { "PriceQuoted", "Approved", "Processing", "Cancelled", "DeclinedByCustomer", "RejectedByMerchant" },
        ["Approved"] = new(StringComparer.OrdinalIgnoreCase) { "Processing", "Packed", "Out for Delivery", "DeliveredAndPaymentDone", "Cancelled", "RejectedByMerchant" },
        ["Processing"] = new(StringComparer.OrdinalIgnoreCase) { "Packed", "Out for Delivery", "DeliveredAndPaymentDone", "Cancelled", "RejectedByMerchant" },
        ["Packed"] = new(StringComparer.OrdinalIgnoreCase) { "Out for Delivery", "DeliveredAndPaymentDone", "Cancelled", "RejectedByMerchant" },
        ["Out for Delivery"] = new(StringComparer.OrdinalIgnoreCase) { "Delivered", "DeliveredAndPaymentDone", "Completed" },
        ["Delivered"] = new(StringComparer.OrdinalIgnoreCase) { "DeliveredAndPaymentDone", "Completed" },
        ["DeliveredAndPaymentDone"] = new(StringComparer.OrdinalIgnoreCase) { "Completed" },
        ["Completed"] = new(StringComparer.OrdinalIgnoreCase) { },
        ["Cancelled"] = new(StringComparer.OrdinalIgnoreCase) { },
        ["DeclinedByCustomer"] = new(StringComparer.OrdinalIgnoreCase) { },
        ["RejectedByMerchant"] = new(StringComparer.OrdinalIgnoreCase) { }
    };

    private static bool IsValidTransition(string currentStatus, string targetStatus)
    {
        if (AllowedTransitions.TryGetValue(currentStatus, out var allowed))
        {
            return allowed.Contains(targetStatus);
        }
        return false;
    }

    private async Task RestoreCatalogStockAsync(Order order)
    {
        if (order.OrderType == "Catalog" && !order.StockRestored)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var items = await _context.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync();
                foreach (var item in items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product != null)
                    {
                        product.Stock += item.Quantity;
                        product.IsAvailable = true;
                    }
                }
                order.StockRestored = true;
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        else
        {
            await _context.SaveChangesAsync();
        }
    }

    // GET: api/orders
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Order>>> GetAllOrders(
        [FromQuery] string? role,
        [FromQuery] string? shopName,
        [FromQuery] bool includeDeleted = false)
    {
        var query = _context.Orders
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .AsQueryable();

        if (IsAdmin)
        {
            if (!string.IsNullOrWhiteSpace(shopName))
            {
                query = query.Where(o => o.ShopName.ToLower() == shopName.ToLower());
            }

            if (!includeDeleted)
            {
                if (string.Equals(role, "customer", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(o => !o.IsDeletedByCustomer);
                }
                else if (string.Equals(role, "merchant", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(o => !o.IsDeletedByMerchant);
                }
            }
        }
        else if (IsMerchant)
        {
            var managedStores = GetCallerManagedStores();
            if (!managedStores.Any())
            {
                return Ok(Enumerable.Empty<Order>());
            }

            if (!string.IsNullOrWhiteSpace(shopName))
            {
                if (!managedStores.Any(s => string.Equals(s, shopName, StringComparison.OrdinalIgnoreCase)))
                {
                    return Forbid();
                }
                query = query.Where(o => o.ShopName.ToLower() == shopName.ToLower());
            }
            else
            {
                var lowerStores = managedStores.Select(s => s.ToLower()).ToList();
                query = query.Where(o => lowerStores.Contains(o.ShopName.ToLower()));
            }

            if (!includeDeleted)
            {
                query = query.Where(o => !o.IsDeletedByMerchant);
            }
        }
        else if (IsCustomer)
        {
            var phone = CallerPhone;
            if (string.IsNullOrEmpty(phone))
            {
                return Forbid();
            }

            query = query.Where(o => o.CustomerPhone == phone);

            if (!includeDeleted)
            {
                query = query.Where(o => !o.IsDeletedByCustomer);
            }
        }
        else if (IsDelivery)
        {
            var phone = CallerPhone;
            if (string.IsNullOrEmpty(phone))
            {
                return Forbid();
            }

            query = query.Where(o => o.DeliveryPartnerPhone == phone || (o.Status == "Packed" || o.Status == "Out for Delivery"));
        }
        else
        {
            return Forbid();
        }

        var orders = await query.ToListAsync();
        return Ok(SanitizeOrders(orders));
    }

    // GET: api/orders/shop/{shopName}
    [HttpGet("shop/{shopName}")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<ActionResult<IEnumerable<Order>>> GetShopOrders(string shopName, [FromQuery] bool includeDeleted = false)
    {
        if (!CanManageStore(shopName))
        {
            return Forbid();
        }

        var query = _context.Orders
            .Include(o => o.Items)
            .Where(o => o.ShopName.ToLower() == shopName.ToLower());

        if (!includeDeleted)
        {
            query = query.Where(o => !o.IsDeletedByMerchant);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return Ok(SanitizeOrders(orders));
    }

    // GET: api/orders/customer/{customerName}
    [HttpGet("customer/{customerName}")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<ActionResult<IEnumerable<Order>>> GetCustomerOrders(string customerName, [FromQuery] bool includeDeleted = false)
    {
        if (!IsAdmin && !string.Equals(CallerName, customerName, StringComparison.OrdinalIgnoreCase) && !string.Equals(CallerPhone, customerName, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var query = _context.Orders
            .Include(o => o.Items)
            .Where(o => o.CustomerName.ToLower() == customerName.ToLower() || o.CustomerPhone == customerName);

        if (!includeDeleted)
        {
            query = query.Where(o => !o.IsDeletedByCustomer);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return Ok(SanitizeOrders(orders));
    }

    // DELETE: api/orders/{id}/customer-history
    [HttpDelete("{id}/customer-history")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<IActionResult> DeleteCustomerOrderHistory(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { message = "Order not found." });
        }

        if (!IsAdmin && !string.Equals(CallerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        // Soft delete: marks hidden from customer view while preserving 100% of data for auditing
        order.IsDeletedByCustomer = true;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Order removed from customer history.", orderId = id });
    }

    // DELETE: api/orders/{id}/merchant-history
    [HttpDelete("{id}/merchant-history")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> DeleteMerchantOrderHistory(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { message = "Order not found." });
        }

        if (!CanManageStore(order.ShopName))
        {
            return Forbid();
        }

        // Soft delete: marks hidden from merchant view while preserving 100% of data for auditing
        order.IsDeletedByMerchant = true;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Order removed from merchant history.", orderId = id });
    }

    // DELETE: api/orders/customer-history/clear
    [HttpDelete("customer-history/clear")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<IActionResult> ClearCustomerHistory([FromQuery] string? phone, [FromQuery] string? customerName)
    {
        var targetPhone = !IsAdmin ? CallerPhone : (phone ?? CallerPhone);
        if (string.IsNullOrEmpty(targetPhone))
        {
            return Forbid();
        }

        var query = _context.Orders.Where(o => !o.IsDeletedByCustomer && o.CustomerPhone == targetPhone);

        var finishedStatuses = new[] { "Completed", "Delivered", "Cancelled", "DeclinedByCustomer", "RejectedByMerchant", "DeliveredAndPaymentDone" };
        var ordersToClear = await query.Where(o => finishedStatuses.Contains(o.Status)).ToListAsync();

        foreach (var order in ordersToClear)
        {
            order.IsDeletedByCustomer = true;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{ordersToClear.Count} orders cleared from customer history.", clearedCount = ordersToClear.Count });
    }

    // DELETE: api/orders/merchant-history/clear
    [HttpDelete("merchant-history/clear")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> ClearMerchantHistory([FromQuery] string shopName)
    {
        if (string.IsNullOrWhiteSpace(shopName) || !CanManageStore(shopName))
        {
            return Forbid();
        }

        var finishedStatuses = new[] { "Completed", "Delivered", "Cancelled", "DeclinedByCustomer", "RejectedByMerchant", "DeliveredAndPaymentDone" };
        var ordersToClear = await _context.Orders
            .Where(o => o.ShopName.ToLower() == shopName.ToLower() && !o.IsDeletedByMerchant && finishedStatuses.Contains(o.Status))
            .ToListAsync();

        foreach (var order in ordersToClear)
        {
            order.IsDeletedByMerchant = true;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{ordersToClear.Count} orders cleared from merchant history.", clearedCount = ordersToClear.Count });
    }

    // GET: api/orders/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Order>> GetOrder(string id)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });
        if (!CanAccessOrder(order)) return Forbid();
        return Ok(SanitizeOrder(order));
    }

    // POST: api/orders/custom-list
    // POST: api/orders/list
    // Allows customer to submit an uncataloged grocery list without requiring merchant inventory
    [HttpPost("custom-list")]
    [HttpPost("list")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<ActionResult<Order>> CreateCustomListOrder([FromBody] CustomListOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ItemsText))
        {
            return BadRequest(new { message = "Grocery items list cannot be empty." });
        }

        var effectivePhone = IsAdmin && !string.IsNullOrWhiteSpace(request.CustomerPhone)
            ? request.CustomerPhone.Trim()
            : (CallerPhone ?? request.CustomerPhone?.Trim() ?? string.Empty);

        if (string.IsNullOrWhiteSpace(effectivePhone))
        {
            return BadRequest(new { message = "Customer mobile number is required." });
        }

        var effectiveName = !IsAdmin && !string.IsNullOrWhiteSpace(CallerName)
            ? CallerName
            : (string.IsNullOrWhiteSpace(request.CustomerName) ? "Customer" : request.CustomerName.Trim());

        var lines = request.ItemsText.Split(new[] { '\r', '\n', ',' }, StringSplitOptions.RemoveEmptyEntries);
        int estimatedCount = Math.Max(1, lines.Length);

        var order = new Order
        {
            CustomerName = effectiveName,
            CustomerPhone = effectivePhone,
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

        foreach (var line in lines)
        {
            var cleaned = line.Trim().TrimStart('•', '-', '*', ' ').Trim();
            if (!string.IsNullOrWhiteSpace(cleaned))
            {
                order.Items.Add(new OrderItem
                {
                    OrderId = order.Id,
                    ProductName = cleaned,
                    UnitPrice = 0m,
                    Quantity = 1,
                    IsAvailable = true
                });
            }
        }
        order.ItemsCount = Math.Max(1, order.Items.Count);

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("ReceiveNewOrder", StripOtpForBroadcast(order));

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, SanitizeOrder(order));
    }

    // POST: api/orders/catalog
    // Handles catalog cart checkouts with itemized OrderItems and automated stock decrement
    [HttpPost("catalog")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<ActionResult<Order>> CreateCatalogOrder([FromBody] CatalogOrderRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "Cart cannot be empty." });
        }

        var effectivePhone = IsAdmin && !string.IsNullOrWhiteSpace(request.CustomerPhone)
            ? request.CustomerPhone.Trim()
            : (CallerPhone ?? request.CustomerPhone?.Trim() ?? string.Empty);

        if (string.IsNullOrWhiteSpace(effectivePhone))
        {
            return BadRequest(new { message = "Customer mobile number is required." });
        }

        var effectiveName = !IsAdmin && !string.IsNullOrWhiteSpace(CallerName)
            ? CallerName
            : (string.IsNullOrWhiteSpace(request.CustomerName) ? "Customer" : request.CustomerName.Trim());

        var order = new Order
        {
            CustomerName = effectiveName,
            CustomerPhone = effectivePhone,
            ShopName = string.IsNullOrWhiteSpace(request.ShopName) ? "Tarama Stores" : request.ShopName.Trim(),
            Status = "Processing",
            OrderType = "Catalog",
            PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "UPI" : request.PaymentMethod,
            DeliveryOtp = Random.Shared.Next(1000, 9999).ToString(),
            CouponCode = request.CouponCode,
            CreatedAt = DateTime.UtcNow
        };

        decimal total = 0;
        int totalQuantity = 0;
        var summaryLines = new List<string>();

        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0)
            {
                return BadRequest(new { message = "Item quantity must be at least 1." });
            }

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

        // Server-side coupon and discount validation
        decimal calculatedDiscount = 0m;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var code = request.CouponCode.Trim().ToUpperInvariant();
            if (code == "WELCOME50" && total >= 200m)
            {
                calculatedDiscount = 50m;
            }
            else if (code == "SAVE10" && total >= 300m)
            {
                calculatedDiscount = Math.Min(100m, Math.Round(total * 0.10m, 2));
            }
            else if (code == "FESTIVE20" && total >= 500m)
            {
                calculatedDiscount = Math.Min(150m, Math.Round(total * 0.20m, 2));
            }
            else
            {
                return BadRequest(new { message = $"Coupon '{request.CouponCode}' is invalid or minimum order value is not met." });
            }
        }

        order.DiscountAmount = Math.Min(total, calculatedDiscount);
        order.ItemsCount = totalQuantity;
        order.TotalAmount = Math.Max(0, total - order.DiscountAmount);
        order.QuotedAmount = order.TotalAmount;
        order.ItemsText = string.Join("\n", summaryLines);

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("ReceiveNewOrder", StripOtpForBroadcast(order));

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, SanitizeOrder(order));
    }

    // POST: api/orders/quick-bill
    // Merchant directly sells products at counter without maintaining inventory
    [HttpPost("quick-bill")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<ActionResult<Order>> CreateQuickBill([FromBody] QuickBillRequest request)
    {
        var targetShop = string.IsNullOrWhiteSpace(request.ShopName) ? "Tarama Stores" : request.ShopName.Trim();
        if (!CanManageStore(targetShop))
        {
            return Forbid();
        }

        if (request.TotalAmount <= 0)
        {
            return BadRequest(new { message = "Total amount must be greater than zero." });
        }

        var order = new Order
        {
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Walk-in Customer" : request.CustomerName.Trim(),
            CustomerPhone = request.CustomerPhone?.Trim() ?? string.Empty,
            ShopName = targetShop,
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

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("ReceiveNewOrder", StripOtpForBroadcast(order));

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/quote
    // Merchant reviews the customer's grocery list and quotes the total price
    [HttpPut("{id}/quote")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> QuotePrice(string id, [FromBody] QuoteRequest request)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanManageStore(order.ShopName))
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot quote price. Order is already closed or completed ('{order.Status}')." });
        }

        if (order.Status is not ("Placed" or "QuoteRequested" or "PendingQuote" or "PriceQuoted"))
        {
            return BadRequest(new { message = $"Cannot quote price for order in '{order.Status}' state. Order is already approved or in fulfillment." });
        }

        if (request.QuotedAmount <= 0)
        {
            return BadRequest(new { message = "Quoted amount must be greater than zero." });
        }

        order.DiscountAmount = Math.Max(0, request.DiscountAmount);
        order.QuotedAmount = request.QuotedAmount;
        order.TotalAmount = request.QuotedAmount;
        order.Status = "PriceQuoted";

        if (request.Items != null && request.Items.Count > 0)
        {
            // Remove existing items and replace with updated prices & availability
            _context.OrderItems.RemoveRange(order.Items);
            order.Items.Clear();

            var summaryLines = new List<string>();
            foreach (var item in request.Items)
            {
                var orderItem = new OrderItem
                {
                    OrderId = order.Id,
                    ProductName = string.IsNullOrWhiteSpace(item.Name) ? "Item" : item.Name.Trim(),
                    UnitPrice = item.IsAvailable ? Math.Max(0, item.Price) : 0m,
                    Quantity = item.Quantity > 0 ? item.Quantity : 1,
                    IsAvailable = item.IsAvailable
                };
                order.Items.Add(orderItem);

                if (orderItem.IsAvailable)
                {
                    summaryLines.Add($"• {orderItem.ProductName}: ₹{orderItem.UnitPrice}");
                }
                else
                {
                    summaryLines.Add($"• {orderItem.ProductName}: ❌ Not Available / Out of Stock");
                }
            }

            order.ItemsText = string.Join("\n", summaryLines);
            order.ItemsCount = order.Items.Count(i => i.IsAvailable);
        }
        
        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("ReceivePriceQuote", new { orderId = order.Id, quoteAmount = order.QuotedAmount, discountAmount = order.DiscountAmount, order = StripOtpForBroadcast(order) });
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });

        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/accept-quote
    // PUT: api/orders/{id}/approve
    // Customer accepts the merchant's quote and approves the order
    [HttpPut("{id}/accept-quote")]
    [HttpPut("{id}/approve")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<IActionResult> AcceptQuote(string id, [FromBody] AcceptQuoteRequest? request)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsAdmin && !string.Equals(CallerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot accept quote. Order is already closed or completed ('{order.Status}')." });
        }

        if (order.Status is "Placed" or "QuoteRequested" or "PendingQuote")
        {
            return BadRequest(new { message = "Cannot approve quote before merchant has reviewed the list and quoted a price." });
        }

        if (order.Status is not "PriceQuoted")
        {
            return BadRequest(new { message = $"Cannot accept quote for order in '{order.Status}' state." });
        }

        order.PaymentMethod = string.IsNullOrWhiteSpace(request?.PaymentMethod) ? "Direct Transfer" : request.PaymentMethod;
        order.Status = "Approved";

        await _context.SaveChangesAsync();

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });

        return Ok(SanitizeOrder(order));
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
    [Authorize(Roles = "Customer,Merchant,Admin")]
    public async Task<IActionResult> DisapproveOrder(string id, [FromBody] RejectOrderRequest? request)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanAccessOrder(order))
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot reject or decline order. Order is already in terminal state '{order.Status}'." });
        }

        if (order.Status is "Delivered" or "DeliveredAndPaymentDone")
        {
            return BadRequest(new { message = "Cannot reject or decline an order that has already been delivered." });
        }

        string role = request?.Role?.Trim().ToLower() ?? string.Empty;
        if (string.IsNullOrEmpty(role))
        {
            role = IsMerchant ? "merchant" : (IsCustomer ? "customer" : "admin");
        }

        if (role == "customer")
        {
            if (!IsAdmin && !string.Equals(CallerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            if (order.Status is not ("Placed" or "QuoteRequested" or "PendingQuote" or "PriceQuoted"))
            {
                return BadRequest(new { message = $"Customer cannot decline order in '{order.Status}' state. Order is already processing or dispatched." });
            }

            order.Status = "DeclinedByCustomer";
        }
        else if (role == "merchant")
        {
            if (!CanManageStore(order.ShopName))
            {
                return Forbid();
            }

            if (order.Status is not ("Placed" or "QuoteRequested" or "PendingQuote" or "PriceQuoted" or "Approved" or "Processing" or "Packed"))
            {
                return BadRequest(new { message = $"Merchant cannot reject order in '{order.Status}' state." });
            }

            order.Status = "RejectedByMerchant";
        }
        else
        {
            if (!IsAdmin)
            {
                return Forbid();
            }
            order.Status = "Cancelled";
        }

        string reason = request?.Reason?.Trim() ?? string.Empty;
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

        await RestoreCatalogStockAsync(order);

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });

        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/packed
    // Merchant sends confirmation once order is packed
    [HttpPut("{id}/packed")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> MarkPacked(string id)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanManageStore(order.ShopName))
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot mark packed. Order is already closed or completed ('{order.Status}')." });
        }

        if (order.Status is not ("Approved" or "Processing"))
        {
            return BadRequest(new { message = $"Cannot mark order as packed when current state is '{order.Status}'. Order must be approved first." });
        }

        order.Status = "Packed";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });
        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/delivered-and-paid
    // Merchant marks order delivered and payment done
    [HttpPut("{id}/delivered-and-paid")]
    [Authorize(Roles = "Merchant,Delivery,Admin")]
    public async Task<IActionResult> MarkDeliveredAndPaid(string id)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanManageStore(order.ShopName) && (!IsDelivery || !string.Equals(CallerPhone, order.DeliveryPartnerPhone, StringComparison.OrdinalIgnoreCase)) && !IsAdmin)
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot mark delivered and paid. Order is already closed or completed ('{order.Status}')." });
        }

        if (order.Status is not ("Delivered" or "Out for Delivery" or "Packed" or "Processing" or "Approved"))
        {
            return BadRequest(new { message = $"Cannot mark delivered and paid for order in '{order.Status}' state." });
        }

        order.Status = "DeliveredAndPaymentDone";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });
        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/customer-confirm
    // Customer approves that delivery and payment are done
    [HttpPut("{id}/customer-confirm")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<IActionResult> CustomerConfirmCompleted(string id)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsAdmin && !string.Equals(CallerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (order.Status is "Completed")
        {
            return Ok(SanitizeOrder(order)); // idempotent
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot confirm order completion. Order is already in terminal state '{order.Status}'." });
        }

        if (order.Status is not ("Delivered" or "DeliveredAndPaymentDone" or "Out for Delivery"))
        {
            return BadRequest(new { message = $"Cannot confirm completion for order in '{order.Status}' state. Order must be delivered first." });
        }

        order.Status = "Completed";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });
        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/status
    // Updates order processing state with strict FSM validation
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanManageStore(order.ShopName))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request?.Status))
        {
            return BadRequest(new { message = "Status cannot be empty." });
        }

        var targetStatus = NormalizeStatus(request.Status);
        if (targetStatus == null)
        {
            return BadRequest(new { message = $"Unknown or invalid status '{request.Status}'." });
        }

        if (string.Equals(order.Status, targetStatus, StringComparison.OrdinalIgnoreCase))
        {
            return Ok(SanitizeOrder(order)); // idempotent
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot modify order. Current status '{order.Status}' is a final terminal state." });
        }

        if (!IsValidTransition(order.Status, targetStatus))
        {
            return BadRequest(new { message = $"Invalid status transition from '{order.Status}' to '{targetStatus}'." });
        }

        // Bypassing delivery OTP verification is forbidden
        if (targetStatus == "Delivered" && !string.IsNullOrEmpty(order.DeliveryOtp))
        {
            return BadRequest(new { message = "Transitioning to 'Delivered' requires customer OTP verification via the /verify-otp-deliver endpoint." });
        }

        order.Status = targetStatus;

        if (targetStatus is "Cancelled" or "RejectedByMerchant")
        {
            if (order.PaymentMethod != "Cash" && order.TotalAmount > 0)
            {
                order.RefundStatus = "Pending";
            }
            await RestoreCatalogStockAsync(order);
        }
        else
        {
            await _context.SaveChangesAsync();
        }

        // Broadcast to Real-Time SignalR Hub
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });

        return Ok(SanitizeOrder(order));
    }

    // GET: api/orders/customer/{phone}/payments
    // Returns payment ledger transactions for a customer
    [HttpGet("customer/{phone}/payments")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<IActionResult> GetCustomerPayments(string phone)
    {
        if (!IsAdmin && !string.Equals(CallerPhone, phone, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var orders = await _context.Orders
            .Where(o => o.CustomerPhone == phone && o.TotalAmount > 0 && !o.IsDeletedByCustomer)
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
    // Cancels order, triggers refund, and restores catalog stock with strict state and authorization validation
    [HttpPut("{id}/cancel")]
    [Authorize(Roles = "Customer,Merchant,Admin")]
    public async Task<IActionResult> CancelOrder(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanAccessOrder(order))
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Order is already closed or completed ('{order.Status}') and cannot be cancelled." });
        }

        if (order.Status is "Delivered" or "DeliveredAndPaymentDone")
        {
            return BadRequest(new { message = "Cannot cancel an order that has already been delivered." });
        }

        // Customer can only cancel prior to packing or dispatch
        if (IsCustomer && !IsAdmin && order.Status is "Packed" or "Out for Delivery")
        {
            return BadRequest(new { message = $"Customer cannot cancel an order once it is '{order.Status}'. Please contact the store directly." });
        }

        order.Status = "Cancelled";
        if (order.PaymentMethod != "Cash" && order.TotalAmount > 0)
        {
            order.RefundStatus = "Pending";
        }

        await RestoreCatalogStockAsync(order);

        // Broadcast to Real-Time SignalR Hub (Sanitized without DeliveryOtp)
        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });

        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/assign-driver
    // Merchant assigns order to delivery partner
    [HttpPut("{id}/assign-driver")]
    [Authorize(Roles = "Merchant,Admin")]
    public async Task<IActionResult> AssignDriver(string id, [FromBody] AssignDriverRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanManageStore(order.ShopName))
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot assign delivery driver. Order is already closed or completed ('{order.Status}')." });
        }

        if (order.Status is not ("Packed" or "Approved" or "Processing"))
        {
            return BadRequest(new { message = $"Cannot assign driver for order in '{order.Status}' state. Order must be approved/packed first." });
        }

        order.DeliveryPartnerName = request.DriverName;
        order.DeliveryPartnerPhone = request.DriverPhone;
        order.Status = "Out for Delivery";

        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });
        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/verify-otp-deliver
    // Delivery partner enters customer's 4-digit OTP to complete delivery
    [HttpPut("{id}/verify-otp-deliver")]
    [Authorize(Roles = "Merchant,Delivery,Admin")]
    public async Task<IActionResult> VerifyOtpAndDeliver(string id, [FromBody] VerifyOtpRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!CanManageStore(order.ShopName) && (!IsDelivery || !string.Equals(CallerPhone, order.DeliveryPartnerPhone, StringComparison.OrdinalIgnoreCase)) && !IsAdmin)
        {
            return Forbid();
        }

        if (TerminalStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = $"Cannot verify delivery. Order is already closed or completed ('{order.Status}')." });
        }

        if (order.Status is not ("Out for Delivery" or "Packed" or "Processing" or "Approved"))
        {
            return BadRequest(new { message = $"Cannot verify delivery for order in '{order.Status}' state." });
        }

        if (string.IsNullOrWhiteSpace(request.Otp) || order.DeliveryOtp.Trim() != request.Otp.Trim())
        {
            return BadRequest(new { message = "Invalid Delivery OTP. Please verify the 4-digit code provided by the customer." });
        }

        order.Status = "Delivered";
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", new { orderId = order.Id, status = order.Status, order = StripOtpForBroadcast(order) });
        return Ok(SanitizeOrder(order));
    }

    // PUT: api/orders/{id}/rate
    // Customer submits rating and review for delivered order
    [HttpPut("{id}/rate")]
    [Authorize(Roles = "Customer,Admin")]
    public async Task<IActionResult> RateOrder(string id, [FromBody] RateOrderRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsAdmin && !string.Equals(CallerPhone, order.CustomerPhone, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (order.Status is not ("Delivered" or "DeliveredAndPaymentDone" or "Completed"))
        {
            return BadRequest(new { message = $"Cannot rate order before delivery. Current status is '{order.Status}'." });
        }

        order.Rating = Math.Clamp(request.Rating, 1, 5);
        order.ReviewComment = request.GetEffectiveComment()?.Trim();

        await _context.SaveChangesAsync();
        return Ok(SanitizeOrder(order));
    }

    // GET: api/orders/{id}/messages
    [HttpGet("{id}/messages")]
    [Authorize]
    public async Task<IActionResult> GetOrderMessages(string id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });
        if (!CanAccessOrder(order)) return Forbid();

        var messages = await _context.OrderMessages
            .Where(m => m.OrderId == id)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();
        return Ok(messages);
    }

    // POST: api/orders/{id}/messages
    [HttpPost("{id}/messages")]
    [Authorize]
    public async Task<IActionResult> SendOrderMessage(string id, [FromBody] SendMessageRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });
        if (!CanAccessOrder(order)) return Forbid();

        if (string.IsNullOrWhiteSpace(request.MessageText))
        {
            return BadRequest(new { message = "Message text cannot be empty." });
        }

        var message = new OrderMessage
        {
            OrderId = id,
            SenderRole = request.SenderRole ?? (IsMerchant ? "Merchant" : "Customer"),
            SenderName = request.SenderName ?? CallerName ?? "User",
            MessageText = request.MessageText.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.OrderMessages.Add(message);
        await _context.SaveChangesAsync();

        // Broadcast ONLY to the specific order group
        await _hubContext.Clients.Group($"order_{id}").SendAsync("ReceiveOrderMessage", message);

        return Ok(message);
    }

    // GET: api/orders/{id}/whatsapp-link?recipient=merchant|customer|delivery
    [HttpGet("{id}/whatsapp-link")]
    [Authorize]
    public async Task<IActionResult> GetWhatsAppLink(string id, [FromQuery] string recipient = "merchant")
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });
        if (!CanAccessOrder(order)) return Forbid();

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
public class QuoteItemDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int Quantity { get; set; } = 1;
}

public class QuoteRequest
{
    public decimal QuotedAmount { get; set; }
    public decimal DiscountAmount { get; set; } = 0m;
    public List<QuoteItemDto>? Items { get; set; }
}
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
