import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: UserRole;
}

/**
 * Route guard yang memvalidasi autentikasi dan role user.
 * - Loading → spinner
 * - Belum login → redirect ke /login
 * - Role tidak sesuai → redirect ke /unauthorized
 * - Role sesuai → render children
 */
const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  // Sedang memverifikasi token
  if (isLoading && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  // Belum login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role tidak sesuai
  if (user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
