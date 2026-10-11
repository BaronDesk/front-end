import { useRef, useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import { IMAGE_ACCEPT, removeMyAvatar, setMyAvatar } from '../../api/images';
import type { Branch, PublicUser } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useChangePassword } from '../../shared/components/ChangePasswordForm';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { explainRefusal } from '../../shared/lib/errors';
import { IMAGE_REFUSALS, imageProblem } from '../../shared/lib/images';
import { ActionNote } from '../ui/ActionNote';
import { Avatar } from '../ui/Avatar';
import { PasswordField, SelectField } from '../ui/Fields';

/**
 * My account (Settings → the profile card), in the design's style: the
 * gamer's picture, the branch they play at (their booking page follows it)
 * and their password.
 */
export function AccountPage() {
  const { user, updateUser } = useAuth();
  const branches = useApiQuery<Branch[]>('/branches');
  const picture = useAction();
  const place = useAction();
  const password = useChangePassword();
  const [branchId, setBranchId] = useState(user?.homeBranchId ?? '');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!user) return null;

  async function upload(f: File) {
    const problem = imageProblem(f);
    if (problem) {
      await picture.run('picture', () => Promise.reject(new Error(problem)));
      return;
    }
    const updated = await picture.run(
      'picture',
      () => setMyAvatar(f).catch((err: unknown) => explainRefusal(err, IMAGE_REFUSALS)),
      'Your new picture is saved.',
    );
    if (updated) updateUser(updated);
  }

  async function removePicture() {
    const updated = await picture.run('picture', () => removeMyAvatar(), 'Picture removed: BIDI is back.');
    if (updated) updateUser(updated);
  }

  async function saveBranch(e: FormEvent) {
    e.preventDefault();
    const name = branches.data?.find((b) => b.id === branchId)?.name ?? 'your branch';
    const updated = await place.run(
      'branch',
      () => api<PublicUser>('PATCH', '/users/me/branch', { branchId }),
      `You now play at ${name}: Bookings shows its PCs.`,
    );
    if (updated) updateUser(updated);
  }

  function savePassword(e: FormEvent) {
    if (password.passwords.newPassword !== confirm) {
      e.preventDefault();
      setMismatch(true);
      return;
    }
    setMismatch(false);
    void password.changePassword(e).then(() => setConfirm(''));
  }

  return (
    <div className="bd-page">
      <h1 className="bd-book-title">My Account</h1>

      <section className="bd-account-picture">
        <Avatar url={user.avatarUrl} size={122} />
        <p className="bd-account-name">{user.username}</p>
        <div className="bd-row-buttons">
          <button type="button" className="bd-btn-outline" disabled={picture.busy === 'picture'} onClick={() => file.current?.click()}>
            Change picture
          </button>
          {user.avatarUrl && (
            <button type="button" className="bd-btn-outline" disabled={picture.busy === 'picture'} onClick={removePicture}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
        <ActionNote action={picture} />
      </section>

      <form className="bd-account-section" onSubmit={saveBranch}>
        <h2 className="bd-section-head">Where you play</h2>
        <SelectField label="Branch" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="" disabled>
            {branches.data ? 'Branch' : 'Loading…'}
          </option>
          {(branches.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <button type="submit" className="bd-auth-submit bd-btn-wide" disabled={!branchId || branchId === user.homeBranchId || place.busy === 'branch'}>
          Save
        </button>
        <ActionNote action={place} />
      </form>

      <form className="bd-account-section" onSubmit={savePassword}>
        <h2 className="bd-section-head">Password</h2>
        <PasswordField
          placeholder="Current password"
          autoComplete="current-password"
          required
          value={password.passwords.currentPassword}
          onChange={(e) => password.setPasswords({ ...password.passwords, currentPassword: e.target.value })}
        />
        <PasswordField
          placeholder="New password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password.passwords.newPassword}
          onChange={(e) => password.setPasswords({ ...password.passwords, newPassword: e.target.value })}
        />
        <PasswordField placeholder="Confirm new password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" className="bd-auth-submit bd-btn-wide" disabled={password.action.busy === 'password'}>
          Change password
        </button>
        {mismatch ? <p className="bd-note bd-note-error">The two new passwords are not the same.</p> : <ActionNote action={password.action} />}
      </form>
    </div>
  );
}
