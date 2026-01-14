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

/**
 * Mengambil token autentikasi dari storage
 * Mencoba localStorage terlebih dahulu, jika gagal fallback ke sessionStorage
 * @returns {string | null} Token autentikasi atau null jika tidak ditemukan
 */
const getToken = () => {
  try {
    return globalThis.localStorage.getItem('token') || globalThis.sessionStorage.getItem('token');
  } catch (error) {
    console.error('Error accessing storage:', error);
    return null;
  }
};

/**
 * Validates if response is valid JSON content
 * @returns error message if invalid, null if valid
 */
const validateJsonResponse = (contentType: string | null, responseText: string): string | null => {
  if (!contentType?.includes('application/json')) {
    return 'Server mengirim respons yang tidak valid. Pastikan server berjalan dengan baik.';
  }
  if (!responseText.trim()) {
    return 'Server mengirim respons kosong. Periksa koneksi ke server.';
  }
  return null;
};

/**
 * Safely parses JSON string
 * @returns parsed object or null if invalid
 */
const safeParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Extracts error message from API response
 */
const extractErrorMessage = (result: Record<string, unknown>): string => {
  if (result.error) {
    if (typeof result.error === 'string') {
      return result.error;
    }
    if (typeof result.error === 'object' && result.error !== null) {
      const errorObj = result.error as Record<string, unknown>;
      const msg = errorObj.message || errorObj.error;
      return typeof msg === 'string' ? msg : JSON.stringify(msg || result.error);
    }
  }
  if (result.message) {
    return typeof result.message === 'string' ? result.message : JSON.stringify(result.message);
  }
  return 'Login gagal';
};

const setToken = (token: string) => {
  try {
    localStorage.setItem('token', token);
  } catch (localError) {
    // Fallback ke sessionStorage untuk perangkat dengan localStorage terbatas
    console.warn('localStorage failed, trying sessionStorage', localError);
    try {
      globalThis.sessionStorage.setItem('token', token);
    } catch (sessionError) {
      console.error('Do not use empty catch blocks', sessionError);
    }
  }
};

/**
 * Profile API endpoints by role
 */
const PROFILE_ENDPOINTS: Record<string, string> = {
  'admin': '/api/admin/info',
  'guru': '/api/guru/info',
  'siswa': '/api/siswa-perwakilan/info'
};

/**
 * Fetches profile data based on user role
 * @returns profile data or null if failed
 */
const fetchProfileByRole = async (role: string): Promise<Record<string, unknown> | null> => {
  const endpoint = PROFILE_ENDPOINTS[role];
  if (!endpoint) return null;

  try {
    const response = await fetch(getApiUrl(endpoint), {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Fetch profile error:', error);
    return null;
  }
};

/**
 * Builds updated user data by merging JWT data with profile data
 */
const buildUpdatedUserData = (
  jwtUser: Record<string, unknown>,
  profileData: Record<string, unknown> | null
): UserData => {
  if (!profileData) {
    return jwtUser as unknown as UserData;
  }

  const baseData = { ...jwtUser, ...profileData };
  const role = jwtUser.role as string;

  // Add role-specific field mappings
  if (role === 'siswa') {
    return {
      ...baseData,
      siswa_id: profileData.id_siswa,
      nis: profileData.nis,
      kelas: profileData.nama_kelas,
      kelas_id: profileData.kelas_id
    } as unknown as UserData;
  }

  if (role === 'guru') {
    return {
      ...baseData,
      guru_id: profileData.guru_id,
      nip: profileData.nip,
      mapel: profileData.mata_pelajaran
    } as unknown as UserData;
  }

  return baseData as unknown as UserData;
};


/**
 * Komponen utama aplikasi ABSENTA
 * Menangani:
 * - State autentikasi (login/dashboard)
 * - Routing berdasarkan role (admin/guru/siswa)
 * - Auto-login dari token tersimpan
 * - Login/logout handling
 */
const Index = () => {
  // State aplikasi: 'login' atau 'dashboard'
  const [currentState, setCurrentState] = useState<AppState>('login');
  // Data user yang sedang login
  const [userData, setUserData] = useState<UserData | null>(null);
  // Loading state untuk operasi async
  const [isLoading, setIsLoading] = useState(false);
  // Error message untuk ditampilkan ke user
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Memeriksa autentikasi yang sudah ada (auto-login)
   * Dipanggil saat komponen mount untuk cek session aktif
   * Jika valid, load data profile terbaru dan redirect ke dashboard
   */
  const checkExistingAuth = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl('/api/verify'), {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) return;

      // Validate JSON response
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) return;

      const responseText = await response.text();
      const result = safeParseJson(responseText) as Record<string, unknown> | null;
      
      if (!result?.success || !result.user) return;

      const user = result.user as Record<string, unknown>;
      const role = user.role as string;

      // Load latest profile data using helper
      const profileData = await fetchProfileByRole(role);
      
      // Build user data using helper
      const updatedUserData = buildUpdatedUserData(user, profileData);
      setUserData(updatedUserData);
      setCurrentState('dashboard');
      
      toast({
        title: "Selamat datang kembali!",
        description: `Halo ${user.nama as string}, Anda berhasil login otomatis.`,
      });
    } catch (error) {
      // Silent fail - no existing auth
      console.debug('Auth check failed:', error);
    }
  }, [toast]);


  // Check for existing authentication on mount
  useEffect(() => {
    checkExistingAuth();
  }, [checkExistingAuth]);

  /**
   * Handler untuk proses login
   * Mengirim credentials ke API dan menangani response
   * Termasuk error handling untuk berbagai format error dari server
   * @param {Object} credentials - Username dan password
   * @param {string} credentials.username - Username pengguna
   * @param {string} credentials.password - Password pengguna
   */
  const handleLogin = useCallback(async (credentials: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      // Validate and parse response
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      const validationError = validateJsonResponse(contentType, responseText);
      if (validationError) {
        throw new Error(validationError);
      }

      const result = safeParseJson(responseText) as Record<string, unknown> | null;
      if (!result) {
        throw new Error('Server mengirim respons yang tidak dapat dibaca.');
      }

      // Handle successful login
      if (response.ok && result.success) {
        setUserData(result.user as UserData);
        setCurrentState('dashboard');
        setError(null);
        
        if (result.token) {
          setToken(result.token as string);
        }
        
        toast({
          title: "Login Berhasil!",
          description: `Selamat datang, ${(result.user as UserData).nama}!`,
        });
      } else {
        throw new Error(extractErrorMessage(result));
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

  /**
   * Handler untuk proses logout
   * Menghapus token dari storage dan reset state aplikasi
   * Tetap logout meskipun request ke server gagal
   */
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

  // Fallback - unexpected state
  setCurrentState('login');
  return null;
};

export default Index;
