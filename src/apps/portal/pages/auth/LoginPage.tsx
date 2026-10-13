import { Navigate } from 'react-router';

import { useLoginForm } from '../../../../hooks/useLoginForm';
import { LoginScreen } from '../../../../components/layout/LoginScreen';

/** Figma "Login". */
export function LoginPage() {
  const form = useLoginForm();
  if (form.redirect) return <Navigate to={form.redirect} replace />;
  return <LoginScreen form={form} />;
}
