namespace Routine.Bot.Services;

public class ReminderOptions
{
    public string DailyTime { get; set; } = "21:00";
    public string WeeklyTime { get; set; } = "21:00";
    public string MonthlyTime { get; set; } = "21:00";
    public DayOfWeek WeeklyDay { get; set; } = DayOfWeek.Sunday;
}
