import { createContext, useContext, type ReactNode } from "react"

/**
 * Was eine Knotenansicht auf der Schreibflaeche von ihrer Seite braucht.
 *
 * <p><strong>Warum ein Kontext und keine Props.</strong> Die Ansichten der
 * sieben Medienknoten haengen nicht im React-Baum der Seite, sondern werden
 * von Tiptap ueber {@code ReactNodeViewRenderer} in die Schreibflaeche
 * gehaengt. Props durchzureichen gibt es dort nicht: was die Ansicht
 * bekommt, bestimmt ProseMirror (Knoten, Position, Editor). Alles Weitere
 * kommt ueber den Kontext, und der ist genau deshalb klein gehalten.
 *
 * <p>Die Portale liegen im selben React-Baum wie die Seite, Kontext und
 * Hooks funktionieren dort also unveraendert.
 */
export type EditorContextValue = {
  /** Fuer den Upload: eine Datei ohne projectId waere ein Avatar (§3.15). */
  projectId: string
  /** Ob die Schreibflaeche gerade beschreibbar ist (§4.1). */
  editable: boolean
  /**
   * Sagt eine Aenderung an, die keine sichtbare Meldung hat. Die
   * Live-Region liegt einmal an der Seite; jede Ansicht ruft nur hier.
   */
  announce: (message: string) => void
}

const EditorContextObject = createContext<EditorContextValue | null>(null)

export function EditorContextProvider({
  value,
  children,
}: {
  value: EditorContextValue
  children: ReactNode
}) {
  return (
    <EditorContextObject.Provider value={value}>
      {children}
    </EditorContextObject.Provider>
  )
}

/**
 * Der Kontext der Schreibflaeche.
 *
 * <p>Wirft ohne Provider, statt einen Ersatzwert zu liefern: eine
 * Knotenansicht ohne {@code projectId} luede ihre Datei als Avatar hoch und
 * machte sie damit oeffentlich lesbar (§3.15, §5). Ein stiller Standardwert
 * waere hier ein Datenschutzfehler und kein Komfort.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Kontext und Hook gehoeren zusammen; ein eigenes Hook-Modul wuerde nur den Importpfad verdoppeln.
export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContextObject)
  if (value === null) {
    throw new Error(
      "useEditorContext benoetigt einen EditorContextProvider darueber."
    )
  }
  return value
}
