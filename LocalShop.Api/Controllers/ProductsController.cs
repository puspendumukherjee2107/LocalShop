using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Hubs;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class ProductsController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IHubContext<OrderHub> _hubContext;

    public ProductsController(StoreDbContext context, IHubContext<OrderHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    // GET: api/products (Fetch items with optional category, search, and shopName filtering)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Product>>> GetProducts(
        [FromQuery] string? category = null,
        [FromQuery] string? search = null,
        [FromQuery] string? shopName = null)
    {
        if (!await _context.Products.AnyAsync())
        {
            var seedProducts = new List<Product>
            {
                new() { Name = "Amul Taaza Milk 500ml", Price = 27, Category = "Dairy", Stock = 20, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Aashirvaad Whole Wheat Atta 5kg", Price = 245, Category = "Groceries", Stock = 15, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Britannia Brown Bread 400g", Price = 45, Category = "Bakery", Stock = 10, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Eggs (Pack of 6)", Price = 48, Category = "Dairy", Stock = 25, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Fortune Sunflower Oil 1L", Price = 140, Category = "Groceries", Stock = 12, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Tata Salt 1kg", Price = 28, Category = "Groceries", Stock = 30, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Madhur Sugar 1kg", Price = 52, Category = "Groceries", Stock = 18, IsAvailable = true, ShopName = "Tarama Stores" },
                new() { Name = "Maggi 2-Minute Noodles 4-Pack", Price = 56, Category = "Groceries", Stock = 22, IsAvailable = true, ShopName = "Tarama Stores" }
            };
            _context.Products.AddRange(seedProducts);
            await _context.SaveChangesAsync();
        }

        var query = _context.Products.AsQueryable();

        if (!string.IsNullOrEmpty(shopName) && shopName != "All")
        {
            var cleanShop = shopName.Trim().ToLower();
            query = query.Where(p => p.ShopName.ToLower() == cleanShop || string.IsNullOrEmpty(p.ShopName));
        }

        if (!string.IsNullOrEmpty(category) && category != "All")
        {
            query = query.Where(p => p.Category == category);
        }

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(p => p.Name.ToLower().Contains(search.ToLower()));
        }

        return await query.OrderBy(p => p.Name).ToListAsync();
    }

    // POST: api/products (Add a new item to the store inventory)
    [HttpPost]
    public async Task<ActionResult<Product>> AddProduct([FromBody] Product product)
    {
        if (string.IsNullOrWhiteSpace(product.Name))
        {
            return BadRequest(new { message = "Item name is required." });
        }

        product.Name = product.Name.Trim();
        product.ShopName = string.IsNullOrWhiteSpace(product.ShopName) ? "Tarama Stores" : product.ShopName.Trim();
        product.Category = string.IsNullOrWhiteSpace(product.Category) ? "General" : product.Category.Trim();
        product.Price = Math.Max(0, product.Price);
        product.Stock = Math.Max(0, product.Stock);

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("ProductUpdated", product);

        return CreatedAtAction(nameof(GetProducts), new { id = product.Id }, product);
    }

    // PUT: api/products/{id} (Update item details)
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProduct(string id, [FromBody] Product updatedProduct)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new { message = "Product not found." });

        if (!string.IsNullOrWhiteSpace(updatedProduct.Name)) product.Name = updatedProduct.Name.Trim();
        if (updatedProduct.Price >= 0) product.Price = updatedProduct.Price;
        if (!string.IsNullOrWhiteSpace(updatedProduct.Category)) product.Category = updatedProduct.Category.Trim();
        if (updatedProduct.Stock >= 0) product.Stock = updatedProduct.Stock;
        product.IsAvailable = updatedProduct.IsAvailable;

        await _context.SaveChangesAsync();
        await _hubContext.Clients.All.SendAsync("ProductUpdated", product);

        return Ok(product);
    }

    // PUT: api/products/toggle-stock/{id} (Update live product availability)
    [HttpPut("toggle-stock/{id}")]
    public async Task<IActionResult> ToggleStock(string id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new { message = "Product not found." });

        product.IsAvailable = !product.IsAvailable;
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("ProductUpdated", product);

        return Ok(product);
    }

    // DELETE: api/products/{id} (Remove item from inventory)
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProduct(string id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new { message = "Product not found." });

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("ProductDeleted", new { id = product.Id, shopName = product.ShopName });

        return Ok(new { message = $"Item '{product.Name}' removed from inventory." });
    }
}