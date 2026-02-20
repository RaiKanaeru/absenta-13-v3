import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, Shield, Zap, AlertTriangle, Clock, User, Lock, Eye, EyeOff } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { ModeToggle } from "@/components/mode-toggle";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/AuthContext";

interface LoginFormProps {
  onLogin: (credentials: { username: string; password: string; captchaToken?: string }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// KONFIGURASI KEAMANAN LOGIN
// ============================================

/** Key localStorage untuk status lockout */
const LOCKOUT_KEY = 'absenta_lockout';

// ============================================
// LOCKOUT MANAGEMENT (Rate Limiting Client-Side)
// ============================================

/**
 * Mengecek apakah user sedang dalam status lockout
 * Lockout terjadi ketika server mengembalikan 429 (too many requests)
 * @returns {Object|null} lockedUntil timestamp atau null jika tidak lockout
 */
const getLockout = (): { lockedUntil: number } | null => {
  try {
    const stored = localStorage.getItem(LOCKOUT_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.lockedUntil > Date.now()) {
        return data;
      }
      // Hapus lockout yang sudah expired
      localStorage.removeItem(LOCKOUT_KEY);
    }
  } catch (e) { 
    console.debug('Error parsing lockout:', e);
  }
  return null;
};

/**
 * Mengaktifkan lockout untuk durasi tertentu
 * Dipanggil ketika server mengembalikan 429 dengan retryAfter
 * @param {number} retryAfterSeconds - Durasi lockout dalam detik
 */
const setLockout = (retryAfterSeconds: number) => {
  const lockedUntil = Date.now() + (retryAfterSeconds * 1000);
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ lockedUntil }));
};

/** Hapus status lockout (dipanggil setelah login sukses) */
const clearLockout = () => {
  localStorage.removeItem(LOCKOUT_KEY);
};

// ============================================
// KOMPONEN LOGIN FORM
// ============================================

/**
 * Komponen form login dengan fitur keamanan:
 * - Risk-based hCaptcha (muncul setelah N percobaan gagal)
 * - Client-side rate limiting (lockout countdown)
 * - Visual feedback untuk error dan loading state
 * 
 * @param {Function} onLogin - Callback untuk submit credentials
 * @param {boolean} isLoading - Status loading dari parent
 * @param {string|null} error - Pesan error dari parent
 */
export const LoginForm = ({ onLogin, isLoading, error }: LoginFormProps) => {
  const { requireCaptcha, remainingAttempts } = useAuth();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const captchaRef = useRef<HCaptcha>(null);
  const { theme } = useTheme();

  // Load initial state from storage on mount
  useEffect(() => {
    // Check for existing lockout
    const lockout = getLockout();
    if (lockout) {
      const remaining = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
      setLockoutRemaining(remaining);
    }
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutRemaining > 0) {
      const timer = setInterval(() => {
        setLockoutRemaining(prev => {
          if (prev <= 1) {
            clearLockout();
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutRemaining]);

  // Check if form is locked out
  const isLockedOut = lockoutRemaining > 0;

  // Format countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return; // Don't submit if locked out
    if (!credentials.username.trim() || !credentials.password.trim()) return;
    
    // If captcha is required but not solved, don't proceed
    if (requireCaptcha && !captchaToken) {
      return;
    }
    
    // Just call onLogin - error tracking happens in useEffect
    await onLogin({ ...credentials, captchaToken: captchaToken || undefined });
    
    // Reset captcha after attempt
    if (captchaRef.current) {
      captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  // Watch for error changes - handle lockout
  useEffect(() => {
    // Check if error contains lockout message (429 response)
    if (error?.includes('Coba lagi dalam')) {
      // Extract retry time from error message
      const match = /(\d+)\s*menit/.exec(error);
      if (match) {
        const minutes = Number.parseInt(match[1]);
        setLockout(minutes * 60);
        setLockoutRemaining(minutes * 60);
      }
    } else if (!error) {
      // Error cleared - login was successful
      clearLockout();
      setLockoutRemaining(0);
    }
  }, [error]);

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const onCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  // Check if form is ready to submit
  const isFormReady = credentials.username.trim() && credentials.password.trim() && (!requireCaptcha || captchaToken) && !isLockedOut;

  return (
    <div className="min-h-screen w-full flex bg-background relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </div>
      
      {/* Left Side - Branding Panel (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-800 via-blue-900 to-slate-900 relative overflow-hidden items-center justify-center p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>

        <div className="relative z-10 text-white max-w-lg">
          {/* Logo & Brand */}
          <div className="mb-10 flex items-center gap-4 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="p-3 bg-white/95 shadow-2xl shadow-black/30 rounded-2xl border border-white/20">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-14 w-14 object-contain drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-emerald-200 bg-clip-text text-transparent">ABSENTA</h1>
              <p className="text-blue-300/80 text-sm font-medium tracking-wide">SMKN 13 BANDUNG</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="animate-in fade-in slide-in-from-left-8 duration-700 delay-150 fill-mode-backwards">
            <h2 className="text-2xl font-semibold mb-2 leading-tight text-white/90">
              Sistem Absensi Digital
            </h2>
            <p className="text-lg text-blue-200/70 mb-8">
              Praktis, Cepat, Akurat
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 group animate-in fade-in slide-in-from-left-4 duration-700 delay-300 fill-mode-backwards">
              <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                <Zap className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-white/80 text-sm group-hover:text-white transition-colors">Pencatatan kehadiran otomatis</p>
            </div>
            <div className="flex items-center gap-3 group animate-in fade-in slide-in-from-left-4 duration-700 delay-500 fill-mode-backwards">
              <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                <Sparkles className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-white/80 text-sm group-hover:text-white transition-colors">Laporan & export Excel</p>
            </div>
            <div className="flex items-center gap-3 group animate-in fade-in slide-in-from-left-4 duration-700 delay-700 fill-mode-backwards">
              <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                <Shield className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-white/80 text-sm group-hover:text-white transition-colors">Data aman & terbackup</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-4 border-t border-white/10">
            <p className="text-blue-300/40 text-xs">
              SMKN 13 Bandung
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500 ease-out fill-mode-both">
          {/* Mobile Logo */}
          <div className="text-center lg:hidden mb-10">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-xl shadow-black/10 mb-4 border border-border animate-float">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">ABSENTA</h1>
            <p className="text-muted-foreground text-sm">SMKN 13 Bandung</p>
          </div>

          {/* Login Card */}
          <div className="bg-card p-6 sm:p-8 rounded-2xl lg:shadow-none lg:border-0 shadow-xl shadow-black/5 border border-border">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                Masuk ke Sistem
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">Silakan login untuk melanjutkan</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isLoading}>
              {/* Lockout Alert */}
              {isLockedOut && (
                <Alert className="bg-amber-500/15 border-amber-500/25 text-amber-700 dark:text-amber-400 rounded-xl animate-in fade-in slide-in-from-top-2" role="status" aria-live="polite">
                  <Clock className="h-4 w-4" />
                  <AlertDescription className="font-medium flex items-center gap-2">
                    <span>Terlalu banyak percobaan. Coba lagi dalam</span>
                    <span className="font-bold text-lg bg-amber-500/10 px-2 py-0.5 rounded">{formatCountdown(lockoutRemaining)}</span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {error && !isLockedOut && (
                <Alert variant="destructive" className="rounded-xl animate-in fade-in slide-in-from-top-2" role="alert" aria-live="polite">
                  <AlertDescription className="font-medium">
                    {error}
                    {remainingAttempts !== null && remainingAttempts > 0 && (
                      <span className="block mt-1 text-xs opacity-90">
                        Sisa {remainingAttempts} percobaan sebelum akun terkunci
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground font-semibold text-sm">
                  Username
                </Label>
                <div className={`relative group transition-all duration-300 ${focusedField === 'username' ? 'scale-[1.02]' : ''}`}>
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-300 ${focusedField === 'username' ? 'bg-primary/10' : 'bg-muted'}`}>
                    <User className={`h-4 w-4 transition-all duration-300 ${focusedField === 'username' ? 'text-primary scale-110 animate-pulse' : 'text-muted-foreground'}`} />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Masukkan username"
                    value={credentials.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-14 h-14 bg-background border-input rounded-xl focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/20 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all duration-300 font-medium text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || isLockedOut}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-semibold text-sm">
                  Password
                </Label>
                <div className={`relative group transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-300 ${focusedField === 'password' ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Lock className={`h-4 w-4 transition-all duration-300 ${focusedField === 'password' ? 'text-primary scale-110 animate-pulse' : 'text-muted-foreground'}`} />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={credentials.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-14 pr-14 h-14 bg-background border-input rounded-xl focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/20 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all duration-300 font-medium text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || isLockedOut}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 rounded-lg"
                    disabled={isLoading || isLockedOut}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Risk-based hCaptcha - Only shows after failed attempts */}
              {requireCaptcha && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-amber-600 mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Verifikasi keamanan diperlukan</span>
                  </div>
                  <div className="flex justify-center p-4 bg-muted rounded-xl border border-border">
                    <HCaptcha
                      sitekey="6ad030ba-63dc-4238-9bf4-0b2eeee81af8"
                      onVerify={onCaptchaVerify}
                      ref={captchaRef}
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-500 ${
                  isFormReady
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/60 hover:scale-[1.02] border border-transparent hover:border-blue-400/30'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
                disabled={isLoading || !isFormReady}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memproses...
                  </span>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            &copy; 2025 ABSENTA v3.0 &middot; SMKN 13 Bandung
          </p>
        </div>
      </div>
    </div>
  );
};

