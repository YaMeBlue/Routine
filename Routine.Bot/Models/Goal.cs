namespace Routine.Bot.Models;

public class Goal
{
    public long Id { get; set; }
    public long UserProfileId { get; set; }
    public UserProfile? UserProfile { get; set; }
    public PlanPeriod Period { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
