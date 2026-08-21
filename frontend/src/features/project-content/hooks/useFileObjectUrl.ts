import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import { apiPaths } from "@/api/endpoints"
import { fileQueries } from "@/api/queries/files"

/**
 * Macht eine {@code fileId} aus einem Blockinhalt anzeigbar.
 *
 * <p><strong>Warum nicht einfach {@code src="/api/files/…"}.</strong> Die
 * Sichtbarkeit einer Datei richtet sich nach der des Projekts (§5, Zeile
 * „Datei lesen"). Solange der Beitrag ein Entwurf ist, darf ihn nur die
 * Autor:in und ihr Kreis lesen, und ein {@code img}-Element weist nichts
 * nach: das Token liegt im Store, nicht in einem Cookie. Das Bild bliebe
 * stumm leer, ohne Fehler und ohne Meldung. Deshalb holt
 * {@code fileQueries.blob} die Datei mit Token, und daraus wird eine
 * Object-URL (derselbe Weg wie im Titelbildfeld aus KAN-35).
 *
 * <p>Die Object-URL wird beim Wechsel freigegeben. Ohne
 * {@code revokeObjectURL} haelt der Browser jedes je gezeigte Bild bis zum
 * Neuladen der Seite im Speicher, und ein Beitrag mit einer Galerie kommt
 * schnell auf zweistellige Megabyte.
 *
 * @param fileId Datei-ID aus dem Blockinhalt; leer heisst „noch keine"
 */
export function useFileObjectUrl(fileId: string | null | undefined): {
  url: string | null
  isPending: boolean
  isError: boolean
} {
  const path = fileId ? apiPaths.files.detail(fileId) : ""
  const file = useQuery({ ...fileQueries.blob(path), enabled: path !== "" })

  const blob = file.data
  const url = useMemo(
    () => (blob === undefined ? null : URL.createObjectURL(blob)),
    [blob]
  )

  useEffect(() => {
    if (url === null) {
      return
    }
    return () => URL.revokeObjectURL(url)
  }, [url])

  return {
    url,
    /* Ohne fileId wird nichts geladen, und „laedt" waere dann eine
       Dauermeldung an einem leeren Platzhalter. */
    isPending: path !== "" && file.isPending,
    isError: file.isError,
  }
}
