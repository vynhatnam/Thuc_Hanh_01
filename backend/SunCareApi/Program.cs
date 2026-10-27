using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SunCareApi.Data;
using SunCareApi.Models;

var builder = WebApplication.CreateBuilder(args);

var connection = new SqliteConnectionStringBuilder(
    builder.Configuration.GetConnectionString("SunCare")
        ?? "Data Source=App_Data/suncare.db");

// Resolve relative database paths from the API project, regardless of the shell directory.
if (connection.DataSource != ":memory:" && !string.IsNullOrEmpty(connection.DataSource))
{
    connection.DataSource = Path.GetFullPath(connection.DataSource, builder.Environment.ContentRootPath);
    Directory.CreateDirectory(Path.GetDirectoryName(connection.DataSource)!);
}

builder.Services.AddDbContext<SunCareDbContext>(options =>
    options.UseSqlite(connection.ToString()));

builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problem = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Dữ liệu không hợp lệ.",
            Detail = "Vui lòng kiểm tra tên bác sĩ và chuyên khoa.",
            Instance = context.HttpContext.Request.Path
        };
        return new BadRequestObjectResult(problem)
        {
            ContentTypes = { "application/problem+json" }
        };
    };
});

builder.Services.AddProblemDetails();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("React", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

// Seed only on first creation. An intentionally empty list stays empty after restart.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SunCareDbContext>();
    if (await db.Database.EnsureCreatedAsync())
    {
        db.Doctors.AddRange(
            new Doctor { Name = "Nguyễn Văn An", Specialty = "Tim mạch" },
            new Doctor { Name = "Trần Thị Bình", Specialty = "Nội khoa" });
        await db.SaveChangesAsync();
    }
}

app.UseExceptionHandler();
app.UseCors("React");
app.MapControllers();

app.Run();
