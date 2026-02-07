import { periodBuckets } from "../constants";
import { AddFormState, GoalPlanType } from "../types";

type AddRecordFormProps = {
  formState: AddFormState;
  onChange: (next: AddFormState) => void;
  onSubmit: () => void;
};

export const AddRecordForm = ({
  formState,
  onChange,
  onSubmit
}: AddRecordFormProps) => (
  <div className="form">
    <div className="form-row">
      <label>Тип</label>
      <select
        value={formState.kind}
        onChange={(event) =>
          onChange({
            ...formState,
            kind: event.target.value as GoalPlanType
          })
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
        value={formState.title}
        onChange={(event) =>
          onChange({
            ...formState,
            title: event.target.value
          })
        }
        placeholder="Например, выучить TypeScript"
      />
    </div>
    <div className="form-row">
      <label>Период</label>
      <select
        value={formState.period}
        onChange={(event) =>
          onChange({
            ...formState,
            period: event.target.value
          })
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
        value={formState.tags}
        onChange={(event) =>
          onChange({
            ...formState,
            tags: event.target.value
          })
        }
        placeholder="работа, учеба, здоровье"
      />
    </div>
    <div className="form-row">
      <label>Описание</label>
      <textarea
        value={formState.description}
        onChange={(event) =>
          onChange({
            ...formState,
            description: event.target.value
          })
        }
        placeholder="Дополнительные детали цели или плана"
      />
    </div>
    <button onClick={onSubmit}>Добавить запись</button>
  </div>
);
