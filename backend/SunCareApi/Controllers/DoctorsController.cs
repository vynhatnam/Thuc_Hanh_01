using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SunCareApi.Data;
using SunCareApi.Models;

namespace SunCareApi.Controllers;

[ApiController]
[Route("api/doctors")]
public class DoctorsController(SunCareDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Doctor>>> GetAll(CancellationToken cancellationToken)
    {
        var doctors = await db.Doctors.AsNoTracking()
            .OrderBy(doctor => doctor.Id)
            .ToListAsync(cancellationToken);
        return Ok(doctors);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Doctor>> GetById(int id, CancellationToken cancellationToken)
    {
        var doctor = await db.Doctors.AsNoTracking()
            .SingleOrDefaultAsync(doctor => doctor.Id == id, cancellationToken);

        return doctor is null ? DoctorNotFound(id) : Ok(doctor);
    }

    [HttpPost]
    public async Task<ActionResult<Doctor>> Create(DoctorRequest request, CancellationToken cancellationToken)
    {
        var doctor = new Doctor
        {
            Name = request.Name.Trim(),
            Specialty = request.Specialty.Trim()
        };
        db.Doctors.Add(doctor);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = doctor.Id }, doctor);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Doctor>> Update(int id, DoctorRequest request, CancellationToken cancellationToken)
    {
        var doctor = await db.Doctors.SingleOrDefaultAsync(doctor => doctor.Id == id, cancellationToken);
        if (doctor is null)
        {
            return DoctorNotFound(id);
        }

        doctor.Name = request.Name.Trim();
        doctor.Specialty = request.Specialty.Trim();

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return DoctorNotFound(id);
        }

        return Ok(doctor);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var deleted = await db.Doctors.Where(doctor => doctor.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? DoctorNotFound(id) : NoContent();
    }

    private ObjectResult DoctorNotFound(int id) => Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Không tìm thấy bác sĩ.",
        detail: $"Bác sĩ có mã {id} không tồn tại.");
}
