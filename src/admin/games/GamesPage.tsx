import { useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import type { Game } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { StationSelect } from '../pickers';

interface GameForm {
  id: string | null;
  title: string;
  genre: string;
  executablePath: string;
  cover: string;
}

const EMPTY: GameForm = { id: null, title: '', genre: '', executablePath: '', cover: '' };

/** Game catalog + which games are installed on which station (brief §6.11). Launching is on the station page. */
export function GamesPage() {
  const games = useApiQuery<Game[]>('/games');
  const action = useAction();
  const [form, setForm] = useState<GameForm>(EMPTY);
  const [stationId, setStationId] = useState('');
  const installed = useApiQuery<Game[]>(stationId ? `/stations/${stationId}/games` : null);

  const catalog = [...(games.data ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  const installedIds = new Set((installed.data ?? []).map((g) => g.id));

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = { title: form.title, genre: form.genre, executablePath: form.executablePath, cover: form.cover || null };
    const saved = await action.run(
      'save',
      () => api<Game>(form.id ? 'PATCH' : 'POST', form.id ? `/games/${form.id}` : '/games', body),
      (g) => `${g.title} ${form.id ? 'updated' : 'added to the catalog'}.`,
    );
    if (saved) {
      setForm(EMPTY);
      games.reload();
    }
  }

  async function remove(g: Game) {
    if (!window.confirm(`Delete ${g.title} from the catalog? It is removed from every station.`)) return;
    const done = await action.run(g.id, () => api('DELETE', `/games/${g.id}`).then(() => true), `${g.title} deleted.`);
    if (done) {
      games.reload();
      installed.reload();
    }
  }

  async function setInstalled(g: Game, install: boolean) {
    const done = await action.run(
      `inst-${g.id}`,
      () =>
        (install
          ? api('POST', `/stations/${stationId}/games`, { gameId: g.id })
          : api('DELETE', `/stations/${stationId}/games/${g.id}`)
        ).then(() => true),
      `${g.title} ${install ? 'assigned to' : 'removed from'} the station.`,
    );
    if (done) installed.reload();
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
                <th>Title</th>
                <th>Genre</th>
                <th>Executable</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalog.map((g) => (
                <tr key={g.id}>
                  <td>
                    <b>{g.title}</b>
                  </td>
                  <td>{g.genre || '—'}</td>
                  <td>
                    <code>{g.executablePath}</code>
                  </td>
                  <td className="nowrap">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setForm({ id: g.id, title: g.title, genre: g.genre, executablePath: g.executablePath, cover: g.cover ?? '' })}
                    >
                      Edit
                    </button>{' '}
                    <button type="button" className="secondary" disabled={action.busy === g.id} onClick={() => remove(g)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!games.loading && catalog.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    The catalog is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={save}>
          <h2>{form.id ? `Edit ${form.title}` : 'Add a game'}</h2>
          <fieldset>
            <legend>Game</legend>
            <div className="form-row">
              <label htmlFor="g-title">Title</label>
              <input id="g-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="g-genre">Genre</label>
              <input id="g-genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="g-exe">Executable path</label>
              <input
                id="g-exe"
                required
                size={34}
                placeholder="C:\Games\Title\game.exe"
                value={form.executablePath}
                onChange={(e) => setForm({ ...form, executablePath: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="g-cover">Cover image URL</label>
              <input id="g-cover" size={34} placeholder="optional, served on the LAN" value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} />
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

      <h2>Installed on a station</h2>
      <div className="toolbar">
        <label htmlFor="g-station">Station</label>
        <StationSelect id="g-station" value={stationId} onChange={setStationId} />
      </div>
      {stationId && (
        <>
          <ErrorBox error={installed.error} />
          <table className="grid" style={{ width: 'auto' }}>
            <thead>
              <tr>
                <th>Game</th>
                <th>Installed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalog.map((g) => {
                const on = installedIds.has(g.id);
                return (
                  <tr key={g.id}>
                    <td>{g.title}</td>
                    <td className={on ? 'status-ok' : 'muted'}>{installed.loading ? '…' : on ? 'Yes' : 'No'}</td>
                    <td>
                      <button
                        type="button"
                        className={on ? 'secondary' : ''}
                        disabled={installed.loading || action.busy === `inst-${g.id}`}
                        onClick={() => setInstalled(g, !on)}
                      >
                        {on ? 'Remove' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
