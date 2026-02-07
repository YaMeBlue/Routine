using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using Routine.Bot.Infrastructure;
using Routine.Bot.Services;

using Telegram.Bot;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((context, config) =>
    {
        config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
        config.AddEnvironmentVariables();
    })
    .ConfigureServices((context, services) =>
    {
        var configuration = context.Configuration;
        var token = configuration["Telegram:BotToken"];
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Telegram BotToken is missing in configuration.");
        }

        services.AddDbContext<RoutineDbContext>(options =>
            options.UseSqlite(configuration.GetConnectionString("Routine")));

        services.AddHttpClient();
        services.AddHttpClient<AiClassifier>();
        services.AddHttpClient<VoiceTranscriber>();

        services.Configure<ReminderOptions>(configuration.GetSection("Reminders"));

        services.AddSingleton<ITelegramBotClient>(_ => new TelegramBotClient(token));
        services.AddSingleton<AiClassifier>();
        services.AddSingleton<VoiceTranscriber>();
        services.AddHostedService<TelegramBotService>();
        services.AddHostedService<ReminderService>();
    })
    .Build();

using (var scope = host.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<RoutineDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
}

await host.RunAsync();
