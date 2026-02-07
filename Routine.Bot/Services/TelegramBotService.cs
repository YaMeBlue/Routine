using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Routine.Bot.Infrastructure;
using Routine.Bot.Models;
using Telegram.Bot;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace Routine.Bot.Services;

public class TelegramBotService : BackgroundService
{
    private readonly ITelegramBotClient _botClient;
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TelegramBotService> _logger;
    private readonly AiClassifier _classifier;
    private readonly VoiceTranscriber _transcriber;

    public TelegramBotService(
        ITelegramBotClient botClient,
        IConfiguration configuration,
        IServiceProvider serviceProvider,
        ILogger<TelegramBotService> logger,
        AiClassifier classifier,
        VoiceTranscriber transcriber)
    {
        _botClient = botClient;
        _configuration = configuration;
        _serviceProvider = serviceProvider;
        _logger = logger;
        _classifier = classifier;
        _transcriber = transcriber;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var receiverOptions = new ReceiverOptions
        {
            AllowedUpdates = new[] { UpdateType.Message }
        };

        _botClient.StartReceiving(HandleUpdateAsync, HandleErrorAsync, receiverOptions, stoppingToken);
        _logger.LogInformation("Telegram bot is listening");
        return Task.CompletedTask;
    }

    private async Task HandleUpdateAsync(ITelegramBotClient botClient, Update update, CancellationToken cancellationToken)
    {
        if (update.Message is not { } message || message.From is null)
        {
            return;
        }

        var userId = message.From.Id;
        var chatId = message.Chat.Id;
        var text = message.Text?.Trim() ?? string.Empty;

        if (message.Type == MessageType.Text && text.StartsWith("/"))
        {
            await HandleCommandAsync(chatId, userId, message.From, text, cancellationToken);
            return;
        }

        var contentText = text;
        if (message.Type == MessageType.Voice && message.Voice is not null)
        {
            contentText = await TranscribeVoiceAsync(message.Voice, cancellationToken) ?? string.Empty;
            if (string.IsNullOrWhiteSpace(contentText))
            {
                await botClient.SendTextMessageAsync(chatId,
                    "I received a voice message but could not transcribe it yet. " +
                    "Please try again or send text.",
                    cancellationToken: cancellationToken);
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(contentText))
        {
            await botClient.SendTextMessageAsync(chatId, "Send text or a voice note.", cancellationToken: cancellationToken);
            return;
        }

        await using var scope = _serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<RoutineDbContext>();
        var profile = await GetOrCreateUserAsync(dbContext, message.From, cancellationToken);

        var classification = await _classifier.ClassifyAsync(contentText, cancellationToken);
        if (classification.IsGoal && classification.Period is not null)
        {
            var goal = new Goal
            {
                UserProfileId = profile.Id,
                Period = classification.Period.Value,
                Text = classification.Text
            };
            dbContext.Goals.Add(goal);
            await dbContext.SaveChangesAsync(cancellationToken);

            await botClient.SendTextMessageAsync(chatId,
                $"Saved goal for {classification.Period.Value}.",
                cancellationToken: cancellationToken);
        }
        else
        {
            var note = new Note
            {
                UserProfileId = profile.Id,
                Text = classification.Text
            };
            dbContext.Notes.Add(note);
            await dbContext.SaveChangesAsync(cancellationToken);

            await botClient.SendTextMessageAsync(chatId,
                "Saved note.",
                cancellationToken: cancellationToken);
        }
    }

    private async Task HandleCommandAsync(long chatId, long userId, User user, string text, CancellationToken cancellationToken)
    {
        var parts = text.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var command = parts[0].ToLowerInvariant();
        var argument = parts.Length > 1 ? parts[1] : string.Empty;

        switch (command)
        {
            case "/start":
            case "/help":
                await _botClient.SendTextMessageAsync(chatId, GetHelpText(), cancellationToken: cancellationToken);
                break;
            case "/goals":
                await SendGoalsAsync(chatId, user, argument, cancellationToken);
                break;
            case "/notes":
                await SendNotesAsync(chatId, user, argument, cancellationToken);
                break;
            case "/note":
                await SaveManualNoteAsync(chatId, user, argument, cancellationToken);
                break;
            case "/goal":
                await SaveManualGoalAsync(chatId, user, argument, cancellationToken);
                break;
            default:
                await _botClient.SendTextMessageAsync(chatId, "Unknown command. Type /help.", cancellationToken: cancellationToken);
                break;
        }
    }

    private async Task SendGoalsAsync(long chatId, User user, string argument, CancellationToken cancellationToken)
    {
        await using var scope = _serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<RoutineDbContext>();
        var profile = await GetOrCreateUserAsync(dbContext, user, cancellationToken);

        var period = ParsePeriod(argument);
        var query = dbContext.Goals.AsNoTracking().Where(goal => goal.UserProfileId == profile.Id);
        if (period is not null)
        {
            query = query.Where(goal => goal.Period == period);
        }

        var goals = await query
            .OrderByDescending(goal => goal.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);

        if (goals.Count == 0)
        {
            await _botClient.SendTextMessageAsync(chatId, "No goals found for that period.", cancellationToken: cancellationToken);
            return;
        }

        var header = period is null ? "Your latest goals:" : $"Your {period} goals:";
        var body = string.Join("\n", goals.Select(goal => $"• [{goal.Period}] {goal.Text}"));
        await _botClient.SendTextMessageAsync(chatId, $"{header}\n{body}", cancellationToken: cancellationToken);
    }

    private async Task SendNotesAsync(long chatId, User user, string argument, CancellationToken cancellationToken)
    {
        await using var scope = _serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<RoutineDbContext>();
        var profile = await GetOrCreateUserAsync(dbContext, user, cancellationToken);

        var query = dbContext.Notes.AsNoTracking().Where(note => note.UserProfileId == profile.Id);
        var notes = await query
            .OrderByDescending(note => note.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(argument) && DateTimeOffset.TryParse(argument, out var since))
        {
            notes = notes.Where(note => note.CreatedAt >= since).ToList();
        }

        if (notes.Count == 0)
        {
            await _botClient.SendTextMessageAsync(chatId, "No notes found.", cancellationToken: cancellationToken);
            return;
        }

        var header = "Your latest notes:";
        var body = string.Join("\n", notes.Select(note => $"• {note.CreatedAt:g} {note.Text}"));
        await _botClient.SendTextMessageAsync(chatId, $"{header}\n{body}", cancellationToken: cancellationToken);
    }

    private async Task SaveManualNoteAsync(long chatId, User user, string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            await _botClient.SendTextMessageAsync(chatId, "Usage: /note I felt great today", cancellationToken: cancellationToken);
            return;
        }

        await using var scope = _serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<RoutineDbContext>();
        var profile = await GetOrCreateUserAsync(dbContext, user, cancellationToken);

        dbContext.Notes.Add(new Note
        {
            UserProfileId = profile.Id,
            Text = text.Trim()
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        await _botClient.SendTextMessageAsync(chatId, "Saved note.", cancellationToken: cancellationToken);
    }

    private async Task SaveManualGoalAsync(long chatId, User user, string argument, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(argument))
        {
            await _botClient.SendTextMessageAsync(chatId,
                "Usage: /goal monthly Invest $3k monthly",
                cancellationToken: cancellationToken);
            return;
        }

        var pieces = argument.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (pieces.Length < 2)
        {
            await _botClient.SendTextMessageAsync(chatId,
                "Usage: /goal monthly Invest $3k monthly",
                cancellationToken: cancellationToken);
            return;
        }

        var period = ParsePeriod(pieces[0]);
        if (period is null)
        {
            await _botClient.SendTextMessageAsync(chatId,
                "Unknown period. Use urgent, through_day, daily, weekly, monthly, life.",
                cancellationToken: cancellationToken);
            return;
        }

        await using var scope = _serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<RoutineDbContext>();
        var profile = await GetOrCreateUserAsync(dbContext, user, cancellationToken);

        dbContext.Goals.Add(new Goal
        {
            UserProfileId = profile.Id,
            Period = period.Value,
            Text = pieces[1].Trim()
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        await _botClient.SendTextMessageAsync(chatId, "Saved goal.", cancellationToken: cancellationToken);
    }

    private async Task<UserProfile> GetOrCreateUserAsync(RoutineDbContext dbContext, User user, CancellationToken cancellationToken)
    {
        var profile = await dbContext.UserProfiles
            .FirstOrDefaultAsync(profile => profile.TelegramUserId == user.Id, cancellationToken);

        if (profile is not null)
        {
            profile.Username = user.Username;
            profile.FirstName = user.FirstName;
            profile.LastName = user.LastName;
            await dbContext.SaveChangesAsync(cancellationToken);
            return profile;
        }

        profile = new UserProfile
        {
            TelegramUserId = user.Id,
            Username = user.Username,
            FirstName = user.FirstName,
            LastName = user.LastName
        };

        dbContext.UserProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);
        return profile;
    }

    private async Task<string?> TranscribeVoiceAsync(Voice voice, CancellationToken cancellationToken)
    {
        var file = await _botClient.GetFileAsync(voice.FileId, cancellationToken);
        await using var stream = new MemoryStream();
        await _botClient.DownloadFileAsync(file.FilePath!, stream, cancellationToken);
        stream.Position = 0;
        return await _transcriber.TranscribeAsync(stream, "voice.ogg", cancellationToken);
    }

    private static PlanPeriod? ParsePeriod(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        return input.Trim().ToLowerInvariant() switch
        {
            "urgent" => PlanPeriod.Urgent,
            "through_day" => PlanPeriod.ThroughDay,
            "through day" => PlanPeriod.ThroughDay,
            "daily" => PlanPeriod.Daily,
            "weekly" => PlanPeriod.Weekly,
            "monthly" => PlanPeriod.Monthly,
            "life" => PlanPeriod.Life,
            _ => null
        };
    }

    private static string GetHelpText()
    {
        return "Send a message or voice note. I will file it as a goal or note.\n" +
               "Commands:\n" +
               "/goals [period] - list goals (urgent, through_day, daily, weekly, monthly, life).\n" +
               "/notes [since date] - list notes (optional ISO date).\n" +
               "/goal <period> <text> - save a goal manually.\n" +
               "/note <text> - save a note manually.";
    }

    private Task HandleErrorAsync(ITelegramBotClient botClient, Exception exception, CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "Telegram bot error");
        return Task.CompletedTask;
    }
}
