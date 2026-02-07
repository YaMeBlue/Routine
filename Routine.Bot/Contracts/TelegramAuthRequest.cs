namespace Routine.Bot.Contracts;

public record TelegramAuthRequest(
    long id,
    string? username,
    string? first_name,
    string? last_name,
    string? photoUrl,
    long auth_date,
    string hash)
{
    public string ToDataCheckString()
    {
        var values = new List<KeyValuePair<string, string?>>
        {
            new("auth_date", auth_date.ToString()),
            new("first_name", first_name ?? string.Empty),
            new("id", id.ToString())
        };

        if (!string.IsNullOrWhiteSpace(last_name))
        {
            values.Add(new("last_name", last_name));
        }

        if (!string.IsNullOrWhiteSpace(photoUrl))
        {
            values.Add(new("photo_url", photoUrl));
        }

        if (!string.IsNullOrWhiteSpace(username))
        {
            values.Add(new("username", username));
        }

        return string.Join("\n", values
            .OrderBy(pair => pair.Key)
            .Select(pair => $"{pair.Key}={pair.Value}"));
    }
}
