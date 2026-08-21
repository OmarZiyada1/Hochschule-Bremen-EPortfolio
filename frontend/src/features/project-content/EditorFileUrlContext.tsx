import { createContext, useContext, type ReactNode } from "react"

/**
 * Die Aufloesung einer Datei-ID in eine anzeigbare Adresse, fuer alles, was
 * innerhalb der Schreibflaeche liegt.
 *
 * <p><strong>Warum ein Kontext und keine Requisite.</strong> Die
 * Knotenansichten der Medienbloecke haengt ProseMirror selbst ein; sie
 * bekommen von React keine Requisiten durchgereicht, sondern nur den Knoten
 * und den Editor. Ein Kontext ist der einzige Weg, ihnen etwas mitzugeben,
 * das die Seite kennt und sie nicht.
 *
 * <p>Der Standardwert liefert die leere Zeichenkette. Er greift, wenn ein
 * Knoten ausserhalb des Editors gerendert wird, etwa in einem Test der
 * Extension allein: dann gibt es nichts anzuzeigen, und ein {@code src=""}
 * entsteht trotzdem nicht, weil die Verwendungsstelle auf die leere
 * Zeichenkette prueft.
 */

const EditorFileUrlContext = createContext<(fileId: string) => string>(() => "")

export function EditorFileUrlProvider({
  resolveFileUrl,
  children,
}: {
  resolveFileUrl: (fileId: string) => string
  children: ReactNode
}) {
  return (
    <EditorFileUrlContext.Provider value={resolveFileUrl}>
      {children}
    </EditorFileUrlContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- Kontext und Hook gehoeren zusammen; ein eigenes Hook-Modul wuerde nur den Importpfad verdoppeln.
export function useEditorFileUrl(): (fileId: string) => string {
  return useContext(EditorFileUrlContext)
}
