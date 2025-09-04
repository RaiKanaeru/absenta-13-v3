import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User } from "lucide-react";

interface LoginFormProps {
  onLogin: (credentials: { username: string; password: string }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const LoginForm = ({ onLogin, isLoading, error }: LoginFormProps) => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username.trim() || !credentials.password.trim()) {
      return;
    }
    await onLogin(credentials);
  };

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ABSENTA</h1>
          <p className="text-gray-600">Sistem Absensi Guru Modern</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-xl text-gray-800">
              Masuk ke Sistem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 font-medium">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Masukkan username Anda"
                    value={credentials.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Masukkan password Anda"
                    value={credentials.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200"
                disabled={isLoading || !credentials.username.trim() || !credentials.password.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sedang Masuk...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>&copy; 2025 ABSENTA. Sistem Absensi Guru Modern.</p>
        </div>
      </div>
    </div>
  );
};
