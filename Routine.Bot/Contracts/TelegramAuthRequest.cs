namespace Routine.Bot.Contracts;

public record TelegramAuthRequest(
    long Id,
    string? Username,
    string? FirstName,
    string? LastName,
    string? PhotoUrl,
    long AuthDate,
    string Hash)
{
    public string ToDataCheckString()
    {
        var values = new List<KeyValuePair<string, string?>>
        {
            new("auth_date", AuthDate.ToString()),
            new("first_name", FirstName ?? string.Empty),
            new("id", Id.ToString())
        };

        if (!string.IsNullOrWhiteSpace(LastName))
        {
            values.Add(new("last_name", LastName));
        }

        if (!string.IsNullOrWhiteSpace(PhotoUrl))
        {
            values.Add(new("photo_url", PhotoUrl));
        }

        if (!string.IsNullOrWhiteSpace(Username))
        {
            values.Add(new("username", Username));
        }

        return string.Join("\n", values
            .OrderBy(pair => pair.Key)
            .Select(pair => $"{pair.Key}={pair.Value}"));
    }
}
