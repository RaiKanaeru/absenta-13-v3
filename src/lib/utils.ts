import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const msg = (error as { message?: string }).message;
    return typeof msg === 'string' ? msg : JSON.stringify(error);
  }
  if (typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean') return String(error);
  return '';
}
