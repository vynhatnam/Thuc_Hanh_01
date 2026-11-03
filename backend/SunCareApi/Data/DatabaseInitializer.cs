using Microsoft.EntityFrameworkCore;
using SunCareApi.Models;

namespace SunCareApi.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(SunCareDbContext db)
    {
        // Identify the previous exercise's database before adopting EF migrations.
        await db.Database.OpenConnectionAsync();
        bool hasDoctors;
        await using (var command = db.Database.GetDbConnection().CreateCommand())
        {
            command.CommandText = "PRAGMA journal_mode=WAL";
            await command.ExecuteNonQueryAsync();
            command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'Doctors'";
            hasDoctors = Convert.ToInt64(await command.ExecuteScalarAsync()) > 0;
        }
        await db.Database.CloseConnectionAsync();
        await db.Database.MigrateAsync();
        if (!hasDoctors)
        {
            db.Doctors.AddRange(
                new Doctor { Name = "Nguyễn Văn An", Specialty = "Tim mạch" },
                new Doctor { Name = "Trần Thị Bình", Specialty = "Nội khoa" });
            await db.SaveChangesAsync();
        }
    }
}
