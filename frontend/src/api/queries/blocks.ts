import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { BlocksResponse } from "@/api/types"
import type { ContentBlockRequest } from "@/features/project-content/blockTypes"

/**
 * Die Ressource Inhalt eines Projekts (Contract 6.1, 3.4), also
 * {@code GET} und {@code PUT /api/projects/{id}/blocks}.
 *
 * <p><strong>Eigene Datei neben {@code queries/projects.ts}, und das ist
 * Absicht.</strong> Contract 6.1 haelt Metadaten und Inhalt als zwei
 * Ressourcen auseinander: die Metadatenseite (KAN-35) schickt nie Bloecke
 * mit, und der Autosave des Editors fasst die Metadatenkarte nicht an. Zwei
 * Fabriken machen diese Trennung im Code sichtbar; laege beides in einer
 * Datei, waere der erste Griff nach dem gemeinsamen Request eine Frage der
 * Bequemlichkeit.
 *
 * <p><strong>Beide Richtungen tragen {@code version}</strong> (6.4). Der
 * Wert kommt unveraendert aus der letzten Antwort in den naechsten
 * schreibenden Request; der Client zaehlt ihn nie selbst hoch. Antwortet
 * der Server mit 409 {@code PROJECT_VERSION_CONFLICT}, wird nicht
 * wiederholt (Frontend-Regel 4): ein zweiter Versuch mit der frischen
 * Version ueberschriebe genau die fremde Aenderung, vor der das Locking
 * schuetzt.
 */
export const blockQueries = {
  /**
   * Der Inhalt eines Projekts, geordnet nach {@code orderIndex}, samt der
   * {@code version} fuer den naechsten Schreibzugriff.
   *
   * <p>Sichtbar ist er genau dann, wenn auch das Projekt sichtbar ist (5);
   * der Client raet daran nichts.
   *
   * <p><strong>Kein {@code staleTime} und kein automatisches Neuladen.</strong>
   * Der Editor schreibt gegen dieselbe Ressource, die er liest. Zoege eine
   * Hintergrundaktualisierung die Serverfassung nach, waehrend jemand
   * tippt, ueberschriebe sie ungespeicherte Absaetze; die Fassung im Editor
   * ist waehrend der Sitzung die fuehrende. Aktualisiert wird deshalb
   * ausschliesslich ueber die Antwort des {@code PUT} und nach einem
   * ausdruecklichen Neuladen im Konfliktfall.
   */
  list: (projectId: string) =>
    queryOptions({
      queryKey: ["projects", "blocks", projectId] as const,
      queryFn: () => api.get<BlocksResponse>(apiPaths.projects.blocks(projectId)),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
}

/**
 * {@code PUT /api/projects/{id}/blocks} (6.1): ersetzt die Blockliste
 * <strong>vollstaendig</strong> und in einer Transaktion.
 *
 * <p><strong>Vollstaendig heisst vollstaendig.</strong> Bloecke mit
 * {@code id} werden aktualisiert, Bloecke ohne {@code id} neu angelegt,
 * nicht mehr enthaltene geloescht. Deshalb darf nur senden, wer die
 * gelesene Fassung auch ganz lesen konnte: ist {@code dropped} aus
 * {@code blocksToDoc} nicht leer, wird nicht gespeichert, sonst loeschte
 * der naechste Takt genau die Bloecke, die der Client nicht darstellen
 * konnte.
 *
 * <p>Die Antwort traegt die server-vergebenen IDs und die neue
 * {@code version}. Beides wird uebernommen: ohne die IDs schickt der
 * naechste Takt dieselben Bloecke wieder ohne {@code id}, der Server legt
 * sie neu an, und blockbezogene Kommentare waeren dauerhaft unmoeglich.
 *
 * <p>Erlaubt sind Autor:in und Projektmitglieder, und nur in den Status
 * {@code DRAFT} und {@code REVISION} (4.1); sonst 409
 * {@code PROJECT_STATUS_NOT_EDITABLE}.
 */
export function replaceBlocks(
  projectId: string,
  request: { version: number; blocks: ContentBlockRequest[] }
): Promise<BlocksResponse> {
  return api.put<BlocksResponse>(
    apiPaths.projects.blocks(projectId),
    request
  )
}
