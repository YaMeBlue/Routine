import { GoalPlanRecord } from "../types";

type RecordsListProps = {
  records: GoalPlanRecord[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (record: GoalPlanRecord) => void;
  getTagStyle: (tag: string) => { background: string; color: string };
};

export const RecordsList = ({
  records,
  loading,
  onOpen,
  onDelete,
  getTagStyle
}: RecordsListProps) => (
  <div className="list">
    {records.length === 0 && !loading && <p>Записей пока нет.</p>}
    {records.map((record) => (
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
          <button className="ghost" onClick={() => onOpen(record.id)}>
            Открыть
          </button>
          <button className="danger" onClick={() => onDelete(record)}>
            Удалить
          </button>
        </div>
      </div>
    ))}
  </div>
);
