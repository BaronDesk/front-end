import { Navigate } from 'react-router';

import { useLoginForm } from '../../../../hooks/useLoginForm';
import { LoginScreen } from '../../../../components/layout/LoginScreen';

/** The staff and HQ login: the portal's login screen, filling the desk window. */
export function LoginPage() {
  const form = useLoginForm();
  if (form.redirect) return <Navigate to={form.redirect} replace />;
  return <LoginScreen form={form} wide />;
}
