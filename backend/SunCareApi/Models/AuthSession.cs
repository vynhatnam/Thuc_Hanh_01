namespace SunCareApi.Models;

public class AuthSession
{
    public string TokenHash { get; set; } = string.Empty;
    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public DateTime ExpiresAtUtc { get; set; }
}
