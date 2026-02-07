using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using Routine.Bot.Models;

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Routine.Bot.Services;

public class AiClassifier(HttpClient httpClient, IConfiguration configuration, ILogger<AiClassifier> logger)
{
    private readonly string? _apiKey = configuration["OpenAI:ApiKey"];
    private readonly string _model = configuration["OpenAI:Model"] ?? "gpt-4o-mini";
    private readonly string _baseUrl = configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/v1";

    public async Task<AiClassificationResult> ClassifyAsync(string input, CancellationToken cancellationToken)
    {
        var trimmed = input.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return new AiClassificationResult(false, null, string.Empty);
        }

        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            var aiResult = await TryAiClassificationAsync(trimmed, cancellationToken);
            if (aiResult is not null)
            {
                return aiResult;
            }
        }

        return HeuristicClassification(trimmed);
    }

    private async Task<AiClassificationResult?> TryAiClassificationAsync(string input, CancellationToken cancellationToken)
    {
        try
        {
            var request = new ChatCompletionRequest(
                _model,
                [
                    new("system",
                        "You are a planner assistant for a diary bot. " +
                        "Classify messages into goal or note by context, including Russian text. " +
                        "If it is a goal, pick one period: urgent, through_day, daily, weekly, monthly, life. " +
                        "Infer the period from context (today, this week, monthly, etc). " +
                        "If no explicit period is present but it is clearly a goal, default to through_day. " +
                        "Return compact JSON with keys: isGoal (bool), period (string|null), text (string)."),
                    new("user", input)
                ],
                new ChatResponseFormat("json_object"));

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl.TrimEnd('/')}/chat/completions");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            httpRequest.Content = JsonContent.Create(request);

            var response = await httpClient.SendAsync(httpRequest, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("OpenAI classification failed with status {Status}", response.StatusCode);
                return null;
            }

            var payload = await response.Content.ReadFromJsonAsync<ChatCompletionResponse>(cancellationToken: cancellationToken);
            var content = payload?.Choices.FirstOrDefault()?.Message?.Content;
            if (string.IsNullOrWhiteSpace(content))
            {
                return null;
            }

            var result = JsonSerializer.Deserialize<AiResponse>(content);
            if (result is null || string.IsNullOrWhiteSpace(result.Text))
            {
                return null;
            }

            return new AiClassificationResult(
                result.IsGoal,
                ParsePeriod(result.Period),
                result.Text.Trim());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OpenAI classification failed");
            return null;
        }
    }

    private static AiClassificationResult HeuristicClassification(string input)
    {
        if (input.StartsWith("note:", StringComparison.OrdinalIgnoreCase))
        {
            return new AiClassificationResult(false, null, input[5..].Trim());
        }

        var lower = input.ToLowerInvariant();
        if (lower.StartsWith("заметка:"))
        {
            return new AiClassificationResult(false, null, input[8..].Trim());
        }

        if (LooksLikeNote(lower))
        {
            return new AiClassificationResult(false, null, input);
        }

        var period = FindPeriod(lower);
        var isGoal = period is not null || LooksLikeGoal(lower);

        if (isGoal)
        {
            period ??= PlanPeriod.ThroughDay;
            return new AiClassificationResult(isGoal, period, input);
        }

        return new AiClassificationResult(isGoal, period, input);
    }

    private static PlanPeriod? FindPeriod(string input)
    {
        if (input.Contains("urgent")) return PlanPeriod.Urgent;
        if (input.Contains("срочно")) return PlanPeriod.Urgent;
        if (input.Contains("through day") || input.Contains("through-day") || input.Contains("today") || input.Contains("сегодня")) return PlanPeriod.ThroughDay;
        if (input.Contains("daily") || input.Contains("every day") || input.Contains("каждый день") || input.Contains("ежедневно")) return PlanPeriod.Daily;
        if (input.Contains("weekly") || input.Contains("every week") || input.Contains("каждую неделю") || input.Contains("еженедельно") || input.Contains("на этой неделе")) return PlanPeriod.Weekly;
        if (input.Contains("monthly") || input.Contains("every month") || input.Contains("каждый месяц") || input.Contains("ежемесячно") || input.Contains("в этом месяце")) return PlanPeriod.Monthly;
        if (input.Contains("life") || input.Contains("long term") || input.Contains("long-term")) return PlanPeriod.Life;
        return null;
    }

    private static bool LooksLikeNote(string input)
    {
        return input.Contains("i feel") ||
               input.Contains("mood") ||
               input.Contains("feeling") ||
               input.Contains("journal") ||
               input.Contains("reflection") ||
               input.Contains("заметка") ||
               input.Contains("мысл") ||
               input.Contains("наблюден") ||
               input.Contains("чувств") ||
               input.Contains("настроен") ||
               input.Contains("дневник") ||
               input.Contains("итоги") ||
               input.Contains("сегодня было") ||
               input.Contains("сегодня я");
    }

    private static bool LooksLikeGoal(string input)
    {
        return input.Contains("need to") ||
               input.Contains("i need") ||
               input.Contains("i have to") ||
               input.Contains("plan to") ||
               input.Contains("todo") ||
               input.Contains("task") ||
               input.Contains("goal") ||
               input.Contains("надо") ||
               input.Contains("нужно") ||
               input.Contains("хочу") ||
               input.Contains("план") ||
               input.Contains("сделать") ||
               input.Contains("купить") ||
               input.Contains("позвонить") ||
               input.Contains("написать") ||
               input.Contains("подготовить") ||
               input.Contains("записаться") ||
               input.Contains("отправить") ||
               input.Contains("сегодня") ||
               input.Contains("завтра");
    }

    private static PlanPeriod? ParsePeriod(string? period)
    {
        return period?.Trim().ToLowerInvariant() switch
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

    private sealed record ChatCompletionRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("messages")] IReadOnlyList<ChatMessage> Messages,
        [property: JsonPropertyName("response_format")] ChatResponseFormat ResponseFormat);

    private sealed record ChatMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private sealed record ChatResponseFormat(
        [property: JsonPropertyName("type")] string Type);

    private sealed record ChatCompletionResponse(
        [property: JsonPropertyName("choices")] IReadOnlyList<ChatChoice> Choices);

    private sealed record ChatChoice(
        [property: JsonPropertyName("message")] ChatMessageContent Message);

    private sealed record ChatMessageContent(
        [property: JsonPropertyName("content")] string Content);

    private sealed record AiResponse(
        [property: JsonPropertyName("isGoal")] bool IsGoal,
        [property: JsonPropertyName("period")] string? Period,
        [property: JsonPropertyName("text")] string Text);
}
