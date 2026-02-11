import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/auth";

/** Maps role to its dashboard route */
const DASHBOARD_ROUTES: Record<UserRole, string> = {
  admin: "/admin",
  guru: "/guru",
  siswa: "/siswa",
};

/**
 * Root redirect component (/).
 * - Loading → spinner
 * - Authenticated → redirect ke dashboard sesuai role
 * - Belum login → redirect ke /login
 */
const RootRedirect = () => {
  const { user, isLoading } = useAuth();

  if (isLoading && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Memuat...</p>
        </div>
      </div>
    );
  }

  if (user) {
    const dashboardPath = DASHBOARD_ROUTES[user.role] ?? "/login";
    return <Navigate to={dashboardPath} replace />;
  }

  return <Navigate to="/login" replace />;
};

export default RootRedirect;
