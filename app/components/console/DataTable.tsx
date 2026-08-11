'use client';

import type { ReactNode } from 'react';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
  dense?: boolean;
  className?: string;
};

/** 後台共用高密度資料表殼 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyText = '尚無資料',
  dense = false,
  className = '',
}: Props<T>) {
  const cellPad = dense ? 'py-2 px-4' : 'py-3 px-6';
  return (
    <div
      className={`bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-containerLow border-b border-outline-variant text-on-surfaceVariant font-mono text-xs uppercase tracking-wider">
              {columns.map((col) => (
                <th key={col.key} className={`${cellPad} font-semibold ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`${cellPad} text-center text-on-surfaceVariant`}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-outline-variant last:border-0 hover:bg-surface-containerHighest/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`${cellPad} ${col.className || ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
