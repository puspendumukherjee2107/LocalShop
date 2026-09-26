using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StaffController : ControllerBase
{
    private readonly StoreDbContext _context;

    public StaffController(StoreDbContext context)
    {
        _context = context;
    }

    // GET: api/staff?shopName=Kirana Junction
    [HttpGet]
    public async Task<IActionResult> GetStaff([FromQuery] string shopName = "Kirana Junction")
    {
        var staff = await _context.StaffMembers
            .Where(s => s.ShopName == shopName)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        // Seed default team members if empty
        if (staff.Count == 0)
        {
            var defaultStaff = new List<Staff>
            {
                new() { ShopName = shopName, Name = "Rohan Das", Role = "Delivery Partner", Status = "Active" },
                new() { ShopName = shopName, Name = "Amit Singh", Role = "Billing Clerk", Status = "Active" }
            };
            _context.StaffMembers.AddRange(defaultStaff);
            await _context.SaveChangesAsync();
            staff = defaultStaff;
        }

        return Ok(staff);
    }

    // POST: api/staff
    [HttpPost]
    public async Task<IActionResult> AddStaff([FromBody] Staff staff)
    {
        if (string.IsNullOrWhiteSpace(staff.Name) || string.IsNullOrWhiteSpace(staff.Role))
        {
            return BadRequest(new { message = "Staff Name and Role are required." });
        }

        staff.Id = Guid.NewGuid().ToString();
        staff.Status = "Active";
        staff.CreatedAt = DateTime.UtcNow;

        _context.StaffMembers.Add(staff);
        await _context.SaveChangesAsync();

        return Ok(staff);
    }

    // PUT: api/staff/{id}/toggle-status
    [HttpPut("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStaffStatus(string id)
    {
        var staff = await _context.StaffMembers.FindAsync(id);
        if (staff == null)
        {
            return NotFound(new { message = "Staff member not found." });
        }

        staff.Status = staff.Status == "Active" ? "Suspended" : "Active";
        await _context.SaveChangesAsync();

        return Ok(staff);
    }
}
