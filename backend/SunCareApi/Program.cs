using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SunCareApi.Data;
using SunCareApi.Models;
using SunCareApi.Auth;

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
            Detail = "Vui lòng kiểm tra các trường thông tin.",
            Instance = context.HttpContext.Request.Path
        };
        return new BadRequestObjectResult(problem)
        {
            ContentTypes = { "application/problem+json" }
        };
    };
});

builder.Services.AddProblemDetails();
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddAuthentication(SessionAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(
        SessionAuthenticationHandler.SchemeName, _ => { });
builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("React", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SunCareDbContext>();
    await DatabaseInitializer.InitializeAsync(db);
}

app.UseExceptionHandler();
app.UseCors("React");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
