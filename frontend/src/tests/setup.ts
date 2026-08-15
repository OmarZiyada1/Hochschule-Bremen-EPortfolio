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

/*
 * jsdom kennt auch ResizeObserver nicht. cmdk (die Basis der mit KAN-29
 * erzeugten command-Primitive) beobachtet damit die Groesse seiner Liste;
 * ohne diesen Ersatz bricht jeder Test, der die Pruefflaeche rendert.
 * Der Ersatz beobachtet nichts: Layoutmasse liefert jsdom ohnehin nicht.
 */
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

/* cmdk rollt das jeweils markierte Element in Sicht; jsdom kennt auch
   scrollIntoView nicht, und scrollen laesst sich dort ohnehin nichts. */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

/* Testing Library raeumt nur automatisch auf, wenn die globalen Hooks
   aktiv sind. Dieses Projekt importiert die Testfunktionen ausdruecklich,
   also wird auch das Aufraeumen ausdruecklich angemeldet. */
afterEach(() => {
  cleanup()
  document.documentElement.className = ""
  window.localStorage.clear()
})
