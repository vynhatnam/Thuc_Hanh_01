using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SunCareApi.Data;

namespace SunCareApi.Migrations;

[DbContext(typeof(SunCareDbContext))]
public class SunCareDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder) =>
        InitialAuthentication.BuildInitialModel(modelBuilder);
}
