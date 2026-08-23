import { useQuery } from "@tanstack/react-query"

import { resolveApiUrl } from "@/api/client"
import { fileQueries } from "@/api/queries/files"

/**
 * Macht die Referenz einer Datei ({@code /api/files/{id}}, §3.15.1)
 * anzeigbar, mit oder ohne Anmeldung.
 *
 * <p><strong>Warum es zwei Wege gibt.</strong> {@code GET /api/files/{id}}
 * ist oeffentlich, sobald das zugehoerige Projekt {@code PUBLISHED} ist,
 * und Avatare sind es immer (§3.15, §5, Zeile „Datei lesen"). Dort genuegt
 * die blosse Adresse im {@code src}, und der Browser darf sie
 * zwischenspeichern. Davor entscheidet die Berechtigung der anfragenden
 * Person, und ein {@code img} weist nichts nach: das Token liegt im Store
 * und nicht in einem Cookie. Der Server antwortet dann mit 401, der Rahmen
 * bleibt leer, und zu sehen ist davon nichts, weder Fehler noch Meldung.
 *
 * <p>Genau das war der Befund aus KAN-36: nach dem Einreichen verschwand
 * das Titelbild eines Projekts, weil {@code SUBMITTED} nicht
 * {@code PUBLISHED} ist. Es lag nie am Bild, sondern daran, dass die
 * Kachel und die Detailseite den oeffentlichen Weg auch dort nahmen, wo er
 * nicht gilt.
 *
 * <p>Der angemeldete Weg holt die Datei ueber den Client und macht daraus
 * eine Object-URL; sie gehoert dem Query-Cache und wird mit ihm
 * freigegeben ({@code fileQueries.objectUrl}).
 *
 * @param fileUrl    Referenz aus einer Antwort, etwa
 *                   {@code project.coverImageUrl}; leer heisst „keine Datei"
 * @param needsToken wahr, solange die Datei nicht oeffentlich ist, also bei
 *                   jedem Projekt ausserhalb von {@code PUBLISHED}
 */
export function useFileUrl(
  fileUrl: string | null | undefined,
  needsToken: boolean
): { url: string | null; isPending: boolean; isError: boolean } {
  const path = fileUrl == null || fileUrl === "" ? "" : fileUrl
  const enabled = path !== "" && needsToken
  const file = useQuery({ ...fileQueries.objectUrl(path), enabled })

  if (path === "") {
    return { url: null, isPending: false, isError: false }
  }
  if (!needsToken) {
    /* Ueber resolveApiUrl und nicht ueber den nackten Pfad: die Adresse
       landet im src eines img und laeuft nie durch request(), die
       Basis-URL muesste sie also selbst tragen (KAN-32). */
    return { url: resolveApiUrl(path), isPending: false, isError: false }
  }
  return {
    url: file.data ?? null,
    isPending: file.isPending,
    isError: file.isError,
  }
}
