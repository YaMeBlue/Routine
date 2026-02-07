namespace Routine.Bot.Models;

public class ReminderLog
{
    public long Id { get; set; }
    public long UserProfileId { get; set; }
    public UserProfile? UserProfile { get; set; }
    public ReminderScope Scope { get; set; }
    public DateTime LastSentAt { get; set; } = DateTime.Now;
}
