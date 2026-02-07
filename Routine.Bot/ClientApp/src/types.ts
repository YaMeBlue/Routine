export type TelegramAuthPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export type GoalPlanType = "goal" | "plan";

export type HistoryEntryType = "update" | "chat" | "tag" | "progress";

export type ChatMessage = {
  id: string;
  author: "user" | "assistant";
  text: string;
  timestamp: string;
};

export type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  title: string;
  detail?: string;
  timestamp: string;
  messages?: ChatMessage[];
};

export type GoalPlanRecord = {
  id: string;
  source: "api" | "local";
  kind: GoalPlanType;
  title: string;
  period: string;
  createdAt: string;
  progress: number;
  tags: string[];
  description?: string;
  history: HistoryEntry[];
  chats: ChatMessage[];
};

export type PeriodBucketKey =
  | "day"
  | "week"
  | "month"
  | "year"
  | "life";

export type TabKey = "Цели" | "Планы" | "Добавить" | "Дашборд" | "Обновления";

export type AddFormState = {
  kind: GoalPlanType;
  title: string;
  period: string;
  tags: string;
  description: string;
};
