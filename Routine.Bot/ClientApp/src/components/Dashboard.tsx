import { periodBuckets } from "../constants";
import { GoalPlanRecord, PeriodBucketKey } from "../types";

type DashboardProps = {
  buckets: Record<PeriodBucketKey, GoalPlanRecord[]>;
  onOpen: (id: string) => void;
  getTagStyle: (tag: string) => { background: string; color: string };
};

export const Dashboard = ({ buckets, onOpen, getTagStyle }: DashboardProps) => (
  <div className="dashboard-grid">
    {periodBuckets.map((bucket) => (
      <div key={bucket.key} className="section">
        <div className="section-header">
          <h3>{bucket.label}</h3>
          <span>{buckets[bucket.key].length} задач</span>
        </div>
        <div className="tile-grid">
          {buckets[bucket.key].length === 0 && (
            <div className="tile empty">Нет записей</div>
          )}
          {buckets[bucket.key].map((record) => (
            <button
              key={record.id}
              className="tile"
              onClick={() => onOpen(record.id)}
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
