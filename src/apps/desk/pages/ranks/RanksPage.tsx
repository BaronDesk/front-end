import { useState, type FormEvent } from 'react';

import { uploadImage } from '../../../../services/images.service';
import type { Rank, RankInput } from '../../../../core/api-types';
import { ActionMessages } from '../../components/ActionMessages';
import { EmptyRow } from '../../components/EmptyRow';
import { ErrorBox } from '../../components/ErrorBox';
import { ImageField } from '../../components/ImageField';
import { Thumb } from '../../components/Thumb';
import { useAction } from '../../../../hooks/useAction';
import { useApiQuery } from '../../../../hooks/useApiQuery';
import { explainRefusal } from '../../../../lib/errors';
import { catalogService } from '../../../../services/catalog.service';
import { ranksService } from '../../../../services/ranks.service';

const RANK_REFUSALS: Record<string, string> = {
  RANK_NAME_TAKEN: 'Another rank already has this name.',
  RANK_XP_TAKEN: 'Another rank already starts at this XP: each rank needs its own.',
};

const EMPTY = { id: null as string | null, name: '', minXp: '', badgeUrl: null as string | null };

/**
 * Gamer ranks (Wood → GrandMaster): the XP each starts at and its badge. A
 * gamer holds the highest rank their XP has reached. Shared by every branch.
 */
export function RanksPage() {
  const ranks = useApiQuery<Rank[]>(catalogService.paths.ranks);
  const action = useAction();
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const list = ranks.data ?? [];

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: RankInput = { name: form.name.trim(), minXp: Number(form.minXp), badgeUrl: form.badgeUrl };
    const saved = await action.run(
      'save',
      () => ranksService.save(form.id, body).catch((err) => explainRefusal(err, RANK_REFUSALS)),
      (r) => `Rank ${r.name} ${form.id ? 'updated' : 'created'}.`,
    );
    if (saved) {
      setForm(EMPTY);
      ranks.reload();
    }
  }

  async function remove(r: Rank) {
    if (!window.confirm(`Delete the rank ${r.name}? Gamers who held it fall to the rank below.`)) return;
    const done = await action.run(r.id, () => ranksService.remove(r.id), `Rank ${r.name} deleted.`);
    if (done) ranks.reload();
  }

  return (
    <>
      <h1>Ranks</h1>
      <p className="muted">A gamer holds the highest rank their XP has reached. The same ranks apply in every branch.</p>
      <ActionMessages action={action} />
      <ErrorBox error={ranks.error} />

      <table className="grid">
        <thead>
          <tr>
            <th>Rank</th>
            <th>From</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.id}>
              <td>
                <span className="with-thumb">
                  <Thumb url={r.badgeUrl} size={40} />
                  <b>{r.name}</b>
                </span>
              </td>
              <td>
                {r.minXp.toLocaleString()} XP
                {list[i + 1] && <span className="muted"> to {(list[i + 1].minXp - 1).toLocaleString()}</span>}
              </td>
              <td className="nowrap">
                <button type="button" className="secondary" onClick={() => setForm({ id: r.id, name: r.name, minXp: String(r.minXp), badgeUrl: r.badgeUrl })}>
                  Edit
                </button>{' '}
                <button type="button" className="secondary" disabled={action.busy === r.id} onClick={() => remove(r)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {!ranks.loading && list.length === 0 && <EmptyRow colSpan={3}>No rank yet.</EmptyRow>}
        </tbody>
      </table>
      {list.length > 0 && list[0].minXp > 0 && (
        <p className="status-bad">No rank starts at 0 XP: new gamers have no rank until they reach {list[0].minXp.toLocaleString()} XP.</p>
      )}

      <form onSubmit={save} style={{ marginTop: 8 }}>
        <fieldset>
          <legend>{form.id ? `Edit ${form.name}` : 'New rank'}</legend>
          <div className="form-row">
            <label htmlFor="r-name">Name</label>
            <input id="r-name" required maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="r-xp">From (XP)</label>
            <input id="r-xp" type="number" min="0" step="1" required value={form.minXp} onChange={(e) => setForm({ ...form, minXp: e.target.value })} />
          </div>
          <ImageField
            id="r-badge"
            label="Badge"
            value={form.badgeUrl}
            upload={uploadImage}
            onChange={(badgeUrl) => setForm((f) => ({ ...f, badgeUrl }))}
            onBusy={setUploading}
          />
          <div className="form-row">
            <label />
            <button type="submit" disabled={action.busy === 'save' || uploading}>
              {form.id ? 'Save changes' : 'Create rank'}
            </button>{' '}
            {form.id && (
              <button type="button" className="secondary" onClick={() => setForm(EMPTY)}>
                Cancel
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </>
  );
}
