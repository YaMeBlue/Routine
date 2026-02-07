import { UserProfile } from "../api";

type HeaderProps = {
  user: UserProfile | null;
  onLogout: () => void;
};

export const Header = ({ user, onLogout }: HeaderProps) => (
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
        <button className="ghost" onClick={onLogout}>
          Выйти
        </button>
      </div>
    )}
  </header>
);
