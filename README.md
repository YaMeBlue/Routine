# Routine Telegram Diary Bot

A .NET 8 Telegram bot that acts as a personal diary and structured planning assistant. It accepts text or voice messages, classifies them into goal periods (urgent, through day, daily, weekly, monthly, life), and stores goals and notes in SQLite.

## Features
- Text + voice intake (voice is transcribed with OpenAI Whisper if configured).
- AI classification into goal periods using OpenAI Chat Completions (fallback to heuristics).
- Commands to list goals and notes with filtering.

## Configuration
Create `Routine.Bot/appsettings.json` or set environment variables:

```json
{
  "Telegram": {
    "BotToken": "<YOUR_TOKEN>"
  },
  "OpenAI": {
    "ApiKey": "<OPTIONAL>",
    "Model": "gpt-4o-mini",
    "BaseUrl": "https://api.openai.com/v1"
  },
  "ConnectionStrings": {
    "Routine": "Data Source=routine.db"
  }
}
```

Environment variable equivalents:
- `Telegram__BotToken`
- `OpenAI__ApiKey`
- `OpenAI__Model`
- `OpenAI__BaseUrl`
- `ConnectionStrings__Routine`

## Run
```bash
cd Routine.Bot

dotnet restore

dotnet run
```

## Usage
- Send a message like: `invest 3k$ monthly` → stored as monthly goal.
- Send a note like: `note: I feel low energy today` → stored as note.
- Commands:
  - `/goals [period]`
  - `/notes [since-date]`
  - `/goal <period> <text>`
  - `/note <text>`

Example periods: `urgent`, `through_day`, `daily`, `weekly`, `monthly`, `life`.
