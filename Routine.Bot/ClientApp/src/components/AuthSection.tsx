import { ReactNode } from "react";

type AuthSectionProps = {
  botUsername: string;
  loginNode?: ReactNode;
};

export const AuthSection = ({ botUsername, loginNode }: AuthSectionProps) => (
  <section className="auth">
    <h2>Вход через Telegram</h2>
    <p>Подключись, чтобы увидеть свои планы и цели.</p>
    {botUsername ? (
      loginNode ?? <div id="telegram-login" />
    ) : (
      <div className="alert">Укажи Telegram BotUsername в настройках.</div>
    )}
  </section>
);
