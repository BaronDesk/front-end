import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import type { Tournament, TournamentTeam } from '../../../../core/api-types';
import { useAuth } from '../../../../providers/AuthProvider';
import { useAction } from '../../../../hooks/useAction';
import { useTournaments } from '../../../../hooks/queries';
import { tournamentsService } from '../../../../services/tournaments.service';
import { champion, teamCells, teamOf } from '../../../../domain/tournaments';
import threeDots from '../../../../components/assets/three-dots.svg';
import crown from '../../../../components/assets/crown.svg';
import trash from '../../../../components/assets/trash.svg';
import { ART, Art } from '../../../../components/primitives/Art';
import { Avatar } from '../../../../components/primitives/Avatar';
import { ActionNote } from '../../../../components/primitives/Notice';
import { EmptyScreen } from '../../../../components/composites/EmptyScreen';
import { TournamentBracket } from '../../../../components/composites/TournamentBracket';
import { TournamentCard } from '../../../../components/composites/TournamentCard';
import { TournamentTeams } from '../../../../components/composites/TournamentTeams';
import { cx } from '../../../../lib/cx';
import { PlayerHeader } from './TournamentParts';
import { JOIN_SHIFT, teamPanelPath } from './teamPanelPath';
import styles from './TournamentPage.module.css';

/** How long the panel's opening takes to slide between Create Team and Join Team. */
const SLIDE_MS = 380;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/** A number that glides to `target` (one step per frame) when `animate`, else jumps there. */
function useGlide(target: number, animate: boolean): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (!animate || from === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const p = Math.min((now - start) / SLIDE_MS, 1);
      current.current = from + (target - from) * easeInOut(p);
      setValue(current.current);
      if (p < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, animate]);
  return value;
}

/**
 * The panel's shape, drawn live so its opening can slide: a thin outline on
 * the inside of the edge under Create Team, filled in under Join Team; it
 * fills in as the opening slides over, so both arrive together.
 */
function PanelShape({ shift }: { shift: number }) {
  const clip = `panel-${useId().replace(/[^\w-]/g, '')}`;
  const d = teamPanelPath(shift);
  return (
    <svg className={styles.panelShape} viewBox="0 0 309 194" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} className={styles.panelFill} style={{ fillOpacity: shift / JOIN_SHIFT }} />
      <path d={d} className={styles.panelEdge} clipPath={`url(#${clip})`} />
    </svg>
  );
}

/**
 * Signing up while it is open, as the design draws it: Create Team (an
 * outlined button) and Join Team (a filled one). The chosen one opens a
 * panel growing out of it, outlined or filled like the button: a team name
 * or the PIN a captain shared, the terms, Confirm. Solo play: one button,
 * the gamer signs up under their own name.
 * The panel stays in the page, so it can move: it unfolds from the button;
 * switching Create ↔ Join slides its opening from one button to the other
 * while it fills in (or empties) and its colours change; it folds back up
 * when closed (`shown` keeps its look while it does).
 */
function SignUp({ tournament: t, username }: { tournament: Tournament; username: string }) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [shown, setShown] = useState<'create' | 'join'>('create');
  // Slide only from one open panel to the other; opening jumps straight to the button.
  const [sliding, setSliding] = useState(false);
  const [text, setText] = useState('');
  const [agreed, setAgreed] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const action = useAction();
  const solo = t.teamSize === 1;
  const view = mode ?? shown;
  const shift = useGlide(view === 'join' ? JOIN_SHIFT : 0, sliding);

  // The field takes the focus once its panel opens (not on load, while it is folded away).
  useEffect(() => {
    if (mode) field.current?.focus({ preventScroll: true });
  }, [mode]);

  function choose(next: 'create' | 'join') {
    setSliding(mode !== null && mode !== next);
    setMode(mode === next ? null : next);
    setShown(next);
    setText('');
    setAgreed(false);
    action.clear();
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    const done = await action.run('signup', () => (mode === 'join' ? tournamentsService.joinTeam(t.id, text) : tournamentsService.createTeam(t.id, text)));
    if (done) setMode(null);
  }

  return (
    <>
      <div className={cx(styles.signup, mode && styles.signupOpen)}>
        <PanelShape shift={shift} />
        <button type="button" className={cx(styles.choice, styles.create, mode === 'create' && styles.choiceOpen)} aria-expanded={mode === 'create'} onClick={() => choose('create')}>
          {solo ? 'Join Tournament' : 'Create Team'}
        </button>
        {!solo && (
          <button type="button" className={cx(styles.choice, styles.join, mode === 'join' && styles.choiceOpen)} aria-expanded={mode === 'join'} onClick={() => choose('join')}>
            Join Team
          </button>
        )}
        <form className={cx(styles.panel, mode && styles.panelShown, view === 'join' && styles.panelDark)} onSubmit={confirm} inert={!mode} aria-hidden={!mode}>
          {solo ? (
            <p className={cx(styles.field, styles.fieldFixed)}>Playing as {username}</p>
          ) : (
            <input
              key={view}
              ref={field}
              className={styles.field}
              aria-label={view === 'join' ? 'Pin code' : 'Team name'}
              placeholder={view === 'join' ? 'Pin Code' : 'Team Name'}
              required
              value={text}
              onChange={(e) => setText(view === 'join' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
              inputMode={view === 'join' ? 'numeric' : undefined}
              minLength={view === 'join' ? 6 : 2}
              maxLength={view === 'join' ? 6 : 24}
            />
          )}
          <label className={styles.terms}>
            <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I have read and agree to the <Link to="/terms">terms and conditions.</Link>
            </span>
          </label>
          <button type="submit" className={styles.confirm} disabled={action.busy === 'signup'}>
            Confirm
          </button>
        </form>
      </div>
      <ActionNote action={action} className={styles.signupNote} />
    </>
  );
}

/**
 * The gamer's team: its name, how full it is, the PIN teammates join with,
 * and its menu (⋮): a player can leave the team; the leader can give the
 * lead to a teammate, remove someone, make a new team code (the old one stops
 * working), or delete the team (after a warning).
 * Solo play: leave the tournament. Once sign-up closes the team is locked:
 * the menu still opens, its choices greyed out, and says so. Below, a cell per
 * player place: the members in the middle, the leader crowned; the leader
 * can also take a player off with the bin over them.
 */
function TeamCard({ tournament: t, team, username }: { tournament: Tournament; team: TournamentTeam; username: string }) {
  // The menu's page: its main list, or the teammates to pick from for a leader move.
  const [menu, setMenu] = useState<'main' | 'leader' | 'remove' | null>(null);
  const menuArea = useRef<HTMLDivElement>(null);
  const action = useAction();
  const open = t.status === 'REGISTRATION_OPEN';
  const leader = team.members[0];
  const iLead = leader === username;
  const solo = t.teamSize === 1;
  const teammates = team.members.filter((m) => m !== username);
  const filled = Math.min(team.members.length, t.teamSize);

  // A tap outside the menu, or Escape, closes it.
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => !menuArea.current?.contains(e.target as Node) && setMenu(null);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);

  async function leave() {
    setMenu(null);
    if (window.confirm(`Leave ${team.name}? You can join a team again while sign-up is open.`)) {
      await action.run('leave', () => tournamentsService.leaveTeam(t.id));
    }
  }

  async function leaveSolo() {
    setMenu(null);
    if (window.confirm(`Leave ${t.name}? You can sign up again while sign-up is open.`)) {
      await action.run('leave', () => tournamentsService.deleteTeam(t.id));
    }
  }

  async function makeLeader(member: string) {
    setMenu(null);
    if (window.confirm(`Make ${member} the team leader? Only they will manage ${team.name} from then on.`)) {
      await action.run('leader', () => tournamentsService.changeLeader(t.id, member), `${member} is now the team leader.`);
    }
  }

  async function remove(member: string) {
    setMenu(null);
    if (window.confirm(`Remove ${member} from ${team.name}?`)) {
      await action.run(member, () => tournamentsService.removeMember(t.id, member), `${member} is off the team.`);
    }
  }

  async function regenerateCode() {
    setMenu(null);
    if (window.confirm(`Make a new code for ${team.name}? The current one (${team.joinCode}) stops working: share the new one with your teammates.`)) {
      await action.run('code', () => tournamentsService.regenerateCode(t.id), (next) => `New team code: ${next.teams.find((x) => x.id === next.myTeamId)?.joinCode}.`);
    }
  }

  async function deleteTeam() {
    setMenu(null);
    if (window.confirm(`Delete ${team.name}?\n\nEvery player in it leaves the tournament, and the team cannot be brought back.`)) {
      await action.run('delete', () => tournamentsService.deleteTeam(t.id));
    }
  }

  return (
    <>
      <section className={styles.teamCard} aria-label="Your team">
        <div className={styles.teamHead}>
          <h2 className={styles.teamName}>{team.name}</h2>
          {t.teamSize > 1 && (
            <span className={styles.teamBar} role="img" aria-label={`${filled} of ${t.teamSize} players`}>
              {Array.from({ length: t.teamSize }, (_, i) => (
                <span key={i} className={i < filled ? styles.teamBarOn : undefined} />
              ))}
            </span>
          )}
          {team.joinCode && (
            <span className={styles.teamPin} title="Teammates join with this PIN">
              {team.joinCode}
            </span>
          )}
          <div ref={menuArea}>
            <button type="button" className={styles.teamMenuButton} aria-label="Team options" aria-haspopup="menu" aria-expanded={!!menu} onClick={() => setMenu(menu ? null : 'main')}>
              <Art src={threeDots} w={ART.threeDots[0]} h={ART.threeDots[1]} />
            </button>
            {menu === 'main' && (
              <div className={styles.teamMenu} role="menu" aria-label="Team options">
                {!open && <p className={styles.teamMenuTitle}>Teams are locked once sign-up closes.</p>}
                {solo ? (
                  <button type="button" role="menuitem" className={styles.danger} disabled={!open} onClick={leaveSolo}>
                    Leave the tournament
                  </button>
                ) : iLead ? (
                  <>
                    <button type="button" role="menuitem" disabled={!open || !teammates.length} onClick={() => setMenu('leader')}>
                      Change the team leader
                      {open && !teammates.length && <small>No teammate yet</small>}
                    </button>
                    <button type="button" role="menuitem" disabled={!open || !teammates.length} onClick={() => setMenu('remove')}>
                      Remove someone
                      {open && !teammates.length && <small>No teammate yet</small>}
                    </button>
                    <button type="button" role="menuitem" disabled={!open} onClick={regenerateCode}>
                      Regenerate the code
                    </button>
                    <button type="button" role="menuitem" className={styles.danger} disabled={!open} onClick={deleteTeam}>
                      Delete the team
                    </button>
                  </>
                ) : (
                  <button type="button" role="menuitem" className={styles.danger} disabled={!open} onClick={leave}>
                    Leave the team
                  </button>
                )}
              </div>
            )}
            {(menu === 'leader' || menu === 'remove') && (
              <div className={styles.teamMenu} role="menu" aria-label={menu === 'leader' ? 'New team leader' : 'Remove a player'}>
                <p className={styles.teamMenuTitle}>{menu === 'leader' ? 'Who leads the team now?' : 'Who leaves the team?'}</p>
                {teammates.map((member) => (
                  <button key={member} type="button" role="menuitem" className={menu === 'remove' ? styles.danger : undefined} onClick={() => (menu === 'leader' ? makeLeader(member) : remove(member))}>
                    {member}
                  </button>
                ))}
                <button type="button" role="menuitem" className={styles.teamMenuBack} onClick={() => setMenu('main')}>
                  ‹ Back
                </button>
              </div>
            )}
          </div>
        </div>
        <ul className={styles.teamCells} style={{ gridTemplateColumns: `repeat(${t.teamSize}, 1fr)` }}>
          {teamCells(t.teamSize, team.members).map((member, i) => (
            <li key={member ?? `free-${i}`}>
              {member && (
                <>
                  {member === leader ? (
                    <Art className={styles.crown} src={crown} w={ART.crown[0]} h={ART.crown[1]} alt="Team leader" />
                  ) : (
                    open &&
                    iLead && (
                      <button type="button" className={styles.remove} aria-label={`Take ${member} off the team`} disabled={action.busy === member} onClick={() => remove(member)}>
                        <Art src={trash} w={ART.trash[0]} h={ART.trash[1]} />
                      </button>
                    )
                  )}
                  <Avatar className={styles.memberAvatar} url={null} size={53} />
                  <span className={styles.memberName}>{member}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      <ActionNote action={action} className={styles.signupNote} />
    </>
  );
}

/**
 * A tournament: its card, then signing up (Create Team / Join Team) or the
 * gamer's team, the teams and the bracket round by round (the gamer's
 * matches framed in gold).
 */
export function TournamentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const tournament = useTournaments().data.find((t) => t.id === id);

  if (!tournament) {
    return (
      <EmptyScreen title="Not found" text="This tournament does not exist (any more).">
        <Link to="/events" className={styles.backLink}>
          Back to the tournaments
        </Link>
      </EmptyScreen>
    );
  }

  const t = tournament;
  const winner = champion(t);
  const solo = t.teamSize === 1;
  const mine = teamOf(t, t.myTeamId);
  const username = user?.username ?? 'You';

  return (
    <div className={styles.root}>
      <PlayerHeader />

      <TournamentCard tournament={t} heading="h1" className={styles.card} />
      {winner && (
        <p className={styles.champion}>
          Champion: <b>{winner.name}</b>
        </p>
      )}

      {mine ? <TeamCard tournament={t} team={mine} username={username} /> : t.status === 'REGISTRATION_OPEN' && <SignUp tournament={t} username={username} />}

      <h2 className={styles.sectionTitle}>{solo ? 'Current Players' : 'Current Teams'}</h2>
      <TournamentTeams tournament={t} />

      <h2 className={styles.sectionTitle}>Brackets</h2>
      {t.matches.length ? <TournamentBracket tournament={t} /> : <p className={styles.empty}>The bracket is drawn when sign-up closes.</p>}
    </div>
  );
}
