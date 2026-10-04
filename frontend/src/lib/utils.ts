import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gabung class Tailwind dengan aman (class terakhir menang). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
