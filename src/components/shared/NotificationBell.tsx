import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationPanel } from '@/components/shared/NotificationPanel';
import type { NotificationItem } from '@/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  readonly notifications: NotificationItem[];
  readonly unreadCount: number;
  readonly isLoading: boolean;
  readonly onRefresh: () => void;
  /** Whether sidebar label text is visible (used for responsive layout). */
  readonly showLabel?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell({
  notifications,
  unreadCount,
  isLoading,
  onRefresh,
  showLabel = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel on click-outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className={cn('relative', showLabel ? 'w-full justify-start' : 'px-2')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-4 w-4" />
        {showLabel && <span className="ml-2">Notifikasi</span>}

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown panel */}
      {open && (
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
