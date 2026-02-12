import { RefreshCw, Loader2, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a human-readable relative time string (e.g. "5 menit lalu"). */
function relativeTime(timestamp: string): string {
  if (!timestamp) return '';

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Baru saja';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/** Map status string to a Tailwind badge colour class. */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'disetujui':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'ditolak':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationPanelProps {
  notifications: NotificationItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function NotificationPanel({
  notifications,
  isLoading,
  onRefresh,
}: NotificationPanelProps) {
  let bodyContent: React.ReactNode;
  if (isLoading && notifications.length === 0) {
    bodyContent = (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Memuat…</span>
      </div>
    );
  } else if (notifications.length === 0) {
    bodyContent = (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <BellOff className="h-8 w-8 mb-2 opacity-40" />
        <span className="text-sm">Tidak ada notifikasi</span>
      </div>
    );
  } else {
    bodyContent = (
      <ul className="divide-y divide-border">
        {notifications.map((item) => (
          <li key={item.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
            <p className="text-sm text-foreground leading-snug">{item.message}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">
                {relativeTime(item.timestamp)}
              </span>
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                  statusBadgeClass(item.status),
                )}
              >
                {item.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="absolute left-0 bottom-full mb-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Notifikasi</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Body */}
      <div className="max-h-80 overflow-y-auto">
        {bodyContent}
      </div>
    </div>
  );
}
