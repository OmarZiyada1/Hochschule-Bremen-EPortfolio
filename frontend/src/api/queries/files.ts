import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { StoredFileResponse } from "@/api/types"

/**
 * queryOptions-Fabrik fuer den Abruf einer Datei als Blob (§3.15.1).
 *
 * <p>Gebraucht ueberall dort, wo eine Datei zu einem <strong>nicht
 * veroeffentlichten</strong> Projekt angezeigt wird, also im
 * Metadatenformular und spaeter im Editor: dort entscheidet die
 * Berechtigung der anfragenden Person (§5, Zeile „Datei lesen"), und ein
 * {@code <img src>} kann sie nicht nachweisen. Bei einem veroeffentlichten
 * Projekt genuegt weiterhin die blosse Adresse, dort ist die Datei
 * oeffentlich.
 *
 * <p>Der Schluessel ist die Referenz selbst, denn genau die steht am
 * Projekt (§3.15.1). {@code staleTime: Infinity}, weil eine Datei unter
 * ihrer ID unveraenderlich ist: ein neues Bild bekommt eine neue ID.
 */
export const fileQueries = {
  blob: (fileUrl: string) =>
    queryOptions({
      queryKey: ["files", "blob", fileUrl] as const,
      queryFn: ({ signal }) => api.getBlob(fileUrl, { signal }),
      staleTime: Infinity,
    }),
}

/**
 * Mutationsfunktionen der Ressource Dateien (§3.15, KAN-23).
 *
 * <p>Der Upload laeuft als multipart/form-data mit dem Teil "file". Der
 * Client setzt fuer FormData bewusst keinen Content-Type: die Grenzmarke
 * kennt nur fetch (api/client.ts).
 */

/**
 * POST /api/files ohne projectId (§3.15): eine Datei ohne Projektbezug ist
 * per Definition ein Avatar. Einen eigenen Avatar-Endpoint gibt es nicht,
 * und im Profil steht spaeter allein die zurueckgegebene Referenz
 * /api/files/{id}, nie Base64 und nie eine Speicheradresse (§3.15.1).
 *
 * Fehlerfaelle des Servers: 400 FILE_TYPE_NOT_ALLOWED, wenn der Typ nicht
 * in der Allowlist steht oder der Inhalt nicht zu ihm passt, und 400
 * FILE_TOO_LARGE oberhalb des Limits. Beide erscheinen als Meldung am
 * Formular; die Allowlist wird im Client nicht nachgebaut (Skill
 * frontend-api, Abschnitt 8).
 */
export function uploadAvatar(file: File): Promise<StoredFileResponse> {
  const body = new FormData()
  body.append("file", file)
  return api.post<StoredFileResponse>(apiPaths.files.upload, body)
}

/**
 * POST /api/files mit projectId (§3.15, KAN-35): eine Datei mit
 * Projektbezug, hier das Titelbild.
 *
 * <p><strong>projectId ist keine Nebensache, sondern die Sichtbarkeit.</strong>
 * Sie entscheidet, wer die Datei spaeter lesen darf: die Sichtbarkeit einer
 * Datei richtet sich nach der des zugehoerigen Projekts (§5, Zeile „Datei
 * lesen"). Ohne sie waere derselbe Upload per Definition ein Avatar und
 * fuer jede:n abrufbar. Das Feld geht deshalb in dasselbe FormData wie die
 * Datei und nicht als Query-Parameter.
 *
 * <p>Der Upload ist nur zulaessig, solange das Projekt in {@code DRAFT}
 * oder {@code REVISION} steht, sonst <strong>409</strong>
 * {@code PROJECT_STATUS_NOT_EDITABLE} (§4.1). Weitere Fehlerfaelle wie bei
 * {@link uploadAvatar}: 400 FILE_TYPE_NOT_ALLOWED und 400 FILE_TOO_LARGE.
 *
 * <p><strong>Mit Fortschritt und Abbruch seit KAN-36</strong>, wie hier
 * angekuendigt: der Editor legt Bilder, Ton, Video und Dokumente unmittelbar
 * in den Beitrag, und ein Upload von zehn Megabyte ohne Rueckmeldung sieht
 * aus wie ein Stillstand. Beides braucht einen anderen Transport als fetch
 * ({@code api.upload}); eine zweite Upload-Funktion ist dafuer nicht
 * entstanden. Wer den Fortschritt nicht braucht, laesst die Optionen weg
 * und merkt keinen Unterschied.
 *
 * @param onProgress Anteil zwischen 0 und 1, oder {@code null}, solange die
 *                   Gesamtgroesse unbekannt ist
 * @param signal     bricht den laufenden Upload ab
 */
export function uploadProjectFile(
  file: File,
  projectId: string,
  options: {
    onProgress?: (progress: number | null) => void
    signal?: AbortSignal
  } = {}
): Promise<StoredFileResponse> {
  const body = new FormData()
  body.append("file", file)
  body.append("projectId", projectId)
  return api.upload<StoredFileResponse>(apiPaths.files.upload, body, options)
}
