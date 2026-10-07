import { useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import type { Branch, PublicUser } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ChangePasswordForm } from '../../shared/components/ChangePasswordForm';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { BranchSelect } from './BranchSelect';

/** Settings: the branch the gamer plays at (their booking page follows it) and their password. */
export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const branches = useApiQuery<Branch[]>('/branches');
  const action = useAction();
  const [branchId, setBranchId] = useState(user?.homeBranchId ?? '');

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

      <ChangePasswordForm />
    </>
  );
}
