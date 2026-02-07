namespace Routine.Bot.Models;

public class UserProfile
{
    public long Id { get; set; }
    public long TelegramUserId { get; set; }
    public string? Username { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }

    public ICollection<Goal> Goals { get; set; }
    public ICollection<Note> Notes { get; set; }
}
