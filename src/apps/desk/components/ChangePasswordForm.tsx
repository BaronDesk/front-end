import { useChangePassword } from '../../../hooks/useChangePassword';
import { ActionMessages } from './ActionMessages';

export function ChangePasswordForm() {
  const { action, passwords, setPasswords, changePassword } = useChangePassword();

  return (
    <form onSubmit={changePassword}>
      <fieldset>
        <legend>Password</legend>
        <ActionMessages action={action} />
        <div className="form-row">
          <label htmlFor="pw-current">Current password</label>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            required
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="pw-new">New password</label>
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
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
  );
}
