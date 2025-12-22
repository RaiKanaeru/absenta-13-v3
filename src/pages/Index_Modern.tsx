import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { LoginForm } from "@/components/LoginForm_Modern";
import { RefreshCw } from "lucide-react"; // Import spinner icon

// Lazy load dashboard components to reduce initial bundle size
const AdminDashboard = lazy(() => import("@/components/AdminDashboard_Modern").then(module => ({ default: module.AdminDashboard })));
const TeacherDashboard = lazy(() => import("@/components/TeacherDashboard_Modern").then(module => ({ default: module.TeacherDashboard })));
const StudentDashboard = lazy(() => import("@/components/StudentDashboard_Modern").then(module => ({ default: module.StudentDashboard })));
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/config/api";

type AppState = 'login' | 'dashboard';
type UserRole = 'admin' | 'guru' | 'siswa' | null;

interface UserData {
  id: number;
  username: string;
  nama: string;
  role: UserRole;
  // Admin specific
  // Guru specific
  guru_id?: number;
  nip?: string;
  mapel?: string;
  // Siswa specific
  siswa_id?: number;
  nis?: string;
  kelas?: string;
  kelas_id?: number;
}

// Loading Fallback Component
const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-2">
      <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-gray-500 font-medium">Memuat Dashboard...</p>
    </div>
  </div>
);

// Utility function to get token with mobile fallback
const getToken = () => {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  } catch (error) {
    console.error('❌ Error accessing storage:', error);
    return null;
  }
};

// Utility function to set token with mobile fallback
const setToken = (token: string) => {
  try {
    localStorage.setItem('token', token);
  } catch (localError) {
    // Fallback to sessionStorage
    try {
      sessionStorage.setItem('token', token);
    } catch (sessionError) {
      console.error('Token storage failed');
    }
  }
};

const Index = () => {
  const [currentState, setCurrentState] = useState<AppState>('login');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkExistingAuth = useCallback(async () => {
    try {
      const token = getToken();
      
      const response = await fetch(getApiUrl('/api/verify'), {
        method: 'GET',
        credentials: 'include'
      });
      

      if (response.ok) {
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }

        const responseText = await response.text();
        if (!responseText.trim()) {
          return;
        }

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          return;
        }

        if (result.success && result.user) {
          
          // Load latest profile data based on role
          try {
            let profileResponse;
            switch (result.user.role) {
              case 'admin':
                profileResponse = await fetch(getApiUrl('/api/admin/info'), {
                  method: 'GET',
                  credentials: 'include'
                });
                break;
              case 'guru':
                profileResponse = await fetch(getApiUrl('/api/guru/info'), {
                  method: 'GET',
                  credentials: 'include'
                });
                break;
              case 'siswa':
                profileResponse = await fetch(getApiUrl('/api/siswa-perwakilan/info'), {
                  method: 'GET',
                  credentials: 'include'
                });
                break;
              default:
                profileResponse = null;
            }
            
            if (profileResponse && profileResponse.ok) {
              const profileData = await profileResponse.json();
              if (profileData.success) {
                // Merge JWT data with latest profile data
                const updatedUserData = {
                  ...result.user,
                  ...profileData,
                  // Map field names for compatibility based on role
                  ...(result.user.role === 'siswa' && {
                    siswa_id: profileData.id_siswa,
                    nis: profileData.nis,
                    kelas: profileData.nama_kelas,
                    kelas_id: profileData.kelas_id
                  }),
                  ...(result.user.role === 'guru' && {
                    guru_id: profileData.guru_id,
                    nip: profileData.nip,
                    mapel: profileData.mata_pelajaran
                  })
                };
                setUserData(updatedUserData);
              } else {
                setUserData(result.user);
              }
            } else {
              setUserData(result.user);
            }
          } catch (profileError) {
            console.error('Failed to load profile:', profileError);
            setUserData(result.user);
          }
          
          setCurrentState('dashboard');
          
          toast({
            title: "Selamat datang kembali!",
            description: `Halo ${result.user.nama}, Anda berhasil login otomatis.`,
          });
        }
      }
    } catch (error) {
      // Silent fail - no existing auth
    }
  }, [toast]);

  // Check for existing authentication on mount
  useEffect(() => {
    checkExistingAuth();
  }, [checkExistingAuth]);

  const handleLogin = useCallback(async (credentials: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server mengirim respons yang tidak valid. Pastikan server berjalan dengan baik.');
      }

      // Parse response
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('Server mengirim respons kosong. Periksa koneksi ke server.');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Server mengirim respons yang tidak dapat dibaca.');
      }

      if (response.ok && result.success) {
        setUserData(result.user);
        setCurrentState('dashboard');
        setError(null);
        
        // Store token with mobile fallback
        if (result.token) {
          setToken(result.token);
        }
        
        toast({
          title: "Login Berhasil!",
          description: `Selamat datang, ${result.user.nama}!`,
        });
      } else {
        // Extract error message properly from response
        let errorMessage = 'Login gagal';
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMessage = result.error;
          } else if (typeof result.error === 'object') {
            // Handle structured error: {code, message, details}
            errorMessage = result.error.message || result.error.error || JSON.stringify(result.error);
          }
        } else if (result.message) {
          errorMessage = result.message;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat login';
      setError(errorMessage);
      
      toast({
        title: "Login Gagal",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleLogout = useCallback(async () => {
    
    try {
      await fetch(getApiUrl('/api/logout'), {
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear local storage and session storage
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('authToken');
      
      // Reset state
      setUserData(null);
      setCurrentState('login');
      setError(null);
      
      toast({
        title: "Logout Berhasil",
        description: "Anda telah keluar dari sistem",
      });
    } catch (error) {
      // Force logout even if request fails
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('authToken');
      setUserData(null);
      setCurrentState('login');
    }
  }, [toast]);

  // Loading screen
  if (isLoading && currentState === 'login') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sedang masuk...</h2>
          <p className="text-gray-600">Mohon tunggu sebentar</p>
        </div>
      </main>
    );
  }

  // Render login form
  if (currentState === 'login' || !userData) {
    return (
      <LoginForm 
        onLogin={handleLogin}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Render dashboard based on user role
  if (currentState === 'dashboard' && userData) {
    console.log('🎯 Rendering dashboard for role:', userData.role);
    
    switch (userData.role) {
      case 'admin':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AdminDashboard 
              onLogout={handleLogout}
            />
          </Suspense>
        );
        
      case 'guru':
        if (!userData.guru_id) {
          console.error('❌ Guru user missing guru_id');
          handleLogout();
          return null;
        }
        return (
          <Suspense fallback={<LoadingFallback />}>
            <TeacherDashboard 
              userData={userData as UserData & { guru_id: number; nip: string; mapel: string }}
              onLogout={handleLogout}
            />
          </Suspense>
        );
        
      case 'siswa':
        if (!userData.siswa_id) {
          console.error('❌ Siswa user missing siswa_id');
          handleLogout();
          return null;
        }
        return (
          <Suspense fallback={<LoadingFallback />}>
            <StudentDashboard 
              userData={userData as UserData & { siswa_id: number; nis: string; kelas: string; kelas_id: number }}
              onLogout={handleLogout}
            />
          </Suspense>
        );
        
      default:
        console.error('❌ Unknown user role:', userData.role);
        setError('Role pengguna tidak dikenali');
        handleLogout();
        return null;
    }
  }

  // Fallback
  console.log('⚠️ Unexpected state, redirecting to login');
  setCurrentState('login');
  return null;
};

export default Index;
