import type { CatalogStatusEvent, GameLaunchType, StationGame } from '../../api/types';

export const GAMES_PATH = '/api/v1/games';

export const LAUNCH_TYPES: GameLaunchType[] = ['exe', 'steam', 'epic'];

export const LAUNCH_TYPE_LABEL: Record<GameLaunchType, string> = {
  exe: 'Program (.exe)',
  steam: 'Steam',
  epic: 'Epic Games',
};

/** What `target` means per launch type (the server checks the same rules: 400 INVALID_LAUNCH_SPEC). */
export const TARGET_HINT: Record<GameLaunchType, { label: string; placeholder: string }> = {
  exe: { label: 'Executable path', placeholder: 'C:\\Games\\CS2\\cs2.exe' },
  steam: { label: 'Steam app id', placeholder: '730' },
  epic: { label: 'Epic AppName', placeholder: 'Fortnite' },
};

/** "Yes" / "No (reason)" / "Not reported yet": the agent's own report is the only availability truth. */
export function installText(g: Pick<StationGame, 'installed' | 'reason'>): string {
  if (g.installed === null) return 'Not reported yet';
  if (g.installed) return 'Yes';
  return g.reason ? `No (${g.reason})` : 'No';
}

/** A station's game list with a catalog_status report applied. */
export function applyCatalogStatus(list: StationGame[] | undefined, e: CatalogStatusEvent): StationGame[] | undefined {
  if (!list) return list;
  const byId = new Map(e.games.map((g) => [g.gameId, g]));
  return list.map((g) => {
    const report = byId.get(g.gameId);
    return report ? { ...g, installed: report.installed, reason: report.reason, reportedAt: e.reportedAt } : g;
  });
}
