using System.ComponentModel.DataAnnotations;

namespace SunCareApi.Models;

public class AuthRequest
{
    private string email = string.Empty;
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    [StringLength(254, ErrorMessage = "Email tối đa 254 ký tự.")]
    public string Email { get => email; set => email = value?.Trim() ?? string.Empty; }

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [StringLength(128, MinimumLength = 8, ErrorMessage = "Mật khẩu phải có từ 8 đến 128 ký tự.")]
    [RegularExpression(@"[\s\S]*\S[\s\S]*", ErrorMessage = "Mật khẩu không được chỉ chứa khoảng trắng.")]
    public string Password { get; set; } = string.Empty;
}

public record UserResponse(int Id, string Email, DateTime CreatedAt);
public record AuthResponse(string Token, DateTime ExpiresAt, UserResponse User);
