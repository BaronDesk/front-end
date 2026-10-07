import type { ReactNode } from 'react';

/** The single grey row of an empty table: "No booking in this time." across every column. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="muted">
        {children}
      </td>
    </tr>
  );
}
