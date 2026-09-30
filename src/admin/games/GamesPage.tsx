import { useState, type FormEvent } from 'react';

import { api, ApiError } from '../../api/http';
import type { Game, GameInput, GameLaunchType, StationGame, StationGameOverrides } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { StationSelect } from '../pickers';
import { STATIONS_PATH } from '../stations/station';
import { applyCatalogStatus, GAMES_PATH, installText, LAUNCH_TYPE_LABEL, LAUNCH_TYPES, TARGET_HINT } from './games';

interface GameForm {
  id: string | null;
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments: string;
  workingDirectory: string;
  processName: string;
  iconUrl: string;
  enabled: boolean;
}

const EMPTY: GameForm = {
  id: null,
  gameId: '',
  name: '',
  launchType: 'exe',
  target: '',
  arguments: '',
  workingDirectory: '',
  processName: '',
  iconUrl: '',
  enabled: true,
};

function toForm(g: Game): GameForm {
  return {
    id: g.id,
    gameId: g.gameId,
    name: g.name,
    launchType: g.launchType,
    target: g.target,
    arguments: g.arguments ?? '',
    workingDirectory: g.workingDirectory ?? '',
    processName: g.processName ?? '',
    iconUrl: g.iconUrl ?? '',
    enabled: g.enabled,
  };
}

const orNull = (v: string) => v.trim() || null;

/** The API body. Epic takes no arguments and only exe has a working directory. */
function toInput(f: GameForm): GameInput {
  return {
    gameId: f.gameId.trim(),
    name: f.name.trim(),
    launchType: f.launchType,
    target: f.target.trim(),
    arguments: f.launchType === 'epic' ? null : orNull(f.arguments),
    workingDirectory: f.launchType === 'exe' ? orNull(f.workingDirectory) : null,
    processName: orNull(f.processName),
    iconUrl: orNull(f.iconUrl),
    enabled: f.enabled,
  };
}

/**
 * Game catalog (brief §6.11). A game reaches a station when it is offered at
 * the station's branch or assigned to the station itself; the agent then
 * syncs its catalog and reports what it can actually launch (catalog_status).
 * Launching is on the station page.
 */
export function GamesPage() {
  const games = useApiQuery<Game[]>(GAMES_PATH);
  const action = useAction();
  const { branchId, branchName } = useBranchScope();
  const [form, setForm] = useState<GameForm>(EMPTY);
  const [branchGame, setBranchGame] = useState('');
  const [stationId, setStationId] = useState('');
  const [addGame, setAddGame] = useState('');
  const [overrideTarget, setOverrideTarget] = useState('');
  const stationGames = useApiQuery<StationGame[]>(stationId ? `${STATIONS_PATH}/${stationId}/games` : null);

  useRealtimeEvent('catalog_status', (e) => {
    if (e.machineId === stationId) stationGames.setData((list) => applyCatalogStatus(list, e));
  });

  const catalog = [...(games.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const onStation = new Set((stationGames.data ?? []).map((g) => g.id));
  const hint = TARGET_HINT[form.launchType];

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = toInput(form);
    const saved = await action.run(
      'save',
      () => api<Game>(form.id ? 'PATCH' : 'POST', form.id ? `${GAMES_PATH}/${form.id}` : GAMES_PATH, body),
      (g) => `${g.name} ${form.id ? 'updated. Stations that offer it sync their catalog.' : 'added to the catalog. Offer it at a branch or a station below.'}`,
    );
    if (saved) {
      setForm(EMPTY);
      games.reload();
      stationGames.reload();
    }
  }

  async function setEnabled(g: Game, enabled: boolean) {
    const done = await action.run(
      g.id,
      () => api<Game>('PATCH', `${GAMES_PATH}/${g.id}`, { enabled }),
      `${g.name} ${enabled ? 'enabled' : 'disabled: it can no longer be launched'}.`,
    );
    if (done) games.reload();
  }

  async function offerAtBranch(offer: boolean) {
    const g = catalog.find((x) => x.id === branchGame);
    if (!g || !branchId) return;
    const where = branchName(branchId);
    await action.run(
      'branch',
      () => api(offer ? 'PUT' : 'DELETE', `${GAMES_PATH}/${g.id}/branches/${branchId}`).catch(explainAssignment(g, 'branch')),
      offer ? `${g.name} is offered at every station of ${where}.` : `${g.name} is no longer offered at ${where}.`,
    );
    stationGames.reload();
  }

  async function assignToStation(e: FormEvent) {
    e.preventDefault();
    const g = catalog.find((x) => x.id === addGame);
    if (!g) return;
    const body: StationGameOverrides = { target: orNull(overrideTarget) };
    const done = await action.run(
      'station-add',
      () => api('PUT', `${GAMES_PATH}/${g.id}/stations/${stationId}`, body),
      `${g.name} assigned to the station. It shows as installed once the station reports it.`,
    );
    if (done) {
      setAddGame('');
      setOverrideTarget('');
      stationGames.reload();
    }
  }

  async function removeFromStation(g: StationGame) {
    const done = await action.run(
      `station-${g.id}`,
      () => api('DELETE', `${GAMES_PATH}/${g.id}/stations/${stationId}`).catch(explainAssignment(g, 'station')),
      `${g.name} removed from the station.`,
    );
    if (done !== undefined) stationGames.reload();
  }

  return (
    <>
      <h1>Games</h1>
      <ActionMessages action={action} />
      <ErrorBox error={games.error} />

      <div className="columns">
        <div>
          <h2>Catalog</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Game id</th>
                <th>Launch</th>
                <th>Process</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalog.map((g) => (
                <tr key={g.id} className={g.enabled ? '' : 'row-muted'}>
                  <td>
                    <b>{g.name}</b>
                  </td>
                  <td>
                    <code>{g.gameId}</code>
                  </td>
                  <td>
                    {LAUNCH_TYPE_LABEL[g.launchType]}: <code>{g.target}</code>
                    {g.arguments && <div className="muted">args: {g.arguments}</div>}
                  </td>
                  <td>{g.processName ?? <span className="muted">not tracked</span>}</td>
                  <td className={g.enabled ? 'status-ok' : 'muted'}>{g.enabled ? 'Enabled' : 'Disabled'}</td>
                  <td className="nowrap">
                    <button type="button" className="secondary" onClick={() => setForm(toForm(g))}>
                      Edit
                    </button>{' '}
                    <button type="button" className="secondary" disabled={action.busy === g.id} onClick={() => setEnabled(g, !g.enabled)}>
                      {g.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {!games.loading && catalog.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    The catalog is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={save}>
          <h2>{form.id ? `Edit ${form.name}` : 'Add a game'}</h2>
          <fieldset>
            <legend>Game</legend>
            <div className="form-row">
              <label htmlFor="g-name">Name</label>
              <input id="g-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="g-id">Game id</label>
              <input
                id="g-id"
                required
                maxLength={128}
                placeholder="cs2"
                value={form.gameId}
                onChange={(e) => setForm({ ...form, gameId: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="g-type">Launch with</label>
              <select id="g-type" value={form.launchType} onChange={(e) => setForm({ ...form, launchType: e.target.value as GameLaunchType })}>
                {LAUNCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LAUNCH_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="g-target">{hint.label}</label>
              <input
                id="g-target"
                required
                size={34}
                placeholder={hint.placeholder}
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </div>
            {form.launchType !== 'epic' && (
              <div className="form-row">
                <label htmlFor="g-args">Arguments</label>
                <input id="g-args" size={34} placeholder="optional" value={form.arguments} onChange={(e) => setForm({ ...form, arguments: e.target.value })} />
              </div>
            )}
            {form.launchType === 'exe' && (
              <div className="form-row">
                <label htmlFor="g-dir">Working folder</label>
                <input
                  id="g-dir"
                  size={34}
                  placeholder="optional, e.g. C:\Games\CS2"
                  value={form.workingDirectory}
                  onChange={(e) => setForm({ ...form, workingDirectory: e.target.value })}
                />
              </div>
            )}
            <div className="form-row">
              <label htmlFor="g-process">Process name</label>
              <input
                id="g-process"
                placeholder="e.g. cs2.exe (to close it at session end)"
                size={34}
                value={form.processName}
                onChange={(e) => setForm({ ...form, processName: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="g-icon">Icon URL</label>
              <input id="g-icon" size={34} placeholder="optional" value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="g-enabled">Enabled</label>
              <input id="g-enabled" type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'save'}>
                {form.id ? 'Save changes' : 'Add game'}
              </button>{' '}
              {form.id && (
                <button type="button" className="secondary" onClick={() => setForm(EMPTY)}>
                  Cancel
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </div>

      <h2>Offer at a branch</h2>
      {branchId ? (
        <div className="toolbar">
          <label htmlFor="g-branch-game">Game</label>
          <GameSelect id="g-branch-game" games={catalog} value={branchGame} onChange={setBranchGame} />{' '}
          <button type="button" disabled={!branchGame || action.busy === 'branch'} onClick={() => offerAtBranch(true)}>
            Offer at every station of {branchName(branchId)}
          </button>{' '}
          <button type="button" className="secondary" disabled={!branchGame || action.busy === 'branch'} onClick={() => offerAtBranch(false)}>
            Stop offering
          </button>
        </div>
      ) : (
        <p className="muted">Pick a branch in the top bar to offer games at it.</p>
      )}

      <h2>Games on a station</h2>
      <div className="toolbar">
        <label htmlFor="g-station">Station</label>
        <StationSelect id="g-station" value={stationId} onChange={setStationId} />
      </div>
      {stationId && (
        <>
          <ErrorBox error={stationGames.error} />
          <table className="grid" style={{ width: 'auto' }}>
            <thead>
              <tr>
                <th>Game</th>
                <th>Launch target</th>
                <th>Installed</th>
                <th>Reported</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(stationGames.data ?? []).map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>
                    <code>{g.target}</code>
                  </td>
                  <td className={g.installed ? 'status-ok' : g.installed === false ? 'status-bad' : 'muted'}>{installText(g)}</td>
                  <td className="muted">{g.reportedAt ? formatDateTime(g.reportedAt) : '—'}</td>
                  <td>
                    <button type="button" className="secondary" disabled={action.busy === `station-${g.id}`} onClick={() => removeFromStation(g)}>
                      Remove from station
                    </button>
                  </td>
                </tr>
              ))}
              {!stationGames.loading && (stationGames.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No game reaches this station yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <form className="toolbar" onSubmit={assignToStation}>
            <label htmlFor="g-add">Assign to this station</label>
            <GameSelect id="g-add" games={catalog.filter((g) => !onStation.has(g.id))} value={addGame} onChange={setAddGame} />{' '}
            <input
              aria-label="Launch target on this station"
              size={28}
              placeholder="other target on this PC (optional)"
              value={overrideTarget}
              onChange={(e) => setOverrideTarget(e.target.value)}
            />{' '}
            <button type="submit" disabled={!addGame || action.busy === 'station-add'}>
              Assign
            </button>
          </form>
        </>
      )}
    </>
  );
}

function GameSelect({ id, games, value, onChange }: { id: string; games: Game[]; value: string; onChange(v: string): void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— choose a game —</option>
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
          {g.enabled ? '' : ' (disabled)'}
        </option>
      ))}
    </select>
  );
}

/**
 * The station list doesn't say how a game got there. A DELETE that finds no
 * such assignment (404 ASSIGNMENT_NOT_FOUND) means it came the other way.
 */
function explainAssignment(g: { name: string }, level: 'branch' | 'station') {
  return (err: unknown): never => {
    if (err instanceof ApiError && err.code === 'ASSIGNMENT_NOT_FOUND') {
      throw new Error(
        level === 'station'
          ? `${g.name} is offered at the whole branch, not assigned to this station: stop offering it at the branch instead.`
          : `${g.name} is not offered at this branch (it may be assigned to single stations).`,
      );
    }
    throw err;
  };
}
