import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getApiUrl } from "@/config/api";
import { toast } from "@/hooks/use-toast";
import type { UserData } from "@/types/auth";
import { clearAuthToken, setAuthToken } from "@/utils/authUtils";

type Credentials = { username: string; password: string; captchaToken?: string };

export interface AuthContextValue {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requireCaptcha: boolean;
  remainingAttempts: number | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Validates if response is valid JSON content.
 * Returns error message if invalid, null if valid.
 */
const validateJsonResponse = (contentType: string | null, responseText: string): string | null => {
  if (!contentType?.includes("application/json")) {
    return "Server mengirim respons yang tidak valid. Pastikan server berjalan dengan baik.";
  }
  if (!responseText.trim()) {
    return "Server mengirim respons kosong. Periksa koneksi ke server.";
  }
  return null;
};

/** Safely parses JSON string */
const safeParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Extracts error message from API response */
const extractErrorMessage = (result: Record<string, unknown>): string => {
  if (result.error) {
    if (typeof result.error === "string") {
      return result.error;
    }
    if (typeof result.error === "object" && result.error !== null) {
      const errorObj = result.error as Record<string, unknown>;
      const msg = errorObj.message || errorObj.error;
      return typeof msg === "string" ? msg : JSON.stringify(msg || result.error);
    }
  }
  if (result.message) {
    return typeof result.message === "string" ? result.message : JSON.stringify(result.message);
  }
  return "Login gagal";
};

/** Profile API endpoints by role */
const PROFILE_ENDPOINTS: Record<string, string> = {
  admin: "/api/admin/info",
  guru: "/api/guru/info",
  siswa: "/api/siswa-perwakilan/info",
};

/** Fetches profile data based on user role */
const fetchProfileByRole = async (role: string): Promise<Record<string, unknown> | null> => {
  const endpoint = PROFILE_ENDPOINTS[role];
  if (!endpoint) return null;

  try {
    const response = await fetch(getApiUrl(endpoint), {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    return data.success ? data : null;
  } catch (error) {
    console.error('Operation failed:', error);
    return null;
  }
};

/** Builds updated user data by merging JWT data with profile data */
const buildUpdatedUserData = (
  jwtUser: Record<string, unknown>,
  profileData: Record<string, unknown> | null
): UserData => {
  if (!profileData) {
    return jwtUser as unknown as UserData;
  }

  const baseData = { ...jwtUser, ...profileData };
  const role = jwtUser.role as string;

  if (role === "siswa") {
    return {
      ...baseData,
      siswa_id: profileData.id_siswa,
      nis: profileData.nis,
      kelas: profileData.nama_kelas,
      kelas_id: profileData.kelas_id,
    } as unknown as UserData;
  }

  if (role === "guru") {
    return {
      ...baseData,
      guru_id: profileData.guru_id,
      nip: profileData.nip,
      mapel: profileData.mata_pelajaran,
    } as unknown as UserData;
  }

  return baseData as unknown as UserData;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const getClientId = useCallback((): string => {
    const key = 'absenta_client_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }, []);

  const checkExistingAuth = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl("/api/verify"), {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) return;

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) return;

      const responseText = await response.text();
      const result = safeParseJson(responseText) as Record<string, unknown> | null;

      if (!result?.success || !result.user) return;

      const jwtUser = result.user as Record<string, unknown>;
      const role = jwtUser.role as string;

      const profileData = await fetchProfileByRole(role);
      const updatedUserData = buildUpdatedUserData(jwtUser, profileData);
      setUser(updatedUserData);

      toast({
        title: "Selamat datang kembali!",
        description: `Halo ${jwtUser.nama as string}, Anda berhasil login otomatis.`,
      });
    } catch (error) {
      // Silent fail - no existing auth
      console.debug("Auth check failed:", error);
    }
  }, []);

  useEffect(() => {
    checkExistingAuth();
  }, [checkExistingAuth]);

  const login = useCallback(async (credentials: Credentials) => {
    setIsLoading(true);
    setError(null);
    setRequireCaptcha(false);
    setRemainingAttempts(null);

    try {
      const response = await fetch(getApiUrl("/api/login"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Client-ID": getClientId(),
        },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      const contentType = response.headers.get("content-type");
      const responseText = await response.text();

      const validationError = validateJsonResponse(contentType, responseText);
      if (validationError) {
        throw new Error(validationError);
      }

      const result = safeParseJson(responseText) as Record<string, unknown> | null;
      if (!result) {
        throw new Error("Server mengirim respons yang tidak dapat dibaca.");
      }

      if (response.ok && result.success) {
        setUser(result.user as UserData);
        setError(null);
        setRequireCaptcha(false);
        setRemainingAttempts(null);

        if (result.token && typeof result.token === "string") {
          setAuthToken(result.token);
        }

        toast({
          title: "Login Berhasil!",
          description: `Selamat datang, ${(result.user as UserData).nama}!`,
        });
      } else {
        // Handle structured error response
        if (typeof result.requireCaptcha === 'boolean') {
          setRequireCaptcha(result.requireCaptcha);
        }
        if (typeof result.remainingAttempts === 'number') {
          setRemainingAttempts(result.remainingAttempts);
        }
        throw new Error(extractErrorMessage(result));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan saat login";
      setError(errorMessage);

      toast({
        title: "Login Gagal",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getClientId]);

  const logout = useCallback(async () => {
    try {
      await fetch(getApiUrl("/api/logout"), {
        method: "POST",
        credentials: "include",
      });

      clearAuthToken();
      setUser(null);
      setError(null);

      toast({
        title: "Logout Berhasil",
        description: "Anda telah keluar dari sistem",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal logout",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat logout",
      });
      clearAuthToken();
      setUser(null);
      setError(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      requireCaptcha,
      remainingAttempts,
      login,
      logout,
    }),
    [user, isLoading, error, requireCaptcha, remainingAttempts, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
};
