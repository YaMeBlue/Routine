using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

using Routine.Bot.Infrastructure;

namespace Routine.Bot.Services;

public class DatabaseInitializerService(
    IDbContextFactory<RoutineDbContext> dbContextFactory,
    ILogger<DatabaseInitializerService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);
        await dbContext.Database.EnsureCreatedAsync(cancellationToken);
        logger.LogInformation("Database ensured.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
