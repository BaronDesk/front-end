import { useState, type FormEvent } from 'react';

import type { Tournament, TournamentInput } from '../../../../core/api-types';
import type { Action } from '../../../../hooks/useAction';
import { useGames } from '../../../../hooks/queries';
import { uploadImage } from '../../../../services/images.service';
import { tournamentsService } from '../../../../services/tournaments.service';
import { localDateInput } from '../../../../lib/dates';
import { Select } from '../../../../components/primitives/Select';
import { DateField } from '../../../../components/composites/DateField';
import { TimeField } from '../../../../components/composites/TimeField';
import { ImageField } from '../../components/ImageField';
import { useBranchScope } from '../../providers/BranchContext';

const TEAM_SIZES = [1, 2, 3, 4, 5];
const PLACES = [4, 8, 16, 32];

const pad = (n: number) => String(n).padStart(2, '0');
/** An ISO time as the form's day and quarter-hour fields (local time). */
const dayOf = (iso: string) => localDateInput(new Date(iso));
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** The form's day and time fields back to an ISO time. */
const isoOf = (day: string, time: string) => new Date(`${day}T${time}:00`).toISOString();

/** `days` from today at hh:mm, as an ISO time (the new tournament's defaults). */
function daysFromNow(days: number, hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

/**
 * Creating or editing a tournament: its name, game, branch, team size and
 * places, fee and prize pool, match length, when sign-up closes and when it
 * starts, and the cover gamers see on its card (without one, the game's
 * poster is shown). A branch admin creates for their own branch; HQ picks it.
 */
export function TournamentForm({ tournament, action, onSaved, onCancel }: { tournament?: Tournament; action: Action; onSaved(t: Tournament): void; onCancel(): void }) {
  const { isHq, branchId, branches, branchName } = useBranchScope();
  const games = useGames().data ?? [];
  const t = tournament;
  const closes = t?.registrationClosesAt ?? daysFromNow(5, 23, 45);
  const starts = t?.startsAt ?? daysFromNow(6, 18);
  const [form, setForm] = useState({
    name: t?.name ?? '',
    gameId: t?.game.id ?? '',
    branchId: t?.branch.id ?? branchId ?? '',
    teamSize: String(t?.teamSize ?? 5),
    maxTeams: String(t?.maxTeams ?? 8),
    entryFeeCoins: String(t?.entryFeeCoins ?? 0),
    prizePoolCoins: String(t?.prizePoolCoins ?? 0),
    matchMinutes: String(t?.matchMinutes ?? 45),
    closesDay: dayOf(closes),
    closesTime: timeOf(closes),
    startsDay: dayOf(starts),
    startsTime: timeOf(starts),
    coverUrl: t?.coverUrl ?? null,
  });
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  // The game's id from the catalog, or (an edited sample) the game it already has.
  const gameOptions = [...games.map((g) => ({ value: g.id, label: g.name })), ...(t && !games.some((g) => g.id === t.game.id) ? [{ value: t.game.id, label: t.game.name }] : [])];

  async function save(e: FormEvent) {
    e.preventDefault();
    const input: TournamentInput = {
      name: form.name,
      coverUrl: form.coverUrl,
      game: { id: form.gameId, name: gameOptions.find((g) => g.value === form.gameId)?.label ?? '' },
      branch: { id: form.branchId, name: branchName(form.branchId) },
      teamSize: Number(form.teamSize),
      maxTeams: Number(form.maxTeams),
      entryFeeCoins: Number(form.entryFeeCoins),
      prizePoolCoins: Number(form.prizePoolCoins),
      matchMinutes: Number(form.matchMinutes),
      registrationClosesAt: isoOf(form.closesDay, form.closesTime),
      startsAt: isoOf(form.startsDay, form.startsTime),
    };
    const saved = await action.run(
      'save-tournament',
      () => (t ? tournamentsService.updateTournament(t.id, input) : tournamentsService.createTournament(input)),
      (x) => `${x.name} ${t ? 'saved' : 'created: sign-up is open'}.`,
    );
    if (saved) onSaved(saved);
  }

  return (
    <form onSubmit={save}>
      <fieldset>
        <legend>{t ? `Edit ${t.name}` : 'New tournament'}</legend>
        <div className="form-row">
          <label htmlFor="tf-name">Name</label>
          <input id="tf-name" required minLength={2} maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </div>
        <div className="form-row">
          <label htmlFor="tf-game">Game</label>
          <Select id="tf-game" required value={form.gameId} onChange={(gameId) => set({ gameId })} placeholder="Pick a game…" options={gameOptions} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-branch">Branch</label>
          {isHq ? (
            <Select id="tf-branch" required value={form.branchId} onChange={(id) => set({ branchId: id })} placeholder="Pick a branch…" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          ) : (
            <span id="tf-branch">{branchName(form.branchId)}</span>
          )}
        </div>
        <div className="form-row">
          <label htmlFor="tf-size">Players per team</label>
          <Select id="tf-size" value={form.teamSize} onChange={(teamSize) => set({ teamSize })} options={TEAM_SIZES.map((n) => ({ value: String(n), label: n === 1 ? 'Solo (1v1)' : `${n}v${n}` }))} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-places">Places</label>
          <Select id="tf-places" value={form.maxTeams} onChange={(maxTeams) => set({ maxTeams })} options={PLACES.map((n) => ({ value: String(n), label: `${n} ${form.teamSize === '1' ? 'players' : 'teams'}` }))} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-fee">Entry fee (coins)</label>
          <input id="tf-fee" type="number" min="0" step="1" required value={form.entryFeeCoins} onChange={(e) => set({ entryFeeCoins: e.target.value })} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-prize">Prize pool (coins)</label>
          <input id="tf-prize" type="number" min="0" step="1" required value={form.prizePoolCoins} onChange={(e) => set({ prizePoolCoins: e.target.value })} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-minutes">Match length (min)</label>
          <input id="tf-minutes" type="number" min="5" max="600" step="5" required value={form.matchMinutes} onChange={(e) => set({ matchMinutes: e.target.value })} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-closes">Sign-up closes</label>
          <DateField id="tf-closes" value={form.closesDay} onChange={(closesDay) => set({ closesDay })} /> <TimeField aria-label="Sign-up closes at" value={form.closesTime} onChange={(closesTime) => set({ closesTime })} />
        </div>
        <div className="form-row">
          <label htmlFor="tf-starts">Starts</label>
          <DateField id="tf-starts" value={form.startsDay} onChange={(startsDay) => set({ startsDay })} /> <TimeField aria-label="Starts at" value={form.startsTime} onChange={(startsTime) => set({ startsTime })} />
        </div>
        <ImageField id="tf-cover" label="Cover" value={form.coverUrl} upload={uploadImage} onChange={(coverUrl) => set({ coverUrl })} onBusy={setUploading} />
        <p className="muted">Without a cover, the card shows the game&apos;s poster. A wide picture fits best.</p>
        <div className="form-row">
          <button type="submit" disabled={action.busy === 'save-tournament' || uploading}>
            {t ? 'Save changes' : 'Create tournament'}
          </button>{' '}
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
