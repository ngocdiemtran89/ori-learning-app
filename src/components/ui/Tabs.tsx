import React from 'react';

export interface TabItem<T extends string | number = string | number> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string | number = string | number> {
  tabs: Array<TabItem<T>>;
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'pills' | 'underline';
  size?: 'sm' | 'md';
}

export function Tabs<T extends string | number = string | number>({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  size = 'md',
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={String(tab.id)}
              onClick={() => onChange(tab.id)}
              className={`pb-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-ori-600 text-ori-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs font-bold tabular-nums ${
                    isActive ? 'bg-ori-100 text-ori-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default Pills variant
  return (
    <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200/80 overflow-x-auto no-scrollbar max-w-full">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={String(tab.id)}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap select-none ${
              isActive
                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            } ${size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-2 text-xs'}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                  isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
