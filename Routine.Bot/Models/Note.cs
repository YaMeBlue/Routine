namespace Routine.Bot.Models;

public class Note
{
    public long Id { get; set; }
    public long UserProfileId { get; set; }
    public UserProfile? UserProfile { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
