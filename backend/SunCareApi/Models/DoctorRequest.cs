
using System.ComponentModel.DataAnnotations;

namespace SunCareApi.Models;

public class DoctorRequest
{
    [Required(ErrorMessage = "Tên bác sĩ không được để trống.")]
    [StringLength(100, ErrorMessage = "Tên bác sĩ không được vượt quá 100 ký tự.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Chuyên khoa không được để trống.")]
    [StringLength(100, ErrorMessage = "Chuyên khoa không được vượt quá 100 ký tự.")]
    public string Specialty { get; set; } = string.Empty;
}
