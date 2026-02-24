import { LucideIcon } from "lucide-react";

export interface AdminDashboardProps {
  onLogout: () => void;
}

export type GenderType = 'L' | 'P' | '';
export type AccountStatusType = 'aktif' | 'nonaktif';

export interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  gradient: string;
}
