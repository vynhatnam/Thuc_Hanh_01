using Microsoft.EntityFrameworkCore;
using SunCareApi.Models;

namespace SunCareApi.Data;

public class SunCareDbContext(DbContextOptions<SunCareDbContext> options) : DbContext(options)
{
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<AuthSession> AuthSessions => Set<AuthSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Doctor>(entity =>
        {
            entity.Property(doctor => doctor.Name).HasMaxLength(100).IsRequired();
            entity.Property(doctor => doctor.Specialty).HasMaxLength(100).IsRequired();
        });
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.Property(user => user.Email).HasMaxLength(254).IsRequired();
            entity.Property(user => user.NormalizedEmail).HasMaxLength(254).IsRequired();
            entity.HasIndex(user => user.NormalizedEmail).IsUnique();
            entity.Property(user => user.PasswordHash).IsRequired();
        });
        modelBuilder.Entity<AuthSession>(entity =>
        {
            entity.HasKey(session => session.TokenHash);
            entity.Property(session => session.TokenHash).HasMaxLength(64);
            entity.HasOne(session => session.User).WithMany().HasForeignKey(session => session.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(session => session.ExpiresAtUtc);
        });
    }
}
