import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { StoredFileResponse } from "@/api/types"

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
