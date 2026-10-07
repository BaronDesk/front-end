import { useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import type { AccountStatus, PublicUser, Role } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { hasRole, ROLE_LABEL } from '../../auth/roles';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { formatDateTime } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { useBranchScope } from '../branches/BranchContext';
import { accountBranchId, canChangeRole, canResetPassword, canSetStatus } from './permissions';
import { EmptyRow } from '../../shared/components/EmptyRow';

const STAFF_ROLES: Role[] = ['EMPLOYEE', 'MANAGER'];
const ALL_ROLES: Role[] = ['GAMER', 'EMPLOYEE', 'MANAGER', 'ADMIN'];
const STATUS_LABEL: Record<AccountStatus, string> = { ACTIVE: 'Active', SUSPENDED: 'Suspended', INACTIVE: 'Inactive', DELETED: 'Deleted' };
const LIST_LIMIT = 100;

/**
 * Secure Access & Roles (brief §6.3): list and search accounts (GET /users),
 * create gamer and staff accounts, change a role, suspend / reactivate an
 * account and reset a lost password. HQ sees everyone; a branch admin sees
 * the gamers and their own branch's staff. The buttons follow the server's
 * rules (./permissions.ts); its 403 FORBIDDEN_ROLE_ESCALATION is the real check.
 */
export function UsersPage() {
  const { user } = useAuth();
  const isHq = hasRole(user, 'ADMIN');
  const { branches, branchId, branchName, scoped } = useBranchScope();
  const action = useAction();
  const [gamer, setGamer] = useState({ username: '', password: '', branchId: branchId ?? '' });
  const [staff, setStaff] = useState({ username: '', password: '', role: 'EMPLOYEE' as Role });
  const [search, setSearch] = useState({ q: '', role: '' });
  const [filter, setFilter] = useState(search);
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const params = new URLSearchParams({ limit: String(LIST_LIMIT) });
  if (filter.q.trim()) params.set('q', filter.q.trim());
  if (filter.role) params.set('role', filter.role);
  const list = useApiQuery<PublicUser[]>(scoped(`/users?${params}`));
  const rows = list.data ?? [];

  function replace(u: PublicUser) {
    list.setData((data) => data?.map((x) => (x.id === u.id ? u : x)));
  }

  async function createGamer(e: FormEvent) {
    e.preventDefault();
    const created = await action.run('gamer', () => api<PublicUser>('POST', '/users', gamer), (u) => `Gamer ${u.username} created.`);
    if (created) {
      list.reload();
      setGamer({ ...gamer, username: '', password: '' });
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
      list.reload();
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
    if (updated) replace(updated);
  }

  async function toggleStatus(u: PublicUser) {
    const suspend = u.accountStatus === 'ACTIVE';
    if (suspend && !window.confirm(`Suspend ${u.username}? They are logged out everywhere and can't log in until reactivated.`)) return;
    const updated = await action.run(
      u.id,
      () => api<PublicUser>('PATCH', `/users/${u.id}/status`, { status: suspend ? 'SUSPENDED' : 'ACTIVE' }),
      (x) => `${x.username} is ${suspend ? 'suspended' : 'active again'}.`,
    );
    if (updated) replace(updated);
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    const target = resetFor;
    const done = await action.run(
      'reset',
      () => api('POST', `/users/${target.id}/password`, { newPassword }),
      `Password of ${target.username} reset. They are logged out and must use the new one.`,
    );
    if (done) {
      setResetFor(null);
      setNewPassword('');
    }
  }

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
              <label htmlFor="g-branch">Home branch</label>
              <select id="g-branch" required value={gamer.branchId} onChange={(e) => setGamer({ ...gamer, branchId: e.target.value })}>
                <option value="">Pick a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
          setFilter(search);
        }}
      >
        <label htmlFor="u-q">Username</label>{' '}
        <input id="u-q" size={24} value={search.q} onChange={(e) => setSearch({ ...search, q: e.target.value })} />{' '}
        <label htmlFor="u-role">Role</label>{' '}
        <select id="u-role" value={search.role} onChange={(e) => setSearch({ ...search, role: e.target.value })}>
          <option value="">All</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>{' '}
        <button type="submit" className="secondary">
          Search
        </button>
        {list.loading && <span className="muted"> loading…</span>}
      </form>
      <ErrorBox error={list.error} />

      <table className="grid">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Branch</th>
            <th>Status</th>
            <th>Created</th>
            <th>Change role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const home = accountBranchId(u);
            return (
              <tr key={u.id}>
                <td>
                  <b>{u.username}</b>
                  {u.id === user?.id && <span className="muted"> (you)</span>}
                </td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{home ? branchName(home) : <span className="muted">{u.role === 'ADMIN' ? 'All (HQ)' : '—'}</span>}</td>
                <td className={u.accountStatus === 'ACTIVE' ? '' : 'status-bad'}>{STATUS_LABEL[u.accountStatus]}</td>
                <td>{formatDateTime(u.createdAt)}</td>
                <td>
                  <select
                    aria-label={`Role of ${u.username}`}
                    value={u.role}
                    disabled={action.busy === u.id || !user || !canChangeRole(user, u)}
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
                <td className="nowrap">
                  {user && canSetStatus(user, u) && (u.accountStatus === 'ACTIVE' || u.accountStatus === 'SUSPENDED') && (
                    <button type="button" className="secondary" disabled={action.busy === u.id} onClick={() => toggleStatus(u)}>
                      {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                    </button>
                  )}{' '}
                  {user && canResetPassword(user, u) && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setResetFor(u);
                        setNewPassword('');
                      }}
                    >
                      Reset password
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {!list.loading && rows.length === 0 && (
            <EmptyRow colSpan={7}>No account matches.</EmptyRow>
          )}
        </tbody>
      </table>
      {rows.length === LIST_LIMIT && <p className="muted">Showing the first {LIST_LIMIT}: search by username to narrow the list.</p>}

      {resetFor && (
        <form onSubmit={resetPassword} style={{ marginTop: 8 }}>
          <fieldset>
            <legend>New password for {resetFor.username}</legend>
            <div className="form-row">
              <label htmlFor="r-pass">New password</label>
              <input
                id="r-pass"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'reset'}>
                Reset password
              </button>{' '}
              <button type="button" className="secondary" onClick={() => setResetFor(null)}>
                Cancel
              </button>
            </div>
            <p className="muted">Give it to them in person. Every login they have ends; they can change it in their settings.</p>
          </fieldset>
        </form>
      )}
    </>
  );
}
