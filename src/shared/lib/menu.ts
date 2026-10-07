import type { Role } from '../../api/types';

export interface MenuItem {
  path: string;
  label: string;
  /** Plan step that builds the page (Frontend Implementation Plan §4). */
  step: number;
  /** Lowest role that sees the item (brief §5). Omitted = every role of the app. */
  minRole?: Role;
}
