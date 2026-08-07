import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

/* Initialisiert i18next (Deutsch als Standard), damit Komponenten in den
   Tests ueber die sichtbare Oberflaeche geprueft werden koennen. */
import "@/i18n";

afterEach(() => {
	/* Der Moduswechsel schreibt an <html> und in localStorage; beides darf
	   nicht in den naechsten Test lecken. */
	document.documentElement.classList.remove("dark");
	window.localStorage.clear();
});
