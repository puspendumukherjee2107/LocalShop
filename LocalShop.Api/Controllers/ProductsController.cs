using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly StoreDbContext _context;

    public ProductsController(StoreDbContext context)
    {
        _context = context;
    }

    // GET: api/products (Fetch items with optional category filtering and search queries)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Product>>> GetProducts(
        [FromQuery] string? category = null,
        [FromQuery] string? search = null)
    {
        if (!await _context.Products.AnyAsync())
        {
            var seedProducts = new List<Product>
            {
                new() { Name = "Amul Taaza Milk 500ml", Price = 27, Category = "Dairy", Stock = 20, IsAvailable = true },
                new() { Name = "Aashirvaad Whole Wheat Atta 5kg", Price = 245, Category = "Groceries", Stock = 15, IsAvailable = true },
                new() { Name = "Britannia Brown Bread 400g", Price = 45, Category = "Bakery", Stock = 10, IsAvailable = true },
                new() { Name = "Eggs (Pack of 6)", Price = 48, Category = "Dairy", Stock = 25, IsAvailable = true },
                new() { Name = "Fortune Sunflower Oil 1L", Price = 140, Category = "Groceries", Stock = 12, IsAvailable = true },
                new() { Name = "Tata Salt 1kg", Price = 28, Category = "Groceries", Stock = 30, IsAvailable = true },
                new() { Name = "Madhur Sugar 1kg", Price = 52, Category = "Groceries", Stock = 18, IsAvailable = true },
                new() { Name = "Maggi 2-Minute Noodles 4-Pack", Price = 56, Category = "Groceries", Stock = 22, IsAvailable = true }
            };
            _context.Products.AddRange(seedProducts);
            await _context.SaveChangesAsync();
        }

        var query = _context.Products.AsQueryable();

        if (!string.IsNullOrEmpty(category) && category != "All")
        {
            query = query.Where(p => p.Category == category);
        }

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(p => p.Name.ToLower().Contains(search.ToLower()));
        }

        return await query.ToListAsync();
    }

    // POST: api/products (Add a new item to the store inventory)
    [HttpPost]
    public async Task<ActionResult<Product>> AddProduct([FromBody] Product product)
    {
        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProducts), new { id = product.Id }, product);
    }

    // PUT: api/products/toggle-stock/{id} (Update live product availability)
    [HttpPut("toggle-stock/{id}")]
    public async Task<IActionResult> ToggleStock(string id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new { message = "Product not found." });

        product.IsAvailable = !product.IsAvailable;
        await _context.SaveChangesAsync();

        return Ok(product);
    }
}