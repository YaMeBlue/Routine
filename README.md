# Routine Dashboard

A .NET 8 backend with a React + TypeScript dashboard for managing goals and plans. Users sign in with Telegram, review and delete their items, and receive reminder notifications from the Telegram bot.

## Features
- React + TypeScript dashboard with tabs for goals and plans.
- Telegram login for web authentication.
- Telegram bot notifications for daily/weekly/monthly reminders.

## Configuration
Create `Routine.Bot/appsettings.json` or set environment variables:

```json
{
  "Telegram": {
    "BotToken": "<YOUR_TOKEN>",
    "BotUsername": "<YOUR_BOT_USERNAME>"
  },
  "ConnectionStrings": {
    "Routine": "Data Source=routine.db"
  },
  "Reminders": {
    "DailyTime": "21:00",
    "WeeklyTime": "21:00",
    "MonthlyTime": "21:00",
    "WeeklyDay": "Sunday"
  },
  "Frontend": {
    "Origins": ["http://localhost:5173"]
  }
}
```

Environment variable equivalents:
- `Telegram__BotToken`
- `Telegram__BotUsername`
- `ConnectionStrings__Routine`
- `Reminders__DailyTime`
- `Reminders__WeeklyTime`
- `Reminders__MonthlyTime`
- `Reminders__WeeklyDay`
- `Frontend__Origins__0`

## Run backend
```bash
cd Routine.Bot

dotnet restore

dotnet run
```

## Run frontend
```bash
cd Routine.Bot/ClientApp

npm install

npm run dev
```
