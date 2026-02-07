import { GoalPlanRecord } from "../types";

type UpdatesFormProps = {
  progressInput: string;
  onProgressInputChange: (value: string) => void;
  progressTargetId: string;
  onProgressTargetChange: (value: string) => void;
  records: GoalPlanRecord[];
  onSubmit: () => void;
};

export const UpdatesForm = ({
  progressInput,
  onProgressInputChange,
  progressTargetId,
  onProgressTargetChange,
  records,
  onSubmit
}: UpdatesFormProps) => (
  <div className="form">
    <div className="form-row">
      <label>Обновление прогресса</label>
      <textarea
        value={progressInput}
        onChange={(event) => onProgressInputChange(event.target.value)}
        placeholder="Например: закончил первый модуль по аналитике, прогресс 35%"
      />
    </div>
    <div className="form-row">
      <label>Распознанная цель/план</label>
      <select
        value={progressTargetId}
        onChange={(event) => onProgressTargetChange(event.target.value)}
      >
        <option value="">Выберите запись</option>
        {records.map((record) => (
          <option key={record.id} value={record.id}>
            {record.title} ({record.kind === "goal" ? "цель" : "план"})
          </option>
        ))}
      </select>
    </div>
    <button onClick={onSubmit}>Сохранить обновление</button>
  </div>
);
