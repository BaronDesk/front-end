import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { PublicUser, Role } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABEL } from '../../auth/roles';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';

const STAFF_ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'ADMIN'];

export function UsersPage() {
  const { user: me } = useAuth();
  const { isHq, branches, branchId, branchName, scoped } = useBranchScope();
  // Gamers are global; the staff list follows HQ's branch choice.
  const users = useApiQuery<PublicUser[]>(scoped('/users'));
  const action = useAction();

  const [q, setQ] = useState('');
  const [gamerForm, setGamerForm] = useState({ username: '', password: '' });
  const emptyStaff = { username: '', password: '', role: 'EMPLOYEE' as Role, branchId: branchId ?? '' };
  const [staffForm, setStaffForm] = useState(emptyStaff);
  const [roleDraft, setRoleDraft] = useState<Record<string, Role>>({});

  const all = users.data ?? [];
  const gamers = all
    .filter((u) => u.role === 'GAMER' && u.username.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.username.localeCompare(b.username));
  const staff = all.filter((u) => u.role !== 'GAMER').sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username));
  // Branch admins manage staff of their own branch; only HQ creates managers or HQ users.
  const assignableRoles: Role[] = isHq ? ['GAMER', 'EMPLOYEE', 'MANAGER', 'ADMIN'] : ['GAMER', 'EMPLOYEE'];

  async function createGamer(e: FormEvent) {
    e.preventDefault();
    const created = await action.run('create-gamer', () => api<PublicUser>('POST', '/users', gamerForm), (u) => `Gamer ${u.username} created.`);
    if (created) {
      setGamerForm({ username: '', password: '' });
      users.reload();
    }
  }

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    const body = { ...staffForm, branchId: isHq ? staffForm.branchId : me?.branchId };
    const created = await action.run('create-staff', () => api<PublicUser>('POST', '/employees', body), (u) => `${ROLE_LABEL[u.role]} ${u.username} created.`);
    if (created) {
      setStaffForm(emptyStaff);
      users.reload();
    }
  }

  async function changeRole(u: PublicUser) {
    const role = roleDraft[u.id] ?? u.role;
    if (role === u.role) return;
    const updated = await action.run(u.id, () => api<PublicUser>('PATCH', `/users/${u.id}/role`, { role }), (x) => `${x.username} is now ${ROLE_LABEL[x.role]}.`);
    if (updated) users.setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function setStatus(u: PublicUser, accountStatus: 'ACTIVE' | 'DEACTIVATED') {
    if (accountStatus === 'DEACTIVATED' && !window.confirm(`Deactivate ${u.username}? They can no longer log in.`)) return;
    const updated = await action.run(
      u.id,
      () => api<PublicUser>('PATCH', `/users/${u.id}/status`, { accountStatus }),
      (x) => `${x.username} ${x.accountStatus === 'ACTIVE' ? 'reactivated' : 'deactivated'}.`,
    );
    if (updated) users.setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)));
  }

  return (
    <>
      <h1>Users &amp; Staff</h1>
      <ActionMessages action={action} />
      <ErrorBox error={users.error} />

      <h2>Gamers</h2>
      <div className="columns">
        <div>
          <div className="toolbar">
            <label htmlFor="q">Search</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="username" />
            <span className="muted"> {gamers.length} gamer(s)</span>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Username</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gamers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/users/${u.id}`}>
                      <b>{u.username}</b>
                    </Link>
                  </td>
                  <td className={u.accountStatus === 'ACTIVE' ? '' : 'status-bad'}>{u.accountStatus}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td className="nowrap">
                    <Link to={`/users/${u.id}`}>Profile »</Link> &nbsp;
                    <Link to={`/wallet?user=${u.id}`}>Wallet »</Link>
                  </td>
                </tr>
              ))}
              {!users.loading && gamers.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No gamer found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={createGamer}>
          <fieldset>
            <legend>New gamer account</legend>
            <div className="form-row">
              <label htmlFor="g-user">Username</label>
              <input id="g-user" required minLength={3} value={gamerForm.username} onChange={(e) => setGamerForm({ ...gamerForm, username: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="g-pass">Password</label>
              <input id="g-pass" type="password" required minLength={8} value={gamerForm.password} onChange={(e) => setGamerForm({ ...gamerForm, password: e.target.value })} />
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'create-gamer'}>
                {action.busy === 'create-gamer' ? 'Creating…' : 'Create gamer'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>

      <h2>Staff</h2>
      <div className="columns">
        <table className="grid">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Change role</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.username}</b>
                    {self && <span className="muted"> (you)</span>}
                  </td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{branchName(u.branchId)}</td>
                  <td className={u.accountStatus === 'ACTIVE' ? '' : 'status-bad'}>{u.accountStatus}</td>
                  <td className="nowrap">
                    {self ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        <select
                          aria-label={`Role of ${u.username}`}
                          value={roleDraft[u.id] ?? u.role}
                          onChange={(e) => setRoleDraft({ ...roleDraft, [u.id]: e.target.value as Role })}
                        >
                          {[...new Set([u.role, ...assignableRoles])].map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>{' '}
                        <button type="button" className="secondary" disabled={action.busy === u.id || (roleDraft[u.id] ?? u.role) === u.role} onClick={() => changeRole(u)}>
                          Save
                        </button>
                      </>
                    )}
                  </td>
                  <td>
                    {self ? (
                      <span className="muted">—</span>
                    ) : u.accountStatus === 'ACTIVE' ? (
                      <button type="button" className="secondary" disabled={action.busy === u.id} onClick={() => setStatus(u, 'DEACTIVATED')}>
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" className="secondary" disabled={action.busy === u.id} onClick={() => setStatus(u, 'ACTIVE')}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form onSubmit={createEmployee}>
          <fieldset>
            <legend>New staff account</legend>
            <div className="form-row">
              <label htmlFor="s-user">Username</label>
              <input id="s-user" required minLength={3} value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="s-pass">Password</label>
              <input id="s-pass" type="password" required minLength={8} value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="s-role">Role</label>
              <select id="s-role" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as Role })}>
                <option value="EMPLOYEE">{ROLE_LABEL.EMPLOYEE}</option>
                {isHq && <option value="MANAGER">{ROLE_LABEL.MANAGER}</option>}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="s-branch">Branch</label>
              {isHq ? (
                <select id="s-branch" required value={staffForm.branchId} onChange={(e) => setStaffForm({ ...staffForm, branchId: e.target.value })}>
                  <option value="">— choose —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <b>{branchName(me?.branchId ?? null)}</b>
              )}
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'create-staff'}>
                {action.busy === 'create-staff' ? 'Creating…' : 'Create staff account'}
              </button>
            </div>
          </fieldset>
          <p className="muted">
            Roles: {STAFF_ROLES.map((r) => ROLE_LABEL[r]).join(' · ')}. Only HQ can create branch admins.
          </p>
        </form>
      </div>
    </>
  );
}
