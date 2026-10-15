import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import type { Tournament, TournamentMatch } from '../../../../core/api-types';
import { useAction, type Action } from '../../../../hooks/useAction';
import { useTournaments } from '../../../../hooks/queries';
import { tournamentsService } from '../../../../services/tournaments.service';
import { adminSteps, champion, matchesToPlay, roundName, roundCount, STATUS_TEXT, teamOf } from '../../../../domain/tournaments';
import { TournamentBracket } from '../../../../components/composites/TournamentBracket';
import { TournamentCard } from '../../../../components/composites/TournamentCard';
import { TournamentTeams } from '../../../../components/composites/TournamentTeams';
import { cx } from '../../../../lib/cx';
import { ActionMessages } from '../../components/ActionMessages';
import { useBranchScope } from '../../providers/BranchContext';
import { TournamentForm } from './TournamentForm';
import styles from './Tournaments.module.css';

/** The stage buttons, in the tournament's order of life, with what each asks before it acts. */
const STEPS = {
  close: { label: 'Close sign-up', ask: (t: Tournament) => `Close sign-up for ${t.name}? No one can join or leave a team after that.` },
  draw: { label: 'Draw the bracket', ask: (t: Tournament) => `Draw the bracket of ${t.name}? Seeds follow the sign-up order; the top seeds get the byes. Teams are locked from then on.` },
  start: { label: 'Start the tournament', ask: (t: Tournament) => `Start ${t.name}? Results can then be entered, match by match.` },
  reopen: { label: 'Reopen sign-up', ask: null },
  cancel: { label: 'Cancel the tournament', ask: (t: Tournament) => `Cancel ${t.name}?\n\nIt stays listed as cancelled; this cannot be undone.` },
} as const;

/** A match still to play: its round, the two sides and their scores, saved together. */
function ResultRow({ tournament: t, match, action }: { tournament: Tournament; match: TournamentMatch; action: Action }) {
  const [scores, setScores] = useState({ a: '', b: '' });
  const a = teamOf(t, match.teamAId)?.name ?? 'TBD';
  const b = teamOf(t, match.teamBId)?.name ?? 'TBD';
  async function save() {
    const done = await action.run(match.id, () => tournamentsService.reportResult(t.id, match.id, Number(scores.a), Number(scores.b)), (x) =>
      x.status === 'COMPLETED' ? `${x.name} is over: ${champion(x)?.name ?? 'the winner'} wins.` : `Result saved: ${a} ${scores.a} – ${scores.b} ${b}.`,
    );
    if (done) setScores({ a: '', b: '' });
  }
  return (
    <tr>
      <td className="nowrap">{roundName(match.round, roundCount(t))}</td>
      <td>
        <b>{a}</b>
      </td>
      <td>
        <input aria-label={`${a} score`} className={styles.score} type="number" min="0" step="1" required value={scores.a} onChange={(e) => setScores({ ...scores, a: e.target.value })} />
        {' – '}
        <input aria-label={`${b} score`} className={styles.score} type="number" min="0" step="1" required value={scores.b} onChange={(e) => setScores({ ...scores, b: e.target.value })} />
      </td>
      <td>
        <b>{b}</b>
      </td>
      <td>
        <button type="button" disabled={action.busy === match.id || scores.a === '' || scores.b === ''} onClick={save}>
          Save result
        </button>
      </td>
    </tr>
  );
}

/**
 * Running one tournament: its card as gamers see it, its stage and what
 * comes next (close sign-up → draw the bracket → start → results → over),
 * the results to enter, the bracket and the teams (removable until the
 * draw), editing while nothing is drawn, cancelling and deleting.
 */
export function TournamentManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isHq, branchId } = useBranchScope();
  const action = useAction();
  const [editing, setEditing] = useState(false);
  const t = useTournaments({ staff: true }).data.find((x) => x.id === id);

  if (!t) {
    return (
      <>
        <h1>Tournament not found</h1>
        <p>
          It doesn&apos;t exist (any more): <Link to="/tournaments">back to the tournaments</Link>.
        </p>
      </>
    );
  }
  if (!isHq && t.branch.id !== branchId) {
    return (
      <>
        <h1>{t.name}</h1>
        <p className="msg msg-error">This tournament belongs to another branch.</p>
      </>
    );
  }

  const winner = champion(t);
  const steps = adminSteps(t);
  const editable = !t.matches.length && (t.status === 'REGISTRATION_OPEN' || t.status === 'REGISTRATION_CLOSED');
  const toPlay = t.status === 'IN_PROGRESS' ? matchesToPlay(t) : [];
  const solo = t.teamSize === 1;

  async function step(s: keyof typeof STEPS) {
    const ask = STEPS[s].ask;
    if (ask && !window.confirm(ask(t!))) return;
    await action.run(s, () => (s === 'draw' ? tournamentsService.drawBracket(t!.id) : tournamentsService.setStage(t!.id, s)), `${STEPS[s].label}: done.`);
  }

  async function remove(teamId: string, name: string) {
    if (!window.confirm(`Take ${name} out of ${t!.name}?`)) return;
    await action.run(teamId, () => tournamentsService.removeTeam(t!.id, teamId), `${name} is out of the tournament.`);
  }

  async function destroy() {
    if (!window.confirm(`Delete ${t!.name}?\n\nIts teams, bracket and results go with it, for good.`)) return;
    const done = await action.run('delete', () => tournamentsService.deleteTournament(t!.id));
    if (done) navigate('/tournaments');
  }

  return (
    <>
      <p className={styles.back}>
        <Link to="/tournaments">‹ Tournaments</Link>
      </p>
      <h1>{t.name}</h1>
      <ActionMessages action={action} />

      <div className={styles.layout}>
        <aside className={styles.side}>
          <div className={styles.phone}>
            <TournamentCard tournament={t} />
          </div>
          {winner && (
            <p className={styles.champion}>
              Champion: <b>{winner.name}</b>
            </p>
          )}
          <fieldset>
            <legend>Stage: {STATUS_TEXT[t.status]}</legend>
            <div className={styles.steps}>
              {steps.map((s) => (
                <button key={s} type="button" className={cx(s === 'cancel' && 'danger', s === 'reopen' && 'secondary')} disabled={action.busy === s} onClick={() => step(s)}>
                  {STEPS[s].label}
                </button>
              ))}
              {editable && !editing && (
                <button type="button" className="secondary" onClick={() => setEditing(true)}>
                  Edit details
                </button>
              )}
              <button type="button" className="danger" disabled={action.busy === 'delete'} onClick={destroy}>
                Delete
              </button>
            </div>
            {!steps.length && <p className="muted">{t.status === 'COMPLETED' ? 'This tournament is over.' : 'This tournament was cancelled.'}</p>}
          </fieldset>
        </aside>

        <section className={styles.main}>
          {editing && <TournamentForm tournament={t} action={action} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />}

          {t.status === 'IN_PROGRESS' && (
            <>
              <h2>Results to enter</h2>
              {toPlay.length ? (
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Side A</th>
                      <th>Score</th>
                      <th>Side B</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {toPlay.map((m) => (
                      <ResultRow key={m.id} tournament={t} match={m} action={action} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Every match ready to play has its result; the next ones appear as winners move on.</p>
              )}
            </>
          )}

          <h2>Bracket</h2>
          {t.matches.length ? (
            <div className={styles.phone}>
              <TournamentBracket tournament={t} />
            </div>
          ) : (
            <p className="muted">{t.status === 'REGISTRATION_OPEN' ? 'Drawn once sign-up is closed.' : 'Not drawn yet: Draw the bracket, on the left.'}</p>
          )}

          <h2>
            {solo ? 'Players' : 'Teams'} ({t.teams.length}/{t.maxTeams})
          </h2>
          <div className={styles.phone}>
            <TournamentTeams
              tournament={t}
              className={styles.teams}
              extra={
                t.matches.length
                  ? undefined
                  : (team) => (
                      <button type="button" className={cx('danger', styles.remove)} disabled={action.busy === team.id} onClick={() => remove(team.id, team.name)}>
                        Remove
                      </button>
                    )
              }
            />
          </div>
        </section>
      </div>
    </>
  );
}
