import { useCallback, useEffect, useMemo, useState } from "react";
import { api, GoalItem, PlanItem, UserProfile } from "./api";

const tabs = ["Цели", "Планы"] as const;

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

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setGoals([]);
    setPlans([]);
  };

  const handleDeleteGoal = async (id: number) => {
    try {
      await api.deleteGoal(id);
      setGoals((prev) => prev.filter((goal) => goal.id !== id));
    } catch {
      setStatus("Не удалось удалить цель.");
    }
  };

  const handleDeletePlan = async (id: number) => {
    try {
      await api.deletePlan(id);
      setPlans((prev) => prev.filter((plan) => plan.id !== id));
    } catch {
      setStatus("Не удалось удалить план.");
    }
  };

  const tabContent = useMemo(() => {
    if (activeTab === "Цели") {
      return (
        <div className="list">
          {goals.length === 0 && !loading && <p>Целей пока нет.</p>}
          {goals.map((goal) => (
            <div className="card" key={goal.id}>
              <div>
                <div className="card-title">{goal.text}</div>
                <div className="card-meta">
                  <span>{goal.period}</span>
                  <span>·</span>
                  <span>{new Date(goal.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <button
                className="danger"
                onClick={() => handleDeleteGoal(goal.id)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="list">
        {plans.length === 0 && !loading && <p>Планов пока нет.</p>}
        {plans.map((plan) => (
          <div className="card" key={plan.id}>
            <div>
              <div className="card-title">{plan.text}</div>
              <div className="card-meta">
                <span>{plan.period}</span>
                <span>·</span>
                <span>{new Date(plan.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <button
              className="danger"
              onClick={() => handleDeletePlan(plan.id)}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    );
  }, [activeTab, goals, plans, loading]);

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
    </div>
  );
}
