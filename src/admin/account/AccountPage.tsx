import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABEL } from '../../auth/roles';
import { ChangePasswordForm } from '../../shared/components/ChangePasswordForm';
import { useBranchScope } from '../branches/BranchContext';

/** My account (from the top bar): who is logged in, and changing one's own password. */
export function AccountPage() {
  const { user } = useAuth();
  const { branchName } = useBranchScope();
  if (!user) return null;
  return (
    <>
      <h1>My account</h1>
      <table className="kv">
        <tbody>
          <tr>
            <th>Username</th>
            <td>
              <b>{user.username}</b>
            </td>
          </tr>
          <tr>
            <th>Role</th>
            <td>{ROLE_LABEL[user.role]}</td>
          </tr>
          <tr>
            <th>Branch</th>
            <td>{user.branchId ? branchName(user.branchId) : 'All branches (HQ)'}</td>
          </tr>
        </tbody>
      </table>
      <ChangePasswordForm />
    </>
  );
}
