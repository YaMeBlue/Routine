import { useCallback, useEffect, useMemo, useState } from "react";
import { api, GoalItem, PlanItem, UserProfile } from "./api";
import { AuthSection } from "./components/AuthSection";
import { DetailOverlay } from "./components/DetailOverlay";
import { Header } from "./components/Header";
import { AddRecordForm } from "./components/AddRecordForm";
import { RecordsList } from "./components/RecordsList";
import { Dashboard } from "./components/Dashboard";
import { TabsNav } from "./components/TabsNav";
import { UpdatesForm } from "./components/UpdatesForm";
import { periodBuckets, tabs } from "./constants";
import {
  AddFormState,
  GoalPlanRecord,
  GoalPlanType,
  PeriodBucketKey,
  TabKey,
  TelegramAuthPayload
} from "./types";
import {
  buildDefaultTags,
  createId,
  getBucketKey,
  getTagStyle,
  normalizePeriodLabel
} from "./utils";

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
  const [addForm, setAddForm] = useState<AddFormState>({
    kind: "goal",
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
    } catch {
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
    const newMessage = {
      id: createId(),
      author: "user" as const,
      text: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== selectedId) {
          return record;
        }
        const newHistory = {
          id: createId(),
          type: "chat" as const,
          title: "Диалог с ассистентом",
          detail: newMessage.text,
          timestamp: newMessage.timestamp,
          messages: [
            newMessage,
            {
              id: createId(),
              author: "assistant" as const,
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

  const handleProgressInputChange = (value: string) => {
    setProgressInput(value);
    handleSuggestTarget(value);
  };

  const renderTabContent = () => {
    if (activeTab === "Цели" || activeTab === "Планы") {
      const list = activeTab === "Цели" ? goalRecords : planRecords;
      return (
        <RecordsList
          records={list}
          loading={loading}
          onOpen={handleOpenRecord}
          onDelete={handleDeleteRecord}
          getTagStyle={getTagStyle}
        />
      );
    }

    if (activeTab === "Добавить") {
      return (
        <AddRecordForm
          formState={addForm}
          onChange={setAddForm}
          onSubmit={handleAddRecord}
        />
      );
    }

    if (activeTab === "Дашборд") {
      return (
        <Dashboard
          buckets={dashboardBuckets}
          onOpen={handleOpenRecord}
          getTagStyle={getTagStyle}
        />
      );
    }

    return (
      <UpdatesForm
        progressInput={progressInput}
        onProgressInputChange={handleProgressInputChange}
        progressTargetId={progressTargetId}
        onProgressTargetChange={setProgressTargetId}
        records={records}
        onSubmit={handleProgressUpdate}
      />
    );
  };

  return (
    <div className="app">
      <Header user={user} onLogout={handleLogout} />

      {!user && <AuthSection botUsername={botUsername} />}

      {user && (
        <section className="dashboard">
          <TabsNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          {loading && <div className="alert">Загрузка...</div>}
          {status && <div className="alert">{status}</div>}

          {renderTabContent()}
        </section>
      )}

      {selectedRecord && (
        <DetailOverlay
          record={selectedRecord}
          selectedHistoryId={selectedHistoryId}
          selectedHistory={selectedHistory}
          onClose={() => setSelectedId(null)}
          onSelectHistory={setSelectedHistoryId}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onChatSend={handleChatSend}
          getTagStyle={getTagStyle}
          normalizePeriodLabel={normalizePeriodLabel}
        />
      )}
    </div>
  );
}
