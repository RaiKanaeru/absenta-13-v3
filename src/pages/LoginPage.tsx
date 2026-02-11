import { Navigate } from "react-router-dom";

import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/auth";

/** Maps role to its dashboard route */
const DASHBOARD_ROUTES: Record<UserRole, string> = {
  admin: "/admin",
  guru: "/guru",
  siswa: "/siswa",
};

/**
 * Halaman login.
 * - Jika sudah login → redirect ke dashboard sesuai role
 * - Jika belum → render LoginForm
 */
const LoginPage = () => {
  const { user, isLoading, error, login } = useAuth();

  // Sudah login → redirect ke dashboard
  if (user) {
    const dashboardPath = DASHBOARD_ROUTES[user.role] ?? "/";
    return <Navigate to={dashboardPath} replace />;
  }

  return <LoginForm onLogin={login} isLoading={isLoading} error={error} />;
};

export default LoginPage;
