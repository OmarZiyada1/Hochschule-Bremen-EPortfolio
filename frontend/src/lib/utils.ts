import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fasst Klassennamen zusammen und loest Tailwind-Konflikte auf.
 * Erwartet von den per shadcn-CLI erzeugten Primitiven unter
 * components/ui/ (Alias "@/lib/utils" in components.json).
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
