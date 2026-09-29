using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Data;
using LocalShop.Api.Models;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/customers/{phone}/addresses")]
[Authorize]
public class AddressesController : ControllerBase
{
    private readonly StoreDbContext _context;

    public AddressesController(StoreDbContext context)
    {
        _context = context;
    }

    private bool IsAuthorizedForPhone(string phone)
    {
        if (User.IsInRole("Admin")) return true;
        var callerPhone = User.FindFirst("phone")?.Value;
        return !string.IsNullOrEmpty(callerPhone) && string.Equals(callerPhone, phone, StringComparison.OrdinalIgnoreCase);
    }

    // GET: api/customers/{phone}/addresses
    [HttpGet]
    public async Task<IActionResult> GetAddresses(string phone)
    {
        if (!IsAuthorizedForPhone(phone))
        {
            return Forbid();
        }

        var addresses = await _context.CustomerAddresses
            .Where(a => a.CustomerPhone == phone)
            .OrderByDescending(a => a.IsDefault)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync();

        if (addresses.Count == 0)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Phone == phone);
            string defaultLine = !string.IsNullOrWhiteSpace(user?.Address)
                ? user.Address
                : "Flat 4B, Greenfield Apartments, Sector 5";

            var defaultAddr = new CustomerAddress
            {
                CustomerPhone = phone,
                Label = "Home",
                AddressLine = defaultLine,
                IsDefault = true
            };
            _context.CustomerAddresses.Add(defaultAddr);
            await _context.SaveChangesAsync();
            addresses = new List<CustomerAddress> { defaultAddr };
        }

        return Ok(addresses);
    }

    // POST: api/customers/{phone}/addresses
    [HttpPost]
    public async Task<IActionResult> AddAddress(string phone, [FromBody] AddAddressRequest request)
    {
        if (!IsAuthorizedForPhone(phone))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.AddressLine))
        {
            return BadRequest(new { message = "Address line cannot be empty." });
        }

        if (request.IsDefault)
        {
            var existing = await _context.CustomerAddresses.Where(a => a.CustomerPhone == phone).ToListAsync();
            foreach (var a in existing) a.IsDefault = false;
        }

        var addr = new CustomerAddress
        {
            CustomerPhone = phone,
            Label = string.IsNullOrWhiteSpace(request.Label) ? "Home" : request.Label.Trim(),
            AddressLine = request.AddressLine.Trim(),
            IsDefault = request.IsDefault,
            CreatedAt = DateTime.UtcNow
        };

        _context.CustomerAddresses.Add(addr);
        await _context.SaveChangesAsync();

        return Ok(addr);
    }

    // PUT: api/customers/{phone}/addresses/{id}/default
    [HttpPut("{id}/default")]
    public async Task<IActionResult> SetDefaultAddress(string phone, string id)
    {
        if (!IsAuthorizedForPhone(phone))
        {
            return Forbid();
        }

        var addresses = await _context.CustomerAddresses.Where(a => a.CustomerPhone == phone).ToListAsync();
        var target = addresses.FirstOrDefault(a => a.Id == id);
        if (target == null) return NotFound(new { message = "Address not found." });

        foreach (var a in addresses) a.IsDefault = (a.Id == id);
        await _context.SaveChangesAsync();

        return Ok(addresses);
    }
}

public record AddAddressRequest(string Label, string AddressLine, bool IsDefault = false);
