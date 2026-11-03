using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SunCareApi.Auth;
using SunCareApi.Data;
using SunCareApi.Models;

namespace SunCareApi.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AuthController(SunCareDbContext db, IPasswordHasher<AppUser> hasher) : ControllerBase
{
    // A failed lookup still verifies a hash, avoiding an immediate response for unknown emails.
    private static readonly AppUser DummyUser = new();
    private static readonly string DummyHash = new PasswordHasher<AppUser>()
        .HashPassword(DummyUser, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));

    [HttpPost("register")]
    public async Task<ActionResult<UserResponse>> Register(AuthRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var normalizedEmail = email.ToUpperInvariant();
        if (await db.Users.AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken))
            return DuplicateEmail();

        var user = new AppUser { Email = email, NormalizedEmail = normalizedEmail };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            return DuplicateEmail();
        }

        return StatusCode(StatusCodes.Status201Created, ToResponse(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(AuthRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await db.Users.SingleOrDefaultAsync(item => item.NormalizedEmail == normalizedEmail, cancellationToken);
        var result = hasher.VerifyHashedPassword(user ?? DummyUser, user?.PasswordHash ?? DummyHash, request.Password);
        if (user is null || result == PasswordVerificationResult.Failed)
            return Problem(statusCode: 401, title: "Đăng nhập thất bại.", detail: "Email hoặc mật khẩu không chính xác.");

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, request.Password);

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = DateTime.UtcNow.AddHours(8);
        await db.AuthSessions.Where(session => session.ExpiresAtUtc <= DateTime.UtcNow)
            .ExecuteDeleteAsync(cancellationToken);
        db.AuthSessions.Add(new AuthSession
        {
            TokenHash = SessionAuthenticationHandler.HashToken(token),
            UserId = user.Id,
            ExpiresAtUtc = expiresAt
        });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new AuthResponse(token, expiresAt, ToResponse(user)));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken cancellationToken)
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.AsNoTracking().SingleAsync(item => item.Id == id, cancellationToken);
        return Ok(ToResponse(user));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var hash = User.FindFirstValue("session_hash")!;
        await db.AuthSessions.Where(session => session.TokenHash == hash).ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }

    private ObjectResult DuplicateEmail() => Problem(statusCode: 409,
        title: "Không thể đăng ký.", detail: "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.");

    private static UserResponse ToResponse(AppUser user) =>
        new(user.Id, user.Email, DateTime.SpecifyKind(user.CreatedAtUtc, DateTimeKind.Utc));
}
