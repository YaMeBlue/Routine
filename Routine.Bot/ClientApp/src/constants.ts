export const tabs = ["Цели", "Планы", "Добавить", "Дашборд", "Обновления"] as const;

export const tagPalette = [
  "#fee2e2",
  "#fde68a",
  "#bfdbfe",
  "#c7d2fe",
  "#bbf7d0",
  "#fecdd3",
  "#f5d0fe",
  "#bae6fd",
  "#e2e8f0",
  "#ddd6fe"
];

export const tagTextPalette = [
  "#b91c1c",
  "#92400e",
  "#1d4ed8",
  "#4338ca",
  "#166534",
  "#9f1239",
  "#7e22ce",
  "#075985",
  "#334155",
  "#5b21b6"
];

export const periodBuckets = [
  { key: "day", label: "Сегодня" },
  { key: "week", label: "На неделю" },
  { key: "month", label: "На месяц" },
  { key: "year", label: "На год" },
  { key: "life", label: "На жизнь" }
] as const;
