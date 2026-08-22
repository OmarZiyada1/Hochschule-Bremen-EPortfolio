import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"

import { resetAuthStoreForTests } from "@/api/auth/authStore"
import { setAuthNavigate } from "@/api/auth/redirect"
import { server } from "@/tests/msw/server"

/*
 * MSW faengt jeden Request des Testlaufs ab (KAN-30, Umfang 7). Ein Request
 * ohne angemeldeten Handler ist ein Testfehler und kein stiller Durchlauf
 * ins Netz: Tests, die keine Antwort vorbereitet haben, sollen scheitern,
 * nicht haengen.
 */
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterAll(() => server.close())

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

/*
 * jsdom hat kein Layout und liefert deshalb an manchen Knoten kein
 * getClientRects. ProseMirror fragt es beim Rollen zur Auswahl ab
 * ({@code scrollToSelection}), und ohne Ersatz endet jede Tabellenaktion
 * im Test in einem unbehandelten TypeError. Ein leeres Rechteck ist die
 * ehrliche Antwort: es gibt keine Masse, zu rollen ist nichts.
 */
const emptyRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect

const emptyRectList = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
} as unknown as DOMRectList

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => emptyRectList
  Range.prototype.getBoundingClientRect = () => emptyRect
}
if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = () => emptyRectList
}

/*
 * jsdom kennt keine Object-URLs. Der Editor und die Vorschau eines
 * Entwurfs holen jede Datei mit Token und machen daraus eine
 * ({@code fileQueries.objectUrl}); ohne diesen Ersatz bricht jeder Test,
 * der ein Bild zeigt. Er zaehlt schlicht hoch, damit sich im Test ablesen
 * laesst, dass eine Adresse ueberhaupt entstanden ist, und merkt sich, was
 * wieder freigegeben wurde.
 */
if (!URL.createObjectURL) {
  let objectUrlCount = 0
  URL.createObjectURL = () => `blob:test/${objectUrlCount++}`
  URL.revokeObjectURL = () => {}
}

/* input-otp (Basis der mit KAN-33 erzeugten input-otp-Primitive) ortet in
   einem Timer das Element unter dem Zeiger; jsdom kennt elementFromPoint
   nicht und hat ohnehin kein Layout. Der Ersatz meldet "nichts". */
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}

/* Testing Library raeumt nur automatisch auf, wenn die globalen Hooks
   aktiv sind. Dieses Projekt importiert die Testfunktionen ausdruecklich,
   also wird auch das Aufraeumen ausdruecklich angemeldet. */
afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Sitzung und Navigationsbruecke zuruecksetzen, damit kein Test den
  // Anmeldezustand oder einen navigate-Spy des vorigen Tests erbt.
  resetAuthStoreForTests()
  setAuthNavigate(() => {})
  document.documentElement.className = ""
  window.localStorage.clear()
  // Registrierungs-Schrittzustand und gemerkte Rueckkehr-Route (KAN-33)
  // liegen im sessionStorage; ohne Aufraeumen erbt der naechste Test einen
  // halb fertigen Flow.
  window.sessionStorage.clear()
})
