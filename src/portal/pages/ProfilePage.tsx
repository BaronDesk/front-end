import type { GamerProfile, Membership, Subscription } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';

function day(iso: string): string {
  return formatDateTime(iso).slice(0, 5);
}

/** Level, membership tier and passes (brief §6.9). Tiers and passes are sold at the desk. */
export function ProfilePage() {
  const { user } = useAuth();
  const id = user?.id ?? '';
  const profile = useApiQuery<GamerProfile>(`/users/${id}/profile`);
  const membership = useApiQuery<Membership | null>(`/users/${id}/membership`);
  const passes = useApiQuery<Subscription[]>(`/users/${id}/subscriptions`);

  const now = Date.now();
  const activePasses = (passes.data ?? []).filter((p) => Date.parse(p.endsAt) > now && p.hoursLeft > 0);
  const m = membership.data;

  return (
    <>
      <h1>My profile</h1>
      <ErrorBox error={profile.error ?? membership.error ?? passes.error} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Username</th>
            <td>
              <b>{user?.username}</b>
            </td>
          </tr>
          <tr>
            <th>Level</th>
            <td>{profile.data ? profile.data.level : '…'}</td>
          </tr>
          <tr>
            <th>XP</th>
            <td>{profile.data ? profile.data.xp : '…'}</td>
          </tr>
          <tr>
            <th>Member since</th>
            <td>{user ? day(user.createdAt) : '—'}</td>
          </tr>
        </tbody>
      </table>

      <h2>Membership</h2>
      {m ? (
        <p>
          <b>{m.planName}</b>: {m.discountPercent} % off play time, until {day(m.endsAt)}.
        </p>
      ) : (
        <p className="muted">{membership.loading ? 'Loading…' : 'No membership. Ask at the desk for a tier with a discount.'}</p>
      )}

      <h2>Passes</h2>
      {activePasses.length === 0 && <p className="muted">{passes.loading ? 'Loading…' : 'No active pass.'}</p>}
      {activePasses.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>Pass</th>
              <th>Hours left</th>
              <th>Until</th>
            </tr>
          </thead>
          <tbody>
            {activePasses.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.planName}</b>
                </td>
                <td>{Math.round(p.hoursLeft * 10) / 10} h</td>
                <td>{day(p.endsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
