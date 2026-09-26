using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(StoreDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] User registrationData)
    {
        if (string.IsNullOrWhiteSpace(registrationData.Phone) || string.IsNullOrWhiteSpace(registrationData.PasswordHash))
        {
            return BadRequest(new { message = "Phone and password are required." });
        }

        if (registrationData.Phone.Length < 10)
        {
            return BadRequest(new { message = "Phone number must be at least 10 digits." });
        }

        if (registrationData.PasswordHash.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        if (await _context.Users.AnyAsync(u => u.Phone == registrationData.Phone && u.Role == registrationData.Role))
        {
            return BadRequest(new { message = "This mobile number is already registered." });
        }

        registrationData.PasswordHash = PasswordHasher.HashPassword(registrationData.PasswordHash);

        _context.Users.Add(registrationData);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Account provisioned successfully.",
            user = new { registrationData.Id, registrationData.Name, registrationData.Phone, registrationData.Role }
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var normalizedRole = string.IsNullOrWhiteSpace(request.Role) ? "Customer" : request.Role.Trim();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Phone == request.Phone && u.Role == normalizedRole);

        if (user == null)
        {
            return Unauthorized(new { message = "No account found for this mobile number." });
        }

        if (user.LockoutUntilUtc.HasValue && user.LockoutUntilUtc.Value > DateTimeOffset.UtcNow)
        {
            return Unauthorized(new
            {
                message = $"Account temporarily locked. Please try again after {user.LockoutUntilUtc.Value.UtcDateTime:yyyy-MM-dd HH:mm:ss} UTC."
            });
        }

        if (!PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;

            if (user.FailedLoginAttempts >= 5)
            {
                user.LockoutUntilUtc = DateTimeOffset.UtcNow.AddMinutes(10);
                user.FailedLoginAttempts = 0;
                await _context.SaveChangesAsync();

                return Unauthorized(new
                {
                    message = "Too many failed login attempts. Your account has been temporarily locked for 10 minutes."
                });
            }

            var attemptsLeft = 5 - user.FailedLoginAttempts;
            await _context.SaveChangesAsync();

            return Unauthorized(new
            {
                message = $"Incorrect security password. Please try again. {attemptsLeft} attempt(s) remaining."
            });
        }

        user.FailedLoginAttempts = 0;
        user.LockoutUntilUtc = null;
        await _context.SaveChangesAsync();

        var token = GenerateJwtToken(user);

        return Ok(new
        {
            message = "Authentication successful.",
            token,
            user = new { user.Id, user.Name, user.Phone, user.Role, user.Address }
        });
    }

    [HttpPut("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var phone = request.Phone?.Trim();
        var newPassword = request.NewPassword?.Trim();
        var role = string.IsNullOrWhiteSpace(request.Role) ? "Customer" : request.Role.Trim();

        if (string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(newPassword))
        {
            return BadRequest(new { message = "Phone number and new password are required." });
        }

        if (newPassword.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Phone == phone && u.Role == role);

        if (user == null)
        {
            return NotFound(new { message = "No account found for this mobile number." });
        }

        user.PasswordHash = PasswordHasher.HashPassword(newPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully. Please sign in with your new password." });
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Phone == request.Phone);
        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        if (!string.IsNullOrWhiteSpace(request.Name)) user.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.Address)) user.Address = request.Address.Trim();

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Profile updated successfully.",
            user = new { user.Id, user.Name, user.Phone, user.Role, user.Address }
        });
    }

    private string GenerateJwtToken(User user)
    {
        var jwtKey = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_KEY") ?? _configuration["Jwt:Key"] ?? "LocalShop-Dev-Key-Replace-In-Production-2026!";
        var jwtIssuer = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_ISSUER") ?? _configuration["Jwt:Issuer"] ?? "LocalShop.Api";
        var jwtAudience = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_AUDIENCE") ?? _configuration["Jwt:Audience"] ?? "LocalShop.Mobile";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("phone", user.Phone)
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Phone, string Password, string? Role = null);
public record ResetPasswordRequest(string Phone, string NewPassword, string? Role = null);
public record UpdateProfileRequest(string Phone, string? Name, string? Address);
