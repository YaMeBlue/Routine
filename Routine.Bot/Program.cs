using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

using Routine.Bot.Contracts;
using Routine.Bot.Infrastructure;
using Routine.Bot.Models;
using Routine.Bot.Services;

using System.Security.Claims;

using Telegram.Bot;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile("appsettings.dev.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables();

var configuration = builder.Configuration;
var token = configuration["Telegram:BotToken"];
if (string.IsNullOrWhiteSpace(token))
{
    throw new InvalidOperationException("Telegram BotToken is missing in configuration.");
}

builder.Services.AddDbContextFactory<RoutineDbContext>(options =>
    options.UseSqlite(configuration.GetConnectionString("Routine")));

builder.Services.Configure<ReminderOptions>(configuration.GetSection("Reminders"));

builder.Services.AddSingleton<ITelegramBotClient>(_ => new TelegramBotClient(token));

builder.Services.AddHostedService<DatabaseInitializerService>();
builder.Services.AddHostedService<ReminderService>();

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "routine.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Unspecified;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);

        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };

        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/config", (IConfiguration config) => Results.Ok(new
    {
        telegramBotUsername = config["Telegram:BotUsername"] ?? string.Empty
    }))
    .AllowAnonymous();

app.MapPost("/api/auth/telegram", async (
        TelegramAuthRequest request,
        IDbContextFactory<RoutineDbContext> dbContextFactory,
        IConfiguration config,
        HttpContext httpContext) =>
    {
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var profile = await dbContext.UserProfiles
            .FirstOrDefaultAsync(user => user.TelegramUserId == request.id);

        if (profile is null)
        {
            profile = new UserProfile
            {
                TelegramUserId = request.id,
                Username = request.username,
                FirstName = request.first_name,
                LastName = request.last_name
            };

            dbContext.UserProfiles.Add(profile);
        }
        else
        {
            profile.Username = request.username;
            profile.FirstName = request.first_name;
            profile.LastName = request.last_name;
        }

        await dbContext.SaveChangesAsync();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, request.id.ToString()),
            new(ClaimTypes.Name, request.username ?? request.first_name ?? request.id.ToString())
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));

        return Results.Ok(new { request.id, request.username, request.first_name, request.last_name });
    })
    .AllowAnonymous();

app.MapPost("/api/auth/logout", async (HttpContext httpContext) =>
    {
        await httpContext.SignOutAsync();
        return Results.NoContent();
    })
    .RequireAuthorization();

app.MapGet("/api/me", async (
        ClaimsPrincipal user,
        IDbContextFactory<RoutineDbContext> dbContextFactory) =>
    {
        var telegramUserId = GetTelegramUserId(user);
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var profile = await dbContext.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(entry => entry.TelegramUserId == telegramUserId);

        return profile is null
            ? Results.NotFound()
            : Results.Ok(new
            {
                profile.TelegramUserId,
                profile.Username,
                profile.FirstName,
                profile.LastName
            });
    })
    .RequireAuthorization();

app.MapGet("/api/goals", async (
        ClaimsPrincipal user,
        IDbContextFactory<RoutineDbContext> dbContextFactory) =>
    {
        var telegramUserId = GetTelegramUserId(user);
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var goals = await dbContext.Goals
            .AsNoTracking()
            .Where(goal => goal.UserProfile!.TelegramUserId == telegramUserId)
            .OrderByDescending(goal => goal.CreatedAt)
            .Select(goal => new GoalResponse(
                goal.Id,
                goal.Text,
                goal.Period.ToString(),
                goal.CreatedAt))
            .ToListAsync();

        return Results.Ok(goals);
    })
    .RequireAuthorization();

app.MapDelete("/api/goals/{id:long}", async (
        long id,
        ClaimsPrincipal user,
        IDbContextFactory<RoutineDbContext> dbContextFactory) =>
    {
        var telegramUserId = GetTelegramUserId(user);
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var goal = await dbContext.Goals
            .FirstOrDefaultAsync(entry => entry.Id == id && entry.UserProfile!.TelegramUserId == telegramUserId);

        if (goal is null)
        {
            return Results.NotFound();
        }

        dbContext.Goals.Remove(goal);
        await dbContext.SaveChangesAsync();
        return Results.NoContent();
    })
    .RequireAuthorization();

app.MapGet("/api/plans", async (
        ClaimsPrincipal user,
        IDbContextFactory<RoutineDbContext> dbContextFactory) =>
    {
        var telegramUserId = GetTelegramUserId(user);
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var plans = await dbContext.Plans
            .AsNoTracking()
            .Where(plan => plan.UserProfile!.TelegramUserId == telegramUserId)
            .OrderByDescending(plan => plan.CreatedAt)
            .Select(plan => new PlanResponse(
                plan.Id,
                plan.Text,
                plan.Period.ToString(),
                plan.CreatedAt))
            .ToListAsync();

        return Results.Ok(plans);
    })
    .RequireAuthorization();

app.MapDelete("/api/plans/{id:long}", async (
        long id,
        ClaimsPrincipal user,
        IDbContextFactory<RoutineDbContext> dbContextFactory) =>
    {
        var telegramUserId = GetTelegramUserId(user);
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var plan = await dbContext.Plans
            .FirstOrDefaultAsync(entry => entry.Id == id && entry.UserProfile!.TelegramUserId == telegramUserId);

        if (plan is null)
        {
            return Results.NotFound();
        }

        dbContext.Plans.Remove(plan);
        await dbContext.SaveChangesAsync();
        return Results.NoContent();
    })
    .RequireAuthorization();

app.Run();

static long GetTelegramUserId(ClaimsPrincipal user)
{
    var idValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
    return long.TryParse(idValue, out var id) ? id : 0;
}
