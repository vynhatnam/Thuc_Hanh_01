using Microsoft.EntityFrameworkCore;
using SunCareApi.Models;

namespace SunCareApi.Data;

public class SunCareDbContext(DbContextOptions<SunCareDbContext> options) : DbContext(options)
{
    public DbSet<Doctor> Doctors => Set<Doctor>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Doctor>(entity =>
        {
            entity.Property(doctor => doctor.Name).HasMaxLength(100).IsRequired();
            entity.Property(doctor => doctor.Specialty).HasMaxLength(100).IsRequired();
        });
    }
}
