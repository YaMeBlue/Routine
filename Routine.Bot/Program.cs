using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

using Routine.Bot.Contracts;
using Routine.Bot.Infrastructure;
using Routine.Bot.Models;
using Routine.Bot.Services;

using Telegram.Bot;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
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
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var origins = configuration.GetSection("Frontend:Origins").Get<string[]>()
            ?? ["http://localhost:5173"];
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors("Frontend");
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
        var botToken = config["Telegram:BotToken"];
        if (string.IsNullOrWhiteSpace(botToken) || !IsTelegramAuthValid(request, botToken))
        {
            return Results.Unauthorized();
        }

        var authDate = DateTimeOffset.FromUnixTimeSeconds(request.AuthDate);
        if (DateTimeOffset.UtcNow - authDate > TimeSpan.FromDays(1))
        {
            return Results.Unauthorized();
        }

        await using var dbContext = await dbContextFactory.CreateDbContextAsync();
        var profile = await dbContext.UserProfiles
            .FirstOrDefaultAsync(user => user.TelegramUserId == request.Id);

        if (profile is null)
        {
            profile = new UserProfile
            {
                TelegramUserId = request.Id,
                Username = request.Username,
                FirstName = request.FirstName,
                LastName = request.LastName
            };

            dbContext.UserProfiles.Add(profile);
        }
        else
        {
            profile.Username = request.Username;
            profile.FirstName = request.FirstName;
            profile.LastName = request.LastName;
        }

        await dbContext.SaveChangesAsync();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, request.Id.ToString()),
            new(ClaimTypes.Name, request.Username ?? request.FirstName ?? request.Id.ToString())
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));

        return Results.Ok(new { request.Id, request.Username, request.FirstName, request.LastName });
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

static bool IsTelegramAuthValid(TelegramAuthRequest request, string botToken)
{
    if (string.IsNullOrWhiteSpace(request.Hash))
    {
        return false;
    }

    var key = SHA256.HashData(Encoding.UTF8.GetBytes(botToken));
    var dataCheckString = request.ToDataCheckString();
    using var hmac = new HMACSHA256(key);
    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(dataCheckString));
    var hex = Convert.ToHexString(hash).ToLowerInvariant();
    return hex == request.Hash;
}
