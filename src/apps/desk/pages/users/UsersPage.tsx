import { useState, type FormEvent } from 'react';

import type { AccountStatus, PublicUser, Role } from '../../../../core/api-types';
import { useAuth } from '../../../../providers/AuthProvider';
import { hasRole, ROLE_LABEL } from '../../../../core/auth/roles';
import { ErrorBox } from '../../components/ErrorBox';
import { Thumb } from '../../components/Thumb';
import { formatDateTime } from '../../../../lib/format';
import { ActionMessages } from '../../components/ActionMessages';
import { useAction } from '../../../../hooks/useAction';
import { useApiQuery } from '../../../../hooks/useApiQuery';
import { useBranchScope } from '../../providers/BranchContext';
import { accountBranchId, canChangeRole, canSetStatus } from '../../../../domain/permissions';
import { EmptyRow } from '../../components/EmptyRow';
import { usersService } from '../../../../services/users.service';
import { Select } from '../../../../components/primitives/Select';

const STAFF_ROLES: Role[] = ['EMPLOYEE', 'MANAGER'];
const ALL_ROLES: Role[] = ['GAMER', 'EMPLOYEE', 'MANAGER', 'ADMIN'];
const STATUS_LABEL: Record<AccountStatus, string> = { ACTIVE: 'Active', SUSPENDED: 'Suspended', INACTIVE: 'Inactive', DELETED: 'Deleted' };
const LIST_LIMIT = 100;

/**
 * Accounts and roles: list and search accounts (GET /users),
 * create gamer and staff accounts, change a role, suspend / reactivate an
 * account. Nobody sets another person's password: each user changes their own
 * on My account. HQ sees everyone; a branch admin sees
 * the gamers and their own branch's staff. The buttons follow the server's
 * rules (domain/permissions.ts); its 403 FORBIDDEN_ROLE_ESCALATION is the real check.
 */
export function UsersPage() {
  const { user } = useAuth();
  const isHq = hasRole(user, 'ADMIN');
  const { branches, branchId, branchName, scoped } = useBranchScope();
  const action = useAction();
  const [gamer, setGamer] = useState({ username: '', password: '', branchId: branchId ?? '' });
  const [staff, setStaff] = useState({ username: '', password: '', branchId: branchId ?? '', role: 'EMPLOYEE' as Role });
  const [search, setSearch] = useState({ q: '', role: '' });
  const [filter, setFilter] = useState(search);

  const params = new URLSearchParams({ limit: String(LIST_LIMIT) });
  if (filter.q.trim()) params.set('q', filter.q.trim());
  if (filter.role) params.set('role', filter.role);
  const list = useApiQuery<PublicUser[]>(scoped(usersService.paths.list(params)));
  const rows = list.data ?? [];

  function replace(u: PublicUser) {
    list.setData((data) => data?.map((x) => (x.id === u.id ? u : x)));
  }

  async function createGamer(e: FormEvent) {
    e.preventDefault();
    const created = await action.run('gamer', () => usersService.createGamer(gamer), (u) => `Gamer ${u.username} created.`);
    if (created) {
      list.reload();
      setGamer({ ...gamer, username: '', password: '' });
    }
  }

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    const created = await action.run('staff', () => usersService.createEmployee(staff), (u) => `${ROLE_LABEL[u.role]} ${u.username} created in ${branchName(staff.branchId)}.`);
    if (created) {
      list.reload();
      setStaff({ ...staff, username: '', password: '', role: 'EMPLOYEE' });
    }
  }

  async function changeRole(u: PublicUser, role: Role) {
    const staffRole = role === 'EMPLOYEE' || role === 'MANAGER';
    const newBranch = staffRole ? (u.branchId ?? branchId) : null;
    if (staffRole && !newBranch) {
      action.clear();
      window.alert('Pick a branch in the header first: staff belong to one branch.');
      return;
    }
    const updated = await action.run(
      u.id,
      () => usersService.setRole(u.id, role, newBranch),
      (x) => `${x.username} is now ${ROLE_LABEL[x.role]}.`,
    );
    if (updated) replace(updated);
  }

  async function toggleStatus(u: PublicUser) {
    const suspend = u.accountStatus === 'ACTIVE';
    if (suspend && !window.confirm(`Suspend ${u.username}? They are logged out everywhere and can't log in until reactivated.`)) return;
    const updated = await action.run(
      u.id,
      () => usersService.setSuspended(u.id, suspend),
      (x) => `${x.username} is ${suspend ? 'suspended' : 'active again'}.`,
    );
    if (updated) replace(updated);
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
              <Select
                id="g-branch"
                required
                value={gamer.branchId}
                onChange={(branchId) => setGamer({ ...gamer, branchId })}
                placeholder="Pick a branch…"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
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
            <div className="form-row">
              <label htmlFor="s-user">Username</label>
              <input id="s-user" required minLength={3} maxLength={64} value={staff.username} onChange={(e) => setStaff({ ...staff, username: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="s-pass">Password</label>
              <input id="s-pass" type="password" required minLength={8} value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="s-branch">Branch</label>
              <Select
                id="s-branch"
                required
                value={staff.branchId}
                onChange={(branchId) => setStaff({ ...staff, branchId })}
                placeholder="Pick a branch…"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="s-role">Role</label>
              <Select
                id="s-role"
                value={staff.role}
                onChange={(v) => setStaff({ ...staff, role: v as Role })}
                options={STAFF_ROLES.filter((r) => isHq || r === 'EMPLOYEE').map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              />
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'staff'}>
                Create staff account
              </button>
            </div>
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
        <Select
          id="u-role"
          value={search.role}
          onChange={(role) => setSearch({ ...search, role })}
          options={[{ value: '', label: 'All' }, ...ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
        />{' '}
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
                  <span className="with-thumb">
                    <Thumb url={u.avatarUrl} size={24} round />
                    <b>{u.username}</b>
                  </span>
                  {u.id === user?.id && <span className="muted"> (you)</span>}
                </td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{home ? branchName(home) : <span className="muted">{u.role === 'ADMIN' ? 'All (HQ)' : '—'}</span>}</td>
                <td className={u.accountStatus === 'ACTIVE' ? '' : 'status-bad'}>{STATUS_LABEL[u.accountStatus]}</td>
                <td>{formatDateTime(u.createdAt)}</td>
                <td>
                  <Select
                    aria-label={`Role of ${u.username}`}
                    value={u.role}
                    disabled={action.busy === u.id || !user || !canChangeRole(user, u)}
                    onChange={(v) => changeRole(u, v as Role)}
                    options={[...roleChoices, ...(roleChoices.includes(u.role) ? [] : [u.role])].map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                  />
                </td>
                <td className="nowrap">
                  {user && canSetStatus(user, u) && (u.accountStatus === 'ACTIVE' || u.accountStatus === 'SUSPENDED') && (
                    <button type="button" className={u.accountStatus === 'ACTIVE' ? 'danger' : 'secondary'} disabled={action.busy === u.id} onClick={() => toggleStatus(u)}>
                      {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
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

    </>
  );
}
