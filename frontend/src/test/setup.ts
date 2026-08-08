import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

/*
 * jsdom kennt matchMedia nicht. Sowohl der ThemeProvider aus der
 * shadcn-CLI als auch useIsDarkMode fragen darueber prefers-color-scheme
 * ab; ohne diesen Ersatz bricht jeder Test, der eine Seite rendert.
 * Der Ersatz meldet immer "hell", damit Tests einen festen Ausgangspunkt
 * haben und nicht von der Systemeinstellung des Rechners abhaengen.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

/* Testing Library raeumt nur automatisch auf, wenn die globalen Hooks
   aktiv sind. Dieses Projekt importiert die Testfunktionen ausdruecklich,
   also wird auch das Aufraeumen ausdruecklich angemeldet. */
afterEach(() => {
  cleanup()
  document.documentElement.className = ""
  window.localStorage.clear()
})
