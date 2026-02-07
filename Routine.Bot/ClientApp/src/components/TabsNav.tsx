import { TabKey } from "../types";

type TabsNavProps = {
  tabs: readonly TabKey[];
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export const TabsNav = ({ tabs, activeTab, onChange }: TabsNavProps) => (
  <div className="tabs">
    {tabs.map((tab) => (
      <button
        key={tab}
        className={tab === activeTab ? "tab active" : "tab"}
        onClick={() => onChange(tab)}
      >
        {tab}
      </button>
    ))}
  </div>
);
