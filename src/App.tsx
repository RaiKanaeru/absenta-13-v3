import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { NotFoundPage, UnauthorizedPage } from "@/components/pages";
import type { GuruUserData, SiswaUserData } from "@/types/auth";

// Lazy load pages
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RootRedirect = lazy(() => import("@/pages/RootRedirect"));

// Lazy load dashboards
const AdminDashboard = lazy(() =>
  import("@/components/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
const TeacherDashboard = lazy(() =>
  import("@/components/teacher/TeacherDashboard").then((m) => ({ default: m.TeacherDashboard }))
);
const StudentDashboard = lazy(() =>
  import("@/components/student/StudentDashboard").then((m) => ({ default: m.StudentDashboard }))
);

const queryClient = new QueryClient();

/** Fallback spinner for lazy-loaded pages */
const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2">
      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground font-medium">Memuat...</p>
    </div>
  </div>
);

/**
 * Wrapper components yang meneruskan userData props ke dashboard.
 * Dashboard components TIDAK dimodifikasi — wrapper ini menjembatani
 * antara ProtectedRoute (validasi auth) dan dashboard (butuh typed props).
 * useAuth() aman dipanggil karena wrapper selalu di-render di dalam AuthProvider.
 */
const GuruDashboardWrapper = () => {
  const { user } = useAuth();
  return <TeacherDashboard userData={user as GuruUserData} />;
};

const SiswaDashboardWrapper = () => {
  const { user } = useAuth();
  return <StudentDashboard userData={user as SiswaUserData} />;
};

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="absenta-ui-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  {/* Public */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected dashboards */}
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/guru/*"
                    element={
                      <ProtectedRoute requiredRole="guru">
                        <GuruDashboardWrapper />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/siswa/*"
                    element={
                      <ProtectedRoute requiredRole="siswa">
                        <SiswaDashboardWrapper />
                      </ProtectedRoute>
                    }
                  />

                  {/* Root → redirect based on auth state */}
                  <Route path="/" element={<RootRedirect />} />

                  {/* Error pages */}
                  <Route path="/unauthorized" element={<UnauthorizedPage type="unauthorized" />} />
                  <Route path="/forbidden" element={<UnauthorizedPage type="forbidden" />} />

                  {/* Catch-all 404 — MUST BE LAST */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
