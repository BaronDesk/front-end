import { useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import type { Branch, LoginResponse, PublicUser } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { saveTokens } from '../../auth/tokens';
import { ErrorBox } from '../../shared/ErrorBox';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { BranchSelect } from '../BranchSelect';

/** Settings: the branch the gamer plays at (their booking page follows it) and their password. */
export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const branches = useApiQuery<Branch[]>('/branches');
  const action = useAction();
  const [branchId, setBranchId] = useState(user?.homeBranchId ?? '');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  async function saveBranch(e: FormEvent) {
    e.preventDefault();
    const name = branches.data?.find((b) => b.id === branchId)?.name ?? 'your branch';
    const updated = await action.run(
      'branch',
      () => api<PublicUser>('PATCH', '/users/me/branch', { branchId }),
      `You now play at ${name}: booking shows its stations.`,
    );
    if (updated) updateUser(updated);
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const tokens = await action.run(
      'password',
      () => api<LoginResponse>('POST', '/auth/change-password', passwords),
      'Password changed. You were logged out everywhere else.',
    );
    if (tokens) {
      saveTokens(tokens);
      setPasswords({ currentPassword: '', newPassword: '' });
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <ActionMessages action={action} />
      <ErrorBox error={branches.error} />

      <form onSubmit={saveBranch}>
        <fieldset>
          <legend>Where you play</legend>
          <div className="form-row">
            <label htmlFor="st-branch">Branch</label>
            <BranchSelect id="st-branch" branches={branches.data} value={branchId} onChange={setBranchId} />
          </div>
          <div className="form-row">
            <label />
            <button type="submit" disabled={!branchId || branchId === user?.homeBranchId || action.busy === 'branch'}>
              Save
            </button>
          </div>
        </fieldset>
      </form>

      <form onSubmit={changePassword}>
        <fieldset>
          <legend>Password</legend>
          <div className="form-row">
            <label htmlFor="st-current">Current password</label>
            <input
              id="st-current"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="st-new">New password</label>
            <input
              id="st-new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label />
            <button type="submit" disabled={action.busy === 'password'}>
              Change password
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
