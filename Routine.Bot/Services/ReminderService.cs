using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using Routine.Bot.Infrastructure;
using Routine.Bot.Models;

using Telegram.Bot;

namespace Routine.Bot.Services;

public class ReminderService(
    ITelegramBotClient botClient,
    IDbContextFactory<RoutineDbContext> dbContextFactory,
    IOptions<ReminderOptions> options,
    ILogger<ReminderService> logger) : BackgroundService
{
    private readonly ReminderOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send reminders");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task SendRemindersAsync(CancellationToken cancellationToken)
    {
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;

        var dailyTime = ParseTime(_options.DailyTime, new TimeOnly(21, 0));
        var weeklyTime = ParseTime(_options.WeeklyTime, new TimeOnly(21, 0));
        var monthlyTime = ParseTime(_options.MonthlyTime, new TimeOnly(21, 0));

        var profiles = await dbContext.UserProfiles
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        foreach (var profile in profiles)
        {
            await HandleReminderAsync(dbContext, profile, ReminderScope.Daily, dailyTime, now, cancellationToken);
            await HandleReminderAsync(dbContext, profile, ReminderScope.Weekly, weeklyTime, now, cancellationToken);
            await HandleReminderAsync(dbContext, profile, ReminderScope.Monthly, monthlyTime, now, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task HandleReminderAsync(
        RoutineDbContext dbContext,
        UserProfile profile,
        ReminderScope scope,
        TimeOnly time,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (!IsReminderDue(scope, time, now))
        {
            return;
        }

        var periodStart = GetPeriodStart(scope, now);
        var log = await dbContext.ReminderLogs
            .FirstOrDefaultAsync(entry => entry.UserProfileId == profile.Id && entry.Scope == scope, cancellationToken);

        if (log is not null && log.LastSentAt >= periodStart)
        {
            return;
        }

        var goals = await LoadGoalsAsync(dbContext, profile.Id, scope, periodStart, cancellationToken);
        var plans = await LoadPlansAsync(dbContext, profile.Id, scope, periodStart, cancellationToken);
        if (goals.Count == 0 && plans.Count == 0)
        {
            return;
        }

        var header = scope switch
        {
            ReminderScope.Daily => "Хе-хей! Вот твои планы и цели на сегодня, которые еще не выполнены:",
            ReminderScope.Weekly => "Хе-хей! Вот планы и цели этой недели, которые еще не выполнены:",
            ReminderScope.Monthly => "Хе-хей! Вот планы и цели этого месяца, которые еще не выполнены:",
            _ => "Напоминание о целях и планах:"
        };

        var sections = new List<string>();
        if (plans.Count > 0)
        {
            sections.Add("Планы:\n" + string.Join("\n", plans.Select(plan => $"• [{plan.Period}] {plan.Text}")));
        }

        if (goals.Count > 0)
        {
            sections.Add("Цели:\n" + string.Join("\n", goals.Select(goal => $"• [{goal.Period}] {goal.Text}")));
        }

        var body = string.Join("\n\n", sections);
        await botClient.SendMessage(profile.TelegramUserId, $"{header}\n{body}", cancellationToken: cancellationToken);

        if (log is null)
        {
            dbContext.ReminderLogs.Add(new ReminderLog
            {
                UserProfileId = profile.Id,
                Scope = scope,
                LastSentAt = now
            });
        }
        else
        {
            log.LastSentAt = now;
        }
    }

    private static async Task<List<Goal>> LoadGoalsAsync(
        RoutineDbContext dbContext,
        long profileId,
        ReminderScope scope,
        DateTimeOffset periodStart,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Goals
            .AsNoTracking()
            .Where(goal => goal.UserProfileId == profileId && goal.CreatedAt >= periodStart);

        query = scope switch
        {
            ReminderScope.Daily => query.Where(goal =>
                goal.Period == PlanPeriod.Urgent ||
                goal.Period == PlanPeriod.ThroughDay ||
                goal.Period == PlanPeriod.Daily),
            ReminderScope.Weekly => query.Where(goal => goal.Period == PlanPeriod.Weekly),
            ReminderScope.Monthly => query.Where(goal => goal.Period == PlanPeriod.Monthly),
            _ => query
        };

        return await query
            .OrderByDescending(goal => goal.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);
    }

    private static async Task<List<Plan>> LoadPlansAsync(
        RoutineDbContext dbContext,
        long profileId,
        ReminderScope scope,
        DateTimeOffset periodStart,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Plans
            .AsNoTracking()
            .Where(plan => plan.UserProfileId == profileId && plan.CreatedAt >= periodStart);

        query = scope switch
        {
            ReminderScope.Daily => query.Where(plan =>
                plan.Period == PlanPeriod.Urgent ||
                plan.Period == PlanPeriod.ThroughDay ||
                plan.Period == PlanPeriod.Daily),
            ReminderScope.Weekly => query.Where(plan => plan.Period == PlanPeriod.Weekly),
            ReminderScope.Monthly => query.Where(plan => plan.Period == PlanPeriod.Monthly),
            _ => query
        };

        return await query
            .OrderByDescending(plan => plan.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);
    }

    private bool IsReminderDue(ReminderScope scope, TimeOnly time, DateTimeOffset now)
    {
        var scheduled = now.Date + time.ToTimeSpan();
        if (now < scheduled)
        {
            return false;
        }

        return scope switch
        {
            ReminderScope.Daily => true,
            ReminderScope.Weekly => now.DayOfWeek == _options.WeeklyDay,
            ReminderScope.Monthly => now.Day == DateTime.DaysInMonth(now.Year, now.Month),
            _ => false
        };
    }

    private static DateTimeOffset GetPeriodStart(ReminderScope scope, DateTimeOffset now)
    {
        return scope switch
        {
            ReminderScope.Daily => new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, now.Offset),
            ReminderScope.Weekly => StartOfWeek(now, DayOfWeek.Monday),
            ReminderScope.Monthly => new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, now.Offset),
            _ => now
        };
    }

    private static DateTimeOffset StartOfWeek(DateTimeOffset now, DayOfWeek startOfWeek)
    {
        var diff = (7 + (now.DayOfWeek - startOfWeek)) % 7;
        var date = now.Date.AddDays(-diff);
        return new DateTimeOffset(date, now.Offset);
    }

    private static TimeOnly ParseTime(string? value, TimeOnly fallback)
    {
        return TimeOnly.TryParse(value, out var parsed) ? parsed : fallback;
    }
}
