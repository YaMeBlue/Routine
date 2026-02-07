import { GoalPlanRecord, HistoryEntry } from "../types";

type DetailOverlayProps = {
  record: GoalPlanRecord;
  selectedHistoryId: string | null;
  selectedHistory: HistoryEntry | null;
  onClose: () => void;
  onSelectHistory: (id: string) => void;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onChatSend: () => void;
  getTagStyle: (tag: string) => { background: string; color: string };
  normalizePeriodLabel: (period: string) => string;
};

export const DetailOverlay = ({
  record,
  selectedHistoryId,
  selectedHistory,
  onClose,
  onSelectHistory,
  chatInput,
  onChatInputChange,
  onChatSend,
  getTagStyle,
  normalizePeriodLabel
}: DetailOverlayProps) => (
  <div className="detail-overlay" onClick={onClose}>
    <div className="detail-panel" onClick={(event) => event.stopPropagation()}>
      <div className="detail-main">
        <div className="detail-header">
          <div>
            <h2>{record.title}</h2>
            <p>
              {record.kind === "goal" ? "Цель" : "План"} ·{" "}
              {normalizePeriodLabel(record.period)}
            </p>
          </div>
          <button className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="tag-list">
          {record.tags.map((tag) => (
            <span key={tag} className="tag" style={getTagStyle(tag)}>
              {tag}
            </span>
          ))}
        </div>

        <div className="progress detail-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${record.progress}%` }}
            />
          </div>
          <span>{record.progress}%</span>
        </div>

        {record.description && (
          <p className="detail-description">{record.description}</p>
        )}

        <div className="detail-section">
          <h3>Что сделано</h3>
          <ul>
            {record.history
              .filter((entry) => entry.type === "progress")
              .slice(0, 4)
              .map((entry) => (
                <li key={entry.id}>{entry.detail}</li>
              ))}
            {record.history.filter((entry) => entry.type === "progress").length ===
              0 && <li>Пока нет обновлений.</li>}
          </ul>
        </div>

        <div className="detail-section">
          <h3>Диалог с ассистентом</h3>
          <div className="chat-box">
            {record.history
              .filter((entry) => entry.type === "chat")
              .slice(0, 3)
              .map((entry) => (
                <div key={entry.id} className="chat-snippet">
                  <strong>
                    {entry.messages?.[0]?.author === "user"
                      ? "Вы"
                      : "Ассистент"}
                    :
                  </strong>{" "}
                  {entry.detail}
                </div>
              ))}
            {record.history.filter((entry) => entry.type === "chat").length ===
              0 && <p>История диалога пока пуста.</p>}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
              placeholder="Напишите сообщение ассистенту"
            />
            <button onClick={onChatSend}>Отправить</button>
          </div>
        </div>
      </div>

      <div className="detail-history">
        <h3>История</h3>
        <div className="history-list">
          {record.history.length === 0 && (
            <div className="history-empty">История пока пуста.</div>
          )}
          {record.history.map((entry) => (
            <button
              key={entry.id}
              className={
                entry.id === selectedHistoryId
                  ? "history-item active"
                  : "history-item"
              }
              onClick={() => onSelectHistory(entry.id)}
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
);
