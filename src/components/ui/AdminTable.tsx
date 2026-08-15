import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (item: T, index: number) => React.ReactNode;
}

export interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  emptyState?: React.ReactNode;
  rowDensity?: 'comfortable' | 'standard' | 'dense';
  className?: string;
}

export function AdminTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  rowDensity = 'standard',
  className = '',
}: AdminTableProps<T>) {
  const densityStyles = {
    comfortable: 'py-4 px-4 text-sm',
    standard: 'py-3 px-3.5 text-sm',
    dense: 'py-2 px-3 text-xs',
  };

  const alignStyles = {
    left: 'text-left justify-start',
    center: 'text-center justify-center',
    right: 'text-right justify-end',
  };

  if (!data || data.length === 0) {
    return <>{emptyState || <div className="p-8 text-center text-slate-500 text-sm">Không có dữ liệu.</div>}</>;
  }

  return (
    <div className={`w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs ${className}`.trim()}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200 h-12">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`type-table-header px-3.5 py-3 font-semibold text-slate-500 ${alignStyles[col.align || 'left']}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, idx) => (
            <tr
              key={keyExtractor(item, idx)}
              className="hover:bg-slate-50/60 transition-colors group align-middle"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{ width: col.width }}
                  className={`align-middle text-slate-800 ${densityStyles[rowDensity]} ${alignStyles[col.align || 'left']}`}
                >
                  {col.render(item, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
