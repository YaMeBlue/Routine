using Routine.Bot.Models;

namespace Routine.Bot.Services;

public sealed record AiClassificationResult(
    bool IsGoal,
    PlanPeriod? Period,
    string Text
);
