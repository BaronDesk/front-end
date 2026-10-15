import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAction } from '../../../../hooks/useAction';
import { useTournaments } from '../../../../hooks/queries';
import { filterTournaments, TOURNAMENT_FILTERS } from '../../../../domain/tournaments';
import { TournamentCard } from '../../../../components/composites/TournamentCard';
import { cx } from '../../../../lib/cx';
import { ActionMessages } from '../../components/ActionMessages';
import { useBranchScope } from '../../providers/BranchContext';
import { TournamentForm } from './TournamentForm';
import styles from './Tournaments.module.css';

/**
 * Tournaments (branch admins and HQ): the branch's tournaments as the gamers
 * see them, the same cards and filters as the app, each opening its page to
 * run it (Manage); and creating one. HQ sees the branch picked in the
 * header, or all. Sample data until the backend has tournaments.
 */
export function TournamentsPage() {
  const { branchId } = useBranchScope();
  const navigate = useNavigate();
  const action = useAction();
  const all = useTournaments({ staff: true }).data;
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const shown = filterTournaments(branchId ? all.filter((t) => t.branch.id === branchId) : all, filter);

  return (
    <>
      <h1>Tournaments</h1>
      <p className="muted">Sample tournaments until the backend has them: changes last until the page is reloaded.</p>
      <ActionMessages action={action} />

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Show tournaments">
          {TOURNAMENT_FILTERS.map((f) => (
            <button key={f.key} type="button" className={cx(styles.filter, filter === f.key && styles.filterOn)} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}>
            New tournament
          </button>
        )}
      </div>

      {creating && (
        <div className={styles.formWrap}>
          <TournamentForm action={action} onSaved={(t) => navigate(`/tournaments/${t.id}`)} onCancel={() => setCreating(false)} />
        </div>
      )}

      <div className={cx(styles.phone, styles.grid)}>
        {shown.map((t) => (
          <TournamentCard key={t.id} tournament={t} action={{ to: `/tournaments/${t.id}`, label: 'Manage' }} />
        ))}
      </div>
      {shown.length === 0 && <p className="muted">No tournament here yet.</p>}
    </>
  );
}
