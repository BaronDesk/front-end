import { useRef, useState, type FormEvent } from 'react';

import { removeMyAvatar, setMyAvatar } from '../../../../services/images.service';
import { IMAGE_ACCEPT } from '../../../../lib/images';
import { usersService } from '../../../../services/users.service';
import { useAuth } from '../../../../providers/AuthProvider';
import { useChangePassword } from '../../../../hooks/useChangePassword';
import { useAction } from '../../../../hooks/useAction';
import { useBranches } from '../../../../hooks/queries';
import { explainRefusal } from '../../../../lib/errors';
import { IMAGE_REFUSALS, imageProblem } from '../../../../domain/images';
import { ActionNote, Notice } from '../../../../components/primitives/Notice';
import { Avatar } from '../../../../components/primitives/Avatar';
import { PasswordField, SelectField } from '../../../../components/primitives/Field';
import { Button, ButtonRow } from '../../../../components/primitives/Button';
import { SectionTitle } from '../../../../components/primitives/SectionTitle';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { Page } from '../../../../components/layout/Page';
import styles from './AccountPage.module.css';

/**
 * My account (Settings → the profile card): the
 * gamer's picture, the branch they play at (their booking page follows it)
 * and their password.
 */
export function AccountPage() {
  const { user, updateUser } = useAuth();
  const branches = useBranches();
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
      () => usersService.setHomeBranch(branchId),
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
    <Page>
      <PageTitle>My Account</PageTitle>

      <section className={styles.picture}>
        <Avatar url={user.avatarUrl} size={122} />
        <p className={styles.name}>{user.username}</p>
        <ButtonRow>
          <Button variant="outline" disabled={picture.busy === 'picture'} onClick={() => file.current?.click()}>
            Change picture
          </Button>
          {user.avatarUrl && (
            <Button variant="outline" disabled={picture.busy === 'picture'} onClick={removePicture}>
              Remove
            </Button>
          )}
        </ButtonRow>
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
        <ActionNote action={picture} align="center" className={styles.pictureNote} />
      </section>

      <form className={styles.section} onSubmit={saveBranch}>
        <SectionTitle className={styles.head}>Where you play</SectionTitle>
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
        <Button type="submit" className={styles.submit} disabled={!branchId || branchId === user.homeBranchId || place.busy === 'branch'}>
          Save
        </Button>
        <ActionNote action={place} align="center" className={styles.note} />
      </form>

      <form className={styles.section} onSubmit={savePassword}>
        <SectionTitle className={styles.head}>Password</SectionTitle>
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
        <Button type="submit" className={styles.submit} disabled={password.action.busy === 'password'}>
          Change password
        </Button>
        {mismatch ? (
          <Notice tone="error" align="center" className={styles.note}>
            The two new passwords are not the same.
          </Notice>
        ) : (
          <ActionNote action={password.action} align="center" className={styles.note} />
        )}
      </form>
    </Page>
  );
}
