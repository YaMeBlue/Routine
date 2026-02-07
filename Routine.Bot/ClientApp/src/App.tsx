import { useCallback, useEffect, useMemo, useState } from "react";
import { api, GoalItem, PlanItem, UserProfile } from "./api";

const tabs = ["Цели", "Планы", "Добавить", "Дашборд", "Обновления"] as const;

type TabKey = (typeof tabs)[number];

type TelegramAuthPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type GoalPlanType = "goal" | "plan";

type HistoryEntryType = "update" | "chat" | "tag" | "progress";

type ChatMessage = {
  id: string;
  author: "user" | "assistant";
  text: string;
  timestamp: string;
};

type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  title: string;
  detail?: string;
  timestamp: string;
  messages?: ChatMessage[];
};

type GoalPlanRecord = {
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

const tagPalette = [
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

const tagTextPalette = [
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

const periodBuckets = [
  { key: "day", label: "Сегодня" },
  { key: "week", label: "На неделю" },
  { key: "month", label: "На месяц" },
  { key: "year", label: "На год" },
  { key: "life", label: "На жизнь" }
] as const;

type PeriodBucketKey = (typeof periodBuckets)[number]["key"];

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getTagStyle = (tag: string) => {
  const index = hashString(tag) % tagPalette.length;
  return {
    background: tagPalette[index],
    color: tagTextPalette[index]
  };
};

const createId = () => Math.random().toString(36).slice(2, 10);

const buildDefaultTags = (title: string, kind: GoalPlanType) => {
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 2);
  const base = kind === "goal" ? "цель" : "план";
  return Array.from(new Set([base, ...words]));
};

const getBucketKey = (period: string): PeriodBucketKey => {
  const value = period.toLowerCase();
  if (value.includes("день") || value.includes("сегодня")) {
    return "day";
  }
  if (value.includes("нед")) {
    return "week";
  }
  if (value.includes("месяц")) {
    return "month";
  }
  if (value.includes("год")) {
    return "year";
  }
  return "life";
};

const normalizePeriodLabel = (period: string) => {
  const key = getBucketKey(period);
  const bucket = periodBuckets.find((item) => item.key === key);
  return bucket ? bucket.label : period;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [botUsername, setBotUsername] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabKey>("Цели");
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [records, setRecords] = useState<GoalPlanRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null
  );
  const [progressInput, setProgressInput] = useState<string>("");
  const [progressTargetId, setProgressTargetId] = useState<string>("");
  const [addForm, setAddForm] = useState({
    kind: "goal" as GoalPlanType,
    title: "",
    period: "На неделю",
    tags: "",
    description: ""
  });
  const [chatInput, setChatInput] = useState<string>("");

  const loadProfile = useCallback(async () => {
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const config = await api.getConfig();
      setBotUsername(config.telegramBotUsername);
    } catch {
      setBotUsername("");
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const [goalsResponse, plansResponse] = await Promise.all([
        api.getGoals(),
        api.getPlans()
      ]);
      setGoals(goalsResponse);
      setPlans(plansResponse);
    } catch (error) {
      setStatus("Не удалось загрузить данные. Попробуй еще раз.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadConfig();
    loadProfile();
  }, [loadConfig, loadProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!botUsername) {
      return;
    }

    const container = document.getElementById("telegram-login");
    if (!container) {
      return;
    }

    container.innerHTML = "";

    window.onTelegramAuth = async (payload: TelegramAuthPayload) => {
      try {
        await api.loginWithTelegram(payload);
        await loadProfile();
        await loadData();
      } catch {
        setStatus("Авторизация не удалась. Проверь настройки Telegram.");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");

    container.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [botUsername, loadData, loadProfile]);

  useEffect(() => {
    const apiRecords: GoalPlanRecord[] = [
      ...goals.map((goal) => ({
        id: `goal-${goal.id}`,
        source: "api" as const,
        kind: "goal" as const,
        title: goal.text,
        period: goal.period,
        createdAt: goal.createdAt,
        progress: 0,
        tags: buildDefaultTags(goal.text, "goal"),
        description: "",
        history: [],
        chats: []
      })),
      ...plans.map((plan) => ({
        id: `plan-${plan.id}`,
        source: "api" as const,
        kind: "plan" as const,
        title: plan.text,
        period: plan.period,
        createdAt: plan.createdAt,
        progress: 0,
        tags: buildDefaultTags(plan.text, "plan"),
        description: "",
        history: [],
        chats: []
      }))
    ];

    setRecords((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      const merged = apiRecords.map((item) => {
        const existing = map.get(item.id);
        if (!existing) {
          return item;
        }
        return {
          ...item,
          progress: existing.progress,
          tags: existing.tags.length ? existing.tags : item.tags,
          description: existing.description ?? item.description,
          history: existing.history,
          chats: existing.chats
        };
      });
      const local = prev.filter((item) => item.source === "local");
      return [...merged, ...local];
    });
  }, [goals, plans]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setGoals([]);
    setPlans([]);
    setRecords([]);
  };

  const handleDeleteRecord = async (item: GoalPlanRecord) => {
    try {
      if (item.source === "api") {
        if (item.kind === "goal") {
          await api.deleteGoal(Number(item.id.replace("goal-", "")));
          setGoals((prev) =>
            prev.filter((goal) => `goal-${goal.id}` !== item.id)
          );
        } else {
          await api.deletePlan(Number(item.id.replace("plan-", "")));
          setPlans((prev) =>
            prev.filter((plan) => `plan-${plan.id}` !== item.id)
          );
        }
      }
      setRecords((prev) => prev.filter((record) => record.id !== item.id));
    } catch {
      setStatus("Не удалось удалить запись.");
    }
  };

  const handleAddRecord = () => {
    if (!addForm.title.trim()) {
      setStatus("Добавь название цели или плана.");
      return;
    }

    const tags = addForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newRecord: GoalPlanRecord = {
      id: `local-${createId()}`,
      source: "local",
      kind: addForm.kind,
      title: addForm.title.trim(),
      period: addForm.period,
      createdAt: new Date().toISOString(),
      progress: 0,
      tags: tags.length ? tags : buildDefaultTags(addForm.title, addForm.kind),
      description: addForm.description.trim(),
      history: [
        {
          id: createId(),
          type: "update",
          title: "Создана новая запись",
          detail: "Запись добавлена пользователем вручную.",
          timestamp: new Date().toISOString()
        }
      ],
      chats: []
    };

    setRecords((prev) => [newRecord, ...prev]);
    setAddForm({
      kind: "goal",
      title: "",
      period: "На неделю",
      tags: "",
      description: ""
    });
    setActiveTab(addForm.kind === "goal" ? "Цели" : "Планы");
  };

  const handleOpenRecord = (id: string) => {
    setSelectedId(id);
    setSelectedHistoryId(null);
    setChatInput("");
  };

  const handleProgressUpdate = () => {
    if (!progressTargetId) {
      setStatus("Нужно выбрать цель или план.");
      return;
    }
    if (!progressInput.trim()) {
      setStatus("Добавь текстовое обновление прогресса.");
      return;
    }

    const numericMatch = progressInput.match(/(\d{1,3})%?/);
    const delta = numericMatch ? Number(numericMatch[1]) : 5;

    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== progressTargetId) {
          return record;
        }
        const nextProgress = Math.min(100, Math.max(0, delta));
        return {
          ...record,
          progress: nextProgress,
          history: [
            {
              id: createId(),
              type: "progress",
              title: "Обновление прогресса",
              detail: progressInput,
              timestamp: new Date().toISOString()
            },
            ...record.history
          ]
        };
      })
    );

    setProgressInput("");
    setStatus("Обновление учтено.");
  };

  const handleSuggestTarget = (text: string) => {
    const normalized = text.toLowerCase();
    const scored = records.map((record) => {
      const words = record.title.toLowerCase().split(/\s+/);
      const score = words.reduce(
        (acc, word) => (normalized.includes(word) ? acc + 1 : acc),
        0
      );
      return { id: record.id, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0) {
      setProgressTargetId(best.id);
      return;
    }

    if (records.length > 0) {
      setProgressTargetId(records[0].id);
    }
  };

  const handleChatSend = () => {
    if (!selectedId || !chatInput.trim()) {
      return;
    }
    const newMessage: ChatMessage = {
      id: createId(),
      author: "user",
      text: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== selectedId) {
          return record;
        }
        const newHistory: HistoryEntry = {
          id: createId(),
          type: "chat",
          title: "Диалог с ассистентом",
          detail: newMessage.text,
          timestamp: newMessage.timestamp,
          messages: [
            newMessage,
            {
              id: createId(),
              author: "assistant",
              text:
                "Принято! Обновлю прогресс и запомню детали, если понадобится.",
              timestamp: new Date().toISOString()
            }
          ]
        };
        return {
          ...record,
          history: [newHistory, ...record.history],
          chats: [...record.chats, newMessage]
        };
      })
    );

    setChatInput("");
  };

  const goalRecords = useMemo(
    () => records.filter((record) => record.kind === "goal"),
    [records]
  );

  const planRecords = useMemo(
    () => records.filter((record) => record.kind === "plan"),
    [records]
  );

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId]
  );

  const selectedHistory = useMemo(() => {
    if (!selectedRecord || !selectedHistoryId) {
      return null;
    }
    return (
      selectedRecord.history.find((entry) => entry.id === selectedHistoryId) ||
      null
    );
  }, [selectedRecord, selectedHistoryId]);

  const dashboardBuckets = useMemo(() => {
    const initial = periodBuckets.reduce((acc, bucket) => {
      acc[bucket.key] = [] as GoalPlanRecord[];
      return acc;
    }, {} as Record<PeriodBucketKey, GoalPlanRecord[]>);

    records.forEach((record) => {
      const key = getBucketKey(record.period);
      initial[key].push(record);
    });

    return initial;
  }, [records]);

  const tabContent = useMemo(() => {
    if (activeTab === "Цели" || activeTab === "Планы") {
      const list = activeTab === "Цели" ? goalRecords : planRecords;
      return (
        <div className="list">
          {list.length === 0 && !loading && <p>Записей пока нет.</p>}
          {list.map((record) => (
            <div className="card" key={record.id}>
              <div>
                <div className="card-title">{record.title}</div>
                <div className="card-meta">
                  <span>{record.period}</span>
                  <span>·</span>
                  <span>{new Date(record.createdAt).toLocaleString()}</span>
                </div>
                <div className="tag-list">
                  {record.tags.map((tag) => (
                    <span key={tag} className="tag" style={getTagStyle(tag)}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${record.progress}%` }}
                    />
                  </div>
                  <span>{record.progress}%</span>
                </div>
              </div>
              <div className="card-actions">
                <button className="ghost" onClick={() => handleOpenRecord(record.id)}>
                  Открыть
                </button>
                <button className="danger" onClick={() => handleDeleteRecord(record)}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "Добавить") {
      return (
        <div className="form">
          <div className="form-row">
            <label>Тип</label>
            <select
              value={addForm.kind}
              onChange={(event) =>
                setAddForm((prev) => ({
                  ...prev,
                  kind: event.target.value as GoalPlanType
                }))
              }
            >
              <option value="goal">Цель</option>
              <option value="plan">План</option>
            </select>
          </div>
          <div className="form-row">
            <label>Название</label>
            <input
              type="text"
              value={addForm.title}
              onChange={(event) =>
                setAddForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="Например, выучить TypeScript"
            />
          </div>
          <div className="form-row">
            <label>Период</label>
            <select
              value={addForm.period}
              onChange={(event) =>
                setAddForm((prev) => ({
                  ...prev,
                  period: event.target.value
                }))
              }
            >
              {periodBuckets.map((bucket) => (
                <option key={bucket.key} value={bucket.label}>
                  {bucket.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Теги</label>
            <input
              type="text"
              value={addForm.tags}
              onChange={(event) =>
                setAddForm((prev) => ({ ...prev, tags: event.target.value }))
              }
              placeholder="работа, учеба, здоровье"
            />
          </div>
          <div className="form-row">
            <label>Описание</label>
            <textarea
              value={addForm.description}
              onChange={(event) =>
                setAddForm((prev) => ({
                  ...prev,
                  description: event.target.value
                }))
              }
              placeholder="Дополнительные детали цели или плана"
            />
          </div>
          <button onClick={handleAddRecord}>Добавить запись</button>
        </div>
      );
    }

    if (activeTab === "Дашборд") {
      return (
        <div className="dashboard-grid">
          {periodBuckets.map((bucket) => (
            <div key={bucket.key} className="section">
              <div className="section-header">
                <h3>{bucket.label}</h3>
                <span>{dashboardBuckets[bucket.key].length} задач</span>
              </div>
              <div className="tile-grid">
                {dashboardBuckets[bucket.key].length === 0 && (
                  <div className="tile empty">Нет записей</div>
                )}
                {dashboardBuckets[bucket.key].map((record) => (
                  <button
                    key={record.id}
                    className="tile"
                    onClick={() => handleOpenRecord(record.id)}
                  >
                    <div className="tile-title">{record.title}</div>
                    <div className="progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${record.progress}%` }}
                        />
                      </div>
                      <span>{record.progress}%</span>
                    </div>
                    <div className="tag-list">
                      {record.tags.map((tag) => (
                        <span key={tag} className="tag" style={getTagStyle(tag)}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="form">
        <div className="form-row">
          <label>Обновление прогресса</label>
          <textarea
            value={progressInput}
            onChange={(event) => {
              const next = event.target.value;
              setProgressInput(next);
              handleSuggestTarget(next);
            }}
            placeholder="Например: закончил первый модуль по аналитике, прогресс 35%"
          />
        </div>
        <div className="form-row">
          <label>Распознанная цель/план</label>
          <select
            value={progressTargetId}
            onChange={(event) => setProgressTargetId(event.target.value)}
          >
            <option value="">Выберите запись</option>
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {record.title} ({record.kind === "goal" ? "цель" : "план"})
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleProgressUpdate}>Сохранить обновление</button>
      </div>
    );
  }, [
    activeTab,
    addForm,
    dashboardBuckets,
    goalRecords,
    loading,
    planRecords,
    progressInput,
    progressTargetId,
    records
  ]);

  return (
    <div className="app">
      <header>
        <div>
          <h1>Routine Dashboard</h1>
          <p>Все цели и планы в одном месте.</p>
        </div>
        {user && (
          <div className="user-info">
            <div>
              <div className="user-name">
                {user.firstName ?? user.username ?? "Пользователь"}
              </div>
              <div className="user-id">Telegram ID: {user.telegramUserId}</div>
            </div>
            <button className="ghost" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        )}
      </header>

      {!user && (
        <section className="auth">
          <h2>Вход через Telegram</h2>
          <p>Подключись, чтобы увидеть свои планы и цели.</p>
          {botUsername ? (
            <div id="telegram-login" />
          ) : (
            <div className="alert">
              Укажи Telegram BotUsername в настройках.
            </div>
          )}
        </section>
      )}

      {user && (
        <section className="dashboard">
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={tab === activeTab ? "tab active" : "tab"}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading && <div className="alert">Загрузка...</div>}
          {status && <div className="alert">{status}</div>}

          {tabContent}
        </section>
      )}

      {selectedRecord && (
        <div className="detail-overlay" onClick={() => setSelectedId(null)}>
          <div
            className="detail-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="detail-main">
              <div className="detail-header">
                <div>
                  <h2>{selectedRecord.title}</h2>
                  <p>
                    {selectedRecord.kind === "goal" ? "Цель" : "План"} ·{" "}
                    {normalizePeriodLabel(selectedRecord.period)}
                  </p>
                </div>
                <button className="ghost" onClick={() => setSelectedId(null)}>
                  Закрыть
                </button>
              </div>

              <div className="tag-list">
                {selectedRecord.tags.map((tag) => (
                  <span key={tag} className="tag" style={getTagStyle(tag)}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="progress detail-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${selectedRecord.progress}%` }}
                  />
                </div>
                <span>{selectedRecord.progress}%</span>
              </div>

              {selectedRecord.description && (
                <p className="detail-description">
                  {selectedRecord.description}
                </p>
              )}

              <div className="detail-section">
                <h3>Что сделано</h3>
                <ul>
                  {selectedRecord.history
                    .filter((entry) => entry.type === "progress")
                    .slice(0, 4)
                    .map((entry) => (
                      <li key={entry.id}>{entry.detail}</li>
                    ))}
                  {selectedRecord.history.filter(
                    (entry) => entry.type === "progress"
                  ).length === 0 && <li>Пока нет обновлений.</li>}
                </ul>
              </div>

              <div className="detail-section">
                <h3>Диалог с ассистентом</h3>
                <div className="chat-box">
                  {selectedRecord.history
                    .filter((entry) => entry.type === "chat")
                    .slice(0, 3)
                    .map((entry) => (
                      <div key={entry.id} className="chat-snippet">
                        <strong>{entry.messages?.[0]?.author === "user" ? "Вы" : "Ассистент"}:</strong>{" "}
                        {entry.detail}
                      </div>
                    ))}
                  {selectedRecord.history.filter((entry) => entry.type === "chat")
                    .length === 0 && <p>История диалога пока пуста.</p>}
                </div>
                <div className="chat-input">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Напишите сообщение ассистенту"
                  />
                  <button onClick={handleChatSend}>Отправить</button>
                </div>
              </div>
            </div>

            <div className="detail-history">
              <h3>История</h3>
              <div className="history-list">
                {selectedRecord.history.length === 0 && (
                  <div className="history-empty">История пока пуста.</div>
                )}
                {selectedRecord.history.map((entry) => (
                  <button
                    key={entry.id}
                    className={
                      entry.id === selectedHistoryId
                        ? "history-item active"
                        : "history-item"
                    }
                    onClick={() => setSelectedHistoryId(entry.id)}
                  >
                    <div className="history-title">{entry.title}</div>
                    <div className="history-meta">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
              {selectedHistory && (
                <div className="history-preview">
                  <h4>{selectedHistory.title}</h4>
                  <p>{selectedHistory.detail}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
