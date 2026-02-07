using Microsoft.EntityFrameworkCore;

using Routine.Bot.Models;

namespace Routine.Bot.Infrastructure;

public class RoutineDbContext(DbContextOptions<RoutineDbContext> options) : DbContext(options)
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<ReminderLog> ReminderLogs => Set<ReminderLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserProfile>()
            .HasIndex(profile => profile.TelegramUserId)
            .IsUnique();

        modelBuilder.Entity<UserProfile>()
            .HasMany(profile => profile.Goals)
            .WithOne(goal => goal.UserProfile)
            .HasForeignKey(goal => goal.UserProfileId);

        modelBuilder.Entity<UserProfile>()
            .HasMany(profile => profile.Notes)
            .WithOne(note => note.UserProfile)
            .HasForeignKey(note => note.UserProfileId);

        modelBuilder.Entity<UserProfile>()
            .HasMany(profile => profile.ReminderLogs)
            .WithOne(log => log.UserProfile)
            .HasForeignKey(log => log.UserProfileId);
    }
}
