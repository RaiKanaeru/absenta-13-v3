import { useState, useEffect, useRef, useCallback } from 'react';
import { apiCall } from '@/utils/apiClient';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationItem {
  id: number;
  message: string;
  timestamp: string;
  status: string;
  type: string;
}

interface UseNotificationsOptions {
  role: 'admin' | 'guru' | 'siswa';
  userId?: number | null;
  onLogout: () => void;
  enabled?: boolean;
  intervalMs?: number;
}

interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => void;
}

// Raw response shapes (mirrors backend, avoids coupling to existing types)
interface AdminAnalyticsResponse {
  notifications?: NotificationItem[];
}

interface GuruBandingItem {
  id_banding: number;
  nama_siswa: string;
  nama_kelas: string;
  tanggal_pengajuan: string;
  status_banding: string;
}

interface SiswaBandingItem {
  id_banding?: number;
  id?: number;
  nama_mapel?: string;
  tanggal_absen?: string;
  tanggal_keputusan?: string;
  tanggal_pengajuan?: string;
  status_banding: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEndpoint(role: string, userId?: number | null): string | null {
  switch (role) {
    case 'admin':
      return '/api/admin/analytics';
    case 'guru':
      return userId ? `/api/guru/${userId}/banding-absen` : null;
    case 'siswa':
      return userId ? `/api/siswa/${userId}/banding-absen` : null;
    default:
      return null;
  }
}

function extractNotifications(role: string, data: unknown): NotificationItem[] {
  if (role === 'admin') {
    const analytics = data as AdminAnalyticsResponse;
    return Array.isArray(analytics?.notifications) ? analytics.notifications : [];
  }

  if (role === 'guru') {
    const items = Array.isArray(data) ? (data as GuruBandingItem[]) : [];
    return items
      .filter((item) => item.status_banding === 'pending')
      .map((item) => ({
        id: item.id_banding,
        message: `Banding absen dari ${item.nama_siswa} (${item.nama_kelas})`,
        timestamp: item.tanggal_pengajuan,
        status: item.status_banding,
        type: 'attendance_appeal',
      }));
  }

  if (role === 'siswa') {
    const items = Array.isArray(data) ? (data as SiswaBandingItem[]) : [];
    return items
      .filter((item) => item.status_banding === 'disetujui' || item.status_banding === 'ditolak')
      .map((item) => ({
        id: item.id_banding || item.id || 0,
        message: `Banding ${item.status_banding}: ${item.nama_mapel || 'Mata pelajaran'} (${item.tanggal_absen || ''})`,
        timestamp: item.tanggal_keputusan || item.tanggal_pengajuan || '',
        status: item.status_banding,
        type: 'appeal_response',
      }));
  }

  return [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications({
  role,
  userId,
  onLogout,
  enabled = true,
  intervalMs = 60000,
}: UseNotificationsOptions): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const prevCountRef = useRef<number>(0);
  const isFirstFetchRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endpoint = getEndpoint(role, userId);
  const canPoll = enabled && endpoint !== null;

  const fetchNotifications = useCallback(async () => {
    if (!endpoint) return;

    setIsLoading(true);
    try {
      const data = await apiCall(endpoint, { onLogout, retries: 0 });
      const items = extractNotifications(role, data);
      setNotifications(items);

      // Show sonner toast when new notifications appear (skip first fetch)
      if (!isFirstFetchRef.current && items.length > prevCountRef.current) {
        const newCount = items.length - prevCountRef.current;
        toast.info(`Ada ${newCount} notifikasi baru`);
      }

      prevCountRef.current = items.length;
      isFirstFetchRef.current = false;
    } catch {
      // Silent fail — polling errors should not spam the user
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, onLogout, role]);

  // Initial fetch + interval polling
  useEffect(() => {
    if (!canPoll) {
      setNotifications([]);
      prevCountRef.current = 0;
      isFirstFetchRef.current = true;
      return;
    }

    fetchNotifications();

    intervalRef.current = setInterval(fetchNotifications, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [canPoll, fetchNotifications, intervalMs]);

  return {
    notifications,
    unreadCount: notifications.length,
    isLoading,
    refresh: fetchNotifications,
  };
}
