import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";

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
  const { user, isLoading, isAuthenticating, error, login } = useAuth();

  if (isAuthenticating && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }

  // Sudah login → redirect ke dashboard
  if (user) {
    const dashboardPath = DASHBOARD_ROUTES[user.role] ?? "/";
    return <Navigate to={dashboardPath} replace />;
  }

  return <LoginForm onLogin={login} isLoading={isLoading} error={error} />;
};

export default LoginPage;
