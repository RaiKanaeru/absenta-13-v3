import { useState, useEffect, useCallback } from "react";
import { LoginForm } from "@/components/LoginForm_Modern";
import { AdminDashboard } from "@/components/AdminDashboard_Modern";
import { TeacherDashboard } from "@/components/TeacherDashboard_Modern";
import { StudentDashboard } from "@/components/StudentDashboard_Modern";
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
    console.log('✅ Token stored in localStorage');
  } catch (error) {
    console.error('❌ localStorage failed, trying sessionStorage:', error);
    try {
      sessionStorage.setItem('token', token);
      console.log('✅ Token stored in sessionStorage as fallback');
    } catch (sessionError) {
      console.error('❌ Both localStorage and sessionStorage failed:', sessionError);
    }
  }
};

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
      console.log('📱 localStorage available:', typeof(Storage) !== "undefined");
      const token = getToken();
      console.log('📱 Token found:', token ? 'exists' : 'not found');
      
      const response = await fetch(getApiUrl('/api/verify'), {
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
              console.log('📋 Profile data received:', profileData);
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
                console.log('✅ Updated user data with latest profile:', updatedUserData);
              } else {
                console.log('❌ Profile data not successful:', profileData);
                setUserData(result.user);
              }
            } else {
              console.log('❌ Profile response not ok:', profileResponse?.status, profileResponse?.statusText);
              setUserData(result.user);
            }
          } catch (profileError) {
            console.error('❌ Failed to load latest profile data:', profileError);
            console.log('❌ Profile error details:', {
              message: profileError.message,
              stack: profileError.stack,
              name: profileError.name
            });
            setUserData(result.user);
          }
          
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
    console.log('📱 User Agent:', navigator.userAgent);
    console.log('📱 Is Mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
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
        
        // Store token with mobile fallback
        if (result.token) {
          setToken(result.token);
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
      
      console.log('✅ Logout successful');
      
      toast({
        title: "Logout Berhasil",
        description: "Anda telah keluar dari sistem",
      });
    } catch (error) {
      console.error('❌ Logout error:', error);
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
