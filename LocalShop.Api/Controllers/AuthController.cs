using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LocalShop.Api.Data;
using LocalShop.Api.Models;
using LocalShop.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LocalShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
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
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Phone and password are required." });
        }

        if (request.Phone.Length < 10)
        {
            return BadRequest(new { message = "Phone number must be at least 10 digits." });
        }

        if (request.Password.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        var normalizedRole = string.IsNullOrWhiteSpace(request.Role) ? "Customer" : request.Role.Trim();
        if (string.Equals(normalizedRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Administrative accounts cannot be self-registered." });
        }

        if (!string.Equals(normalizedRole, "Customer", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(normalizedRole, "Merchant", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid role specified. Only Customer or Merchant accounts are permitted." });
        }

        if (await _context.Users.AnyAsync(u => u.Phone == request.Phone && u.Role == normalizedRole))
        {
            return BadRequest(new { message = "This mobile number is already registered." });
        }

        var user = new User
        {
            Name = string.IsNullOrWhiteSpace(request.Name) ? (normalizedRole == "Merchant" ? "Store Owner" : "Customer") : request.Name.Trim(),
            Phone = request.Phone.Trim(),
            Role = normalizedRole,
            Address = request.Address?.Trim() ?? string.Empty,
            PasswordHash = PasswordHasher.HashPassword(request.Password),
            Status = "Active"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Account provisioned successfully.",
            user = new { user.Id, user.Name, user.Phone, user.Role }
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

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string Otp, DateTime ExpiresAtUtc)> _resetOtps = new();

    [HttpPost("send-reset-otp")]
    public async Task<IActionResult> SendResetOtp([FromBody] SendResetOtpRequest request)
    {
        var phone = request.Phone?.Trim();
        var role = string.IsNullOrWhiteSpace(request.Role) ? "Customer" : request.Role.Trim();

        if (string.IsNullOrWhiteSpace(phone))
        {
            return BadRequest(new { message = "Mobile number is required." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Phone == phone && u.Role == role);
        if (user != null)
        {
            var otp = Random.Shared.Next(100000, 999999).ToString();
            var key = $"{role}:{phone}";
            _resetOtps[key] = (otp, DateTime.UtcNow.AddMinutes(5));
            Console.WriteLine($"[Security Notice] Password reset OTP generated for {phone} ({role})");
        }

        return Ok(new
        {
            message = $"If an account exists for {phone}, a verification code has been dispatched."
        });
    }

    [HttpPut("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var phone = request.Phone?.Trim();
        var otp = request.Otp?.Trim();
        var newPassword = request.NewPassword?.Trim();
        var role = string.IsNullOrWhiteSpace(request.Role) ? "Customer" : request.Role.Trim();

        if (string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(otp) || string.IsNullOrWhiteSpace(newPassword))
        {
            return BadRequest(new { message = "Mobile number, verification code (OTP), and new password are required." });
        }

        if (newPassword.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        var key = $"{role}:{phone}";
        if (!_resetOtps.TryGetValue(key, out var storedOtp) || storedOtp.ExpiresAtUtc < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Verification code is missing, invalid, or expired. Please request a new code." });
        }

        if (storedOtp.Otp != otp)
        {
            return BadRequest(new { message = "Invalid verification code. Please check the code sent to your phone and try again." });
        }

        // Invalidate OTP after single use
        _resetOtps.TryRemove(key, out _);

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Phone == phone && u.Role == role);

        if (user == null)
        {
            return NotFound(new { message = "No account found for this mobile number." });
        }

        user.PasswordHash = PasswordHasher.HashPassword(newPassword);
        user.FailedLoginAttempts = 0;
        user.LockoutUntilUtc = null;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully. Please sign in with your new password." });
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var callerPhone = User.FindFirst("phone")?.Value;
        var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        var isAdmin = User.IsInRole("Admin");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == callerId || (!string.IsNullOrEmpty(callerPhone) && u.Phone == callerPhone));
        if (user == null)
        {
            if (isAdmin && !string.IsNullOrWhiteSpace(request.Phone))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Phone == request.Phone);
            }
            if (user == null) return NotFound(new { message = "User not found." });
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
        var jwtKey = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_KEY");
        if (string.IsNullOrWhiteSpace(jwtKey)) jwtKey = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKey)) jwtKey = "LocalShop-Dev-Strict-Key-2026-Secure-Random!";

        var jwtIssuer = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_ISSUER");
        if (string.IsNullOrWhiteSpace(jwtIssuer)) jwtIssuer = _configuration["Jwt:Issuer"];
        if (string.IsNullOrWhiteSpace(jwtIssuer)) jwtIssuer = "LocalShop.Api";

        var jwtAudience = Environment.GetEnvironmentVariable("LOCALSHOP_JWT_AUDIENCE");
        if (string.IsNullOrWhiteSpace(jwtAudience)) jwtAudience = _configuration["Jwt:Audience"];
        if (string.IsNullOrWhiteSpace(jwtAudience)) jwtAudience = "LocalShop.Mobile";

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

public record RegisterRequest(string Phone, string Password, string? Name, string? Role = null, string? Address = null);
public record LoginRequest(string Phone, string Password, string? Role = null);
public record SendResetOtpRequest(string Phone, string? Role = null);
public record ResetPasswordRequest(string Phone, string Otp, string NewPassword, string? Role = null);
public record UpdateProfileRequest(string Phone, string? Name, string? Address);
