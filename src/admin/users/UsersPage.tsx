import { useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import type { PublicUser, Role } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { hasRole, ROLE_LABEL } from '../../auth/roles';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';

const STAFF_ROLES: Role[] = ['EMPLOYEE', 'MANAGER'];
const ALL_ROLES: Role[] = ['GAMER', 'EMPLOYEE', 'MANAGER', 'ADMIN'];

/**
 * Secure Access & Roles (brief §6.3): create gamer and staff accounts and
 * change a role. The backend has no user list, so the page shows the accounts
 * created here and any account opened by its id. A branch admin may only
 * create employees of their own branch; HQ may create and promote anyone
 * (the server enforces it: 403 FORBIDDEN_ROLE_ESCALATION).
 */
export function UsersPage() {
  const { user } = useAuth();
  const isHq = hasRole(user, 'ADMIN');
  const { branchId, branchName } = useBranchScope();
  const action = useAction();
  const [accounts, setAccounts] = useState<PublicUser[]>([]);
  const [gamer, setGamer] = useState({ username: '', password: '' });
  const [staff, setStaff] = useState({ username: '', password: '', role: 'EMPLOYEE' as Role });
  const [lookup, setLookup] = useState('');
  const [openedId, setOpenedId] = useState('');
  const opened = useApiQuery<PublicUser>(openedId ? `/users/${openedId}` : null);

  function remember(u: PublicUser) {
    setAccounts((list) => [u, ...list.filter((x) => x.id !== u.id)]);
  }

  async function createGamer(e: FormEvent) {
    e.preventDefault();
    const created = await action.run('gamer', () => api<PublicUser>('POST', '/users', gamer), (u) => `Gamer ${u.username} created.`);
    if (created) {
      remember(created);
      setGamer({ username: '', password: '' });
    }
  }

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    const created = await action.run(
      'staff',
      () => api<PublicUser>('POST', '/employees', { ...staff, branchId }),
      (u) => `${ROLE_LABEL[u.role]} ${u.username} created in ${branchName(branchId)}.`,
    );
    if (created) {
      remember(created);
      setStaff({ username: '', password: '', role: 'EMPLOYEE' });
    }
  }

  async function changeRole(u: PublicUser, role: Role) {
    const staffRole = role === 'EMPLOYEE' || role === 'MANAGER';
    const newBranch = staffRole ? (u.branchId ?? branchId) : null;
    if (staffRole && !newBranch) {
      action.clear();
      window.alert('Pick a branch in the top bar first: staff belong to one branch.');
      return;
    }
    const updated = await action.run(
      u.id,
      () => api<PublicUser>('PATCH', `/users/${u.id}/role`, { role, branchId: newBranch }),
      (x) => `${x.username} is now ${ROLE_LABEL[x.role]}.`,
    );
    if (updated) {
      remember(updated);
      if (updated.id === openedId) opened.setData(() => updated);
    }
  }

  const rows = [...(opened.data ? [opened.data] : []), ...accounts.filter((a) => a.id !== opened.data?.id)];
  const roleChoices: Role[] = isHq ? ALL_ROLES : ['GAMER', 'EMPLOYEE'];

  return (
    <>
      <h1>Users &amp; Staff</h1>
      <ActionMessages action={action} />

      <div className="columns">
        <form onSubmit={createGamer}>
          <fieldset>
            <legend>New gamer account</legend>
            <div className="form-row">
              <label htmlFor="g-user">Username</label>
              <input id="g-user" required minLength={3} maxLength={64} value={gamer.username} onChange={(e) => setGamer({ ...gamer, username: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="g-pass">Password</label>
              <input id="g-pass" type="password" required minLength={8} value={gamer.password} onChange={(e) => setGamer({ ...gamer, password: e.target.value })} />
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'gamer'}>
                Create gamer
              </button>
            </div>
          </fieldset>
        </form>

        <form onSubmit={createStaff}>
          <fieldset>
            <legend>New staff account</legend>
            {branchId ? (
              <>
                <div className="form-row">
                  <label>Branch</label>
                  <b>{branchName(branchId)}</b>
                </div>
                <div className="form-row">
                  <label htmlFor="s-user">Username</label>
                  <input id="s-user" required minLength={3} maxLength={64} value={staff.username} onChange={(e) => setStaff({ ...staff, username: e.target.value })} />
                </div>
                <div className="form-row">
                  <label htmlFor="s-pass">Password</label>
                  <input id="s-pass" type="password" required minLength={8} value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} />
                </div>
                <div className="form-row">
                  <label htmlFor="s-role">Role</label>
                  <select id="s-role" value={staff.role} onChange={(e) => setStaff({ ...staff, role: e.target.value as Role })}>
                    {STAFF_ROLES.filter((r) => isHq || r === 'EMPLOYEE').map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label />
                  <button type="submit" disabled={action.busy === 'staff'}>
                    Create staff account
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Pick a branch in the top bar: staff belong to one branch.</p>
            )}
          </fieldset>
        </form>
      </div>

      <h2>Accounts</h2>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setOpenedId(lookup.trim());
        }}
      >
        <label htmlFor="u-id">Open an account by id</label>{' '}
        <input id="u-id" size={40} value={lookup} onChange={(e) => setLookup(e.target.value)} />{' '}
        <button type="submit" className="secondary">
          Open
        </button>
      </form>
      <ErrorBox error={opened.error} />

      <table className="grid">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Branch</th>
            <th>Status</th>
            <th>Created</th>
            <th>Change role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <b>{u.username}</b>
                <div className="muted">
                  <code>{u.id}</code>
                </div>
              </td>
              <td>{ROLE_LABEL[u.role]}</td>
              <td>{u.branchId ? branchName(u.branchId) : <span className="muted">—</span>}</td>
              <td>{u.accountStatus}</td>
              <td>{formatDateTime(u.createdAt)}</td>
              <td>
                <select
                  aria-label={`Role of ${u.username}`}
                  value={u.role}
                  disabled={action.busy === u.id || u.id === user?.id}
                  onChange={(e) => changeRole(u, e.target.value as Role)}
                >
                  {roleChoices.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                  {!roleChoices.includes(u.role) && <option value={u.role}>{ROLE_LABEL[u.role]}</option>}
                </select>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Accounts you create or open appear here. The server has no list of all users.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
