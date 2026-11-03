using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SunCareApi.Data;

namespace SunCareApi.Migrations;

[DbContext(typeof(SunCareDbContext))]
[Migration("202611030001_InitialAuthentication")]
public class InitialAuthentication : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Adopt the Doctors table created with EnsureCreated in exercise 2 without losing its rows.
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "Doctors" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Doctors" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL,
                "Specialty" TEXT NOT NULL
            );
            """);

        migrationBuilder.CreateTable("Users", columns: table => new
        {
            Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
            Email = table.Column<string>(type: "TEXT", maxLength: 254, nullable: false),
            NormalizedEmail = table.Column<string>(type: "TEXT", maxLength: 254, nullable: false),
            PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
            CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
        }, constraints: table => table.PrimaryKey("PK_Users", user => user.Id));

        migrationBuilder.CreateTable("AuthSessions", columns: table => new
        {
            TokenHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
            UserId = table.Column<int>(type: "INTEGER", nullable: false),
            ExpiresAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_AuthSessions", session => session.TokenHash);
            table.ForeignKey("FK_AuthSessions_Users_UserId", session => session.UserId,
                "Users", "Id", onDelete: ReferentialAction.Cascade);
        });
        migrationBuilder.CreateIndex("IX_Users_NormalizedEmail", "Users", "NormalizedEmail", unique: true);
        migrationBuilder.CreateIndex("IX_AuthSessions_UserId", "AuthSessions", "UserId");
        migrationBuilder.CreateIndex("IX_AuthSessions_ExpiresAtUtc", "AuthSessions", "ExpiresAtUtc");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("AuthSessions");
        migrationBuilder.DropTable("Users");
        // Doctors belongs to the previous exercise and is intentionally preserved.
    }

    protected override void BuildTargetModel(ModelBuilder modelBuilder) =>
        BuildInitialModel(modelBuilder);

    // Freeze this migration's model independently of future generated snapshots.
    internal static void BuildInitialModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.14");
        modelBuilder.Entity("SunCareApi.Models.Doctor", entity =>
        {
            entity.Property<int>("Id").ValueGeneratedOnAdd().HasColumnType("INTEGER");
            entity.Property<string>("Name").IsRequired().HasMaxLength(100).HasColumnType("TEXT");
            entity.Property<string>("Specialty").IsRequired().HasMaxLength(100).HasColumnType("TEXT");
            entity.HasKey("Id");
            entity.ToTable("Doctors");
        });
        modelBuilder.Entity("SunCareApi.Models.AppUser", entity =>
        {
            entity.Property<int>("Id").ValueGeneratedOnAdd().HasColumnType("INTEGER");
            entity.Property<string>("Email").IsRequired().HasMaxLength(254).HasColumnType("TEXT");
            entity.Property<string>("NormalizedEmail").IsRequired().HasMaxLength(254).HasColumnType("TEXT");
            entity.Property<string>("PasswordHash").IsRequired().HasColumnType("TEXT");
            entity.Property<DateTime>("CreatedAtUtc").HasColumnType("TEXT");
            entity.HasKey("Id");
            entity.HasIndex("NormalizedEmail").IsUnique();
            entity.ToTable("Users");
        });
        modelBuilder.Entity("SunCareApi.Models.AuthSession", entity =>
        {
            entity.Property<string>("TokenHash").HasMaxLength(64).HasColumnType("TEXT");
            entity.Property<int>("UserId").HasColumnType("INTEGER");
            entity.Property<DateTime>("ExpiresAtUtc").HasColumnType("TEXT");
            entity.HasKey("TokenHash");
            entity.HasIndex("UserId");
            entity.HasIndex("ExpiresAtUtc");
            entity.ToTable("AuthSessions");
            entity.HasOne("SunCareApi.Models.AppUser", "User").WithMany().HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.Cascade).IsRequired();
            entity.Navigation("User");
        });
    }
}
