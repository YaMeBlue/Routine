using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Routine.Bot.Services;

public class VoiceTranscriber(HttpClient httpClient, IConfiguration configuration, ILogger<VoiceTranscriber> logger)
{
    private readonly string? _apiKey = configuration["OpenAI:ApiKey"];
    private readonly string _baseUrl = configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/v1";

    public async Task<string?> TranscribeAsync(Stream audio, string fileName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            return null;
        }

        try
        {
            using var form = new MultipartFormDataContent();
            var streamContent = new StreamContent(audio);
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("audio/ogg");
            form.Add(streamContent, "file", fileName);
            form.Add(new StringContent("whisper-1"), "model");

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl.TrimEnd('/')}/audio/transcriptions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = form;

            var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("OpenAI transcription failed with status {Status}", response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
            if (json.TryGetProperty("text", out var text))
            {
                return text.GetString();
            }

            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OpenAI transcription failed");
            return null;
        }
    }
}
