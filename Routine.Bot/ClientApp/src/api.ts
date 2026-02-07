export type GoalItem = {
  id: number;
  text: string;
  period: string;
  createdAt: string;
};

export type PlanItem = {
  id: number;
  text: string;
  period: string;
  createdAt: string;
};

export type UserProfile = {
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getConfig: () => request<{ telegramBotUsername: string }>("/api/config"),
  getMe: () => request<UserProfile>("/api/me"),
  loginWithTelegram: (payload: Record<string, unknown>) =>
    request<UserProfile>("/api/auth/telegram", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  logout: () =>
    request<void>("/api/auth/logout", {
      method: "POST"
    }),
  getGoals: () => request<GoalItem[]>("/api/goals"),
  getPlans: () => request<PlanItem[]>("/api/plans"),
  deleteGoal: (id: number) =>
    request<void>(`/api/goals/${id}`, {
      method: "DELETE"
    }),
  deletePlan: (id: number) =>
    request<void>(`/api/plans/${id}`, {
      method: "DELETE"
    })
};
