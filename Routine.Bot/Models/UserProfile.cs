namespace Routine.Bot.Models;

public class UserProfile
{
    public long Id { get; set; }
    public long TelegramUserId { get; set; }
    public string? Username { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }

    public ICollection<Goal> Goals { get; set; } = new List<Goal>();
    public ICollection<Plan> Plans { get; set; } = new List<Plan>();
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<ReminderLog> ReminderLogs { get; set; } = new List<ReminderLog>();
}
