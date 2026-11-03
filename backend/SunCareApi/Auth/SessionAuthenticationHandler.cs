using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SunCareApi.Data;

namespace SunCareApi.Auth;

public class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    SunCareDbContext db) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "SessionBearer";

    public static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        var token = header[7..].Trim();
        if (token.Length != 64)
            return AuthenticateResult.Fail("Phiên đăng nhập không hợp lệ.");

        var hash = HashToken(token);
        var session = await db.AuthSessions.AsNoTracking().Include(item => item.User)
            .SingleOrDefaultAsync(item => item.TokenHash == hash && item.ExpiresAtUtc > DateTime.UtcNow,
                Context.RequestAborted);

        if (session is null)
            return AuthenticateResult.Fail("Phiên đăng nhập đã hết hạn hoặc đã đăng xuất.");

        var identity = new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, session.UserId.ToString()),
            new Claim(ClaimTypes.Email, session.User.Email),
            new Claim("session_hash", hash)
        ], SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.Headers.WWWAuthenticate = "Bearer";
        return Results.Problem(statusCode: 401, title: "Vui lòng đăng nhập.",
            detail: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.").ExecuteAsync(Context);
    }
}
