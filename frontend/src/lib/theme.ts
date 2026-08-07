import { useSyncExternalStore } from "react";

/**
 * Moduswechsel fuer hell und dunkel (KAN-6, Abschnitt 4).
 *
 * Die Umschaltung passiert vollstaendig auf der Semantic-Ebene der
 * Tokenschicht: hier wird nur die Klasse "dark" an <html> gesetzt und die
 * Wahl gespeichert. Komponenten enthalten keine modusabhaengige Logik.
 *
 * Der Startwert kommt aus dem Inline-Script in index.html, das vor dem
 * ersten Rendern laeuft (kein Aufblitzen). Der Speicher-Schluessel muss
 * mit dem Script identisch bleiben.
 */

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "eportfolio-theme-change";

export function getTheme(): Theme {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
	document.documentElement.classList.toggle("dark", theme === "dark");
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		/* Speicher nicht verfuegbar: die Wahl gilt nur fuer diese Sitzung. */
	}
	window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function subscribeToTheme(onChange: () => void): () => void {
	window.addEventListener(THEME_CHANGE_EVENT, onChange);
	return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

export function useTheme(): Theme {
	return useSyncExternalStore(subscribeToTheme, getTheme);
}
