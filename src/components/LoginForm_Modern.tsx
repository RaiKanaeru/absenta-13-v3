import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User, Eye, EyeOff, CheckCircle2, Sparkles, Shield, Zap, AlertTriangle } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

interface LoginFormProps {
  onLogin: (credentials: { username: string; password: string }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Risk-based captcha threshold
const CAPTCHA_THRESHOLD = 2; // Show captcha after 2 failed attempts
const STORAGE_KEY = 'absenta_login_attempts';

// Helper to get/set failed attempts
const getFailedAttempts = (): { count: number; timestamp: number } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Reset if older than 15 minutes
      if (Date.now() - data.timestamp < 15 * 60 * 1000) {
        return data;
      }
    }
  } catch (e) { /* ignore parse errors */ }
  return { count: 0, timestamp: Date.now() };
};

const incrementFailedAttempts = (): number => {
  const current = getFailedAttempts();
  const newCount = current.count + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    count: newCount,
    timestamp: Date.now()
  }));
  console.log(`[hCaptcha] Failed attempt #${newCount}/${CAPTCHA_THRESHOLD}`);
  return newCount;
};

const clearFailedAttempts = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const LoginForm = ({ onLogin, isLoading, error }: LoginFormProps) => {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  // Load initial state from storage on mount
  useEffect(() => {
    const data = getFailedAttempts();
    if (data.count >= CAPTCHA_THRESHOLD) {
      setShowCaptcha(true);
      console.log(`[hCaptcha] Loaded ${data.count} failed attempts, showing captcha`);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username.trim() || !credentials.password.trim()) return;
    
    // If captcha is required but not solved, don't proceed
    if (showCaptcha && !captchaToken) {
      console.log('[hCaptcha] Captcha required but not solved');
      return;
    }
    
    // Just call onLogin - error tracking happens in useEffect
    await onLogin(credentials);
    
    // Reset captcha after attempt
    if (captchaRef.current) {
      captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  // Watch for error changes - increment counter when error appears
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    // Only count if error is new (not same as previous)
    if (error && error !== prevErrorRef.current) {
      const newCount = incrementFailedAttempts();
      if (newCount >= CAPTCHA_THRESHOLD) {
        setShowCaptcha(true);
        console.log('[hCaptcha] Threshold reached, showing captcha');
      }
    } else if (!error && prevErrorRef.current) {
      // Error cleared - login was successful
      clearFailedAttempts();
      setShowCaptcha(false);
    }
    prevErrorRef.current = error;
  }, [error]);

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const onCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
    console.log('[hCaptcha] Verified successfully');
  };

  // Check if form is ready to submit
  const isFormReady = credentials.username.trim() && credentials.password.trim() && (!showCaptcha || captchaToken);

  return (
    <div className="min-h-screen w-full flex bg-slate-50">
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
          <div className="mb-10 flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-14 w-14 object-contain drop-shadow-lg" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-emerald-200 bg-clip-text text-transparent">ABSENTA</h1>
              <p className="text-blue-300/80 text-sm font-medium tracking-wide">SMKN 13 BANDUNG</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-2xl font-semibold mb-2 leading-tight text-white/90">
            Sistem Absensi Digital
          </h2>
          <p className="text-lg text-blue-200/70 mb-8">
            Praktis, Cepat, Akurat
          </p>

          {/* Feature List */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 group">
              <div className="p-2.5 bg-white/10 rounded-lg border border-white/10">
                <Zap className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-white/80 text-sm">Pencatatan kehadiran otomatis</p>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="p-2.5 bg-white/10 rounded-lg border border-white/10">
                <Sparkles className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-white/80 text-sm">Laporan & export Excel</p>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="p-2.5 bg-white/10 rounded-lg border border-white/10">
                <Shield className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-white/80 text-sm">Data aman & terbackup</p>
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="text-center lg:hidden mb-10">
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 shadow-xl shadow-blue-500/20 mb-4">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">ABSENTA</h1>
            <p className="text-slate-500 text-sm">SMKN 13 Bandung</p>
          </div>

          {/* Login Card */}
          <div className="bg-white p-8 sm:p-10 rounded-2xl lg:shadow-none lg:border-0 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                Masuk ke Sistem
              </h2>
              <p className="text-slate-500 mt-1 text-sm">Silakan login untuk melanjutkan</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-700 rounded-xl animate-in fade-in slide-in-from-top-2">
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 font-semibold text-sm">
                  Username
                </Label>
                <div className={`relative group transition-all duration-300 ${focusedField === 'username' ? 'scale-[1.02]' : ''}`}>
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-300 ${focusedField === 'username' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <User className={`h-4 w-4 transition-colors duration-300 ${focusedField === 'username' ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Masukkan username"
                    value={credentials.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-14 h-14 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">
                  Password
                </Label>
                <div className={`relative group transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-300 ${focusedField === 'password' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <Lock className={`h-4 w-4 transition-colors duration-300 ${focusedField === 'password' ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={credentials.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-14 pr-14 h-14 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 rounded-lg"
                    disabled={isLoading}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Risk-based hCaptcha - Only shows after failed attempts */}
              {showCaptcha && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-amber-600 mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Verifikasi keamanan diperlukan</span>
                  </div>
                  <div className="flex justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <HCaptcha
                      sitekey="10000000-ffff-ffff-ffff-000000000001"
                      onVerify={onCaptchaVerify}
                      ref={captchaRef}
                      theme="light"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-300 ${
                  isFormReady
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
          <p className="text-center text-xs text-slate-400 mt-6">
            &copy; 2025 ABSENTA v3.0 &middot; SMKN 13 Bandung
          </p>
        </div>
      </div>
    </div>
  );
};


