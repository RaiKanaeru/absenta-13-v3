import { useState, useEffect, useCallback } from "react";
import { LoginForm } from "@/components/LoginForm_Modern";
import { AdminDashboard } from "@/components/AdminDashboard_Modern";
import { TeacherDashboard } from "@/components/TeacherDashboard_Modern";
import { StudentDashboard } from "@/components/StudentDashboard_Modern";
import { useToast } from "@/hooks/use-toast";

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

const Index = () => {
  console.log('🚀 ABSENTA Modern App Starting...');
  
  const [currentState, setCurrentState] = useState<AppState>('login');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkExistingAuth = useCallback(async () => {
    try {
      console.log('🔍 Checking existing authentication...');
      
      const response = await fetch('/api/verify', {
        method: 'GET',
        credentials: 'include'
      });
      
      console.log('🔍 Auth check response status:', response.status);
      
      if (response.ok) {
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log('ℹ️ Non-JSON response from auth check');
          return;
        }

        const responseText = await response.text();
        if (!responseText.trim()) {
          console.log('ℹ️ Empty response from auth check');
          return;
        }

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.log('ℹ️ Could not parse auth response:', parseError);
          return;
        }

        if (result.success && result.user) {
          console.log('✅ Existing auth found, user:', result.user);
          setUserData(result.user);
          setCurrentState('dashboard');
          
          toast({
            title: "Selamat datang kembali!",
            description: `Halo ${result.user.nama}, Anda berhasil login otomatis.`,
          });
        }
      } else {
        console.log('ℹ️ No existing authentication found, status:', response.status);
      }
    } catch (error) {
      console.log('ℹ️ No existing auth or error checking:', error);
    }
  }, [toast]);

  // Check for existing authentication on mount
  useEffect(() => {
    checkExistingAuth();
  }, [checkExistingAuth]);

  const handleLogin = useCallback(async (credentials: { username: string; password: string }) => {
    console.log('🔐 Starting login process for:', credentials.username);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      console.log('📡 Login response status:', response.status);
      console.log('📡 Login response headers:', response.headers.get('content-type'));

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Server returned non-JSON response');
        throw new Error('Server mengirim respons yang tidak valid. Pastikan server berjalan dengan baik.');
      }

      // Check if response has content
      const responseText = await response.text();
      console.log('📡 Raw response text:', responseText);
      
      if (!responseText.trim()) {
        console.error('❌ Empty response from server');
        throw new Error('Server mengirim respons kosong. Periksa koneksi ke server.');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('❌ Response text that failed to parse:', responseText);
        throw new Error('Server mengirim respons yang tidak dapat dibaca. Periksa log server.');
      }

      console.log('📡 Parsed login response:', result);

      if (response.ok && result.success) {
        console.log('✅ Login successful for user:', result.user);
        
        setUserData(result.user);
        setCurrentState('dashboard');
        setError(null);
        
        // Store token in localStorage for persistence
        if (result.token) {
          localStorage.setItem('authToken', result.token);
        }
        
        toast({
          title: "Login Berhasil!",
          description: `Selamat datang, ${result.user.nama}!`,
        });
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
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
    console.log('🚪 Logging out user...');
    
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear local storage
      localStorage.removeItem('authToken');
      
      // Reset state
      setUserData(null);
      setCurrentState('login');
      setError(null);
      
      console.log('✅ Logout successful');
      
      toast({
        title: "Logout Berhasil",
        description: "Anda telah keluar dari sistem",
      });
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force logout even if request fails
      localStorage.removeItem('authToken');
      setUserData(null);
      setCurrentState('login');
    }
  }, [toast]);

  // Loading screen
  if (isLoading && currentState === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sedang masuk...</h2>
          <p className="text-gray-600">Mohon tunggu sebentar</p>
        </div>
      </div>
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
          <AdminDashboard 
            onLogout={handleLogout}
          />
        );
        
      case 'guru':
        if (!userData.guru_id) {
          console.error('❌ Guru user missing guru_id');
          handleLogout();
          return null;
        }
        return (
          <TeacherDashboard 
            userData={userData as UserData & { guru_id: number; nip: string; mapel: string }}
            onLogout={handleLogout}
          />
        );
        
      case 'siswa':
        if (!userData.siswa_id) {
          console.error('❌ Siswa user missing siswa_id');
          handleLogout();
          return null;
        }
        return (
          <StudentDashboard 
            userData={userData as UserData & { siswa_id: number; nis: string; kelas: string; kelas_id: number }}
            onLogout={handleLogout}
          />
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
