import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { BlocksResponse } from "@/api/types"
import type { ContentBlockRequest } from "@/features/project-content/blockTypes"

/**
 * Die Ressource Inhalt eines Projekts (§6.1, §3.4, KAN-36).
 *
 * <p><strong>Inhalt und Metadaten bleiben getrennt</strong>, im Client wie
 * im Server: die Metadatenkarte laeuft ueber
 * {@code PUT /api/projects/{id}}, der Inhalt ueber diesen Endpoint. Beides
 * zusammenzufassen hiesse, aus jedem Tastenanschlag im Editor eine
 * Metadatenaenderung zu machen.
 *
 * <p><strong>Der Typ von {@code content} kommt aus dem Feature</strong> und
 * nicht aus der Generierung, und das ist die einzige Ausnahme in dieser
 * Schicht: springdoc erzeugt fuer {@code JsonNode} ein
 * {@code Record<string, never>}, also einen Typ ohne jede Eigenschaft,
 * gegen den sich weder lesen noch schreiben liesse (Frontend-Regel 2,
 * begruendet in {@code blockTypes.ts}). Der Import ist ein reiner Typimport
 * und erzeugt zur Laufzeit keine Abhaengigkeit.
 */
export const blockQueries = {
  /**
   * GET /api/projects/{id}/blocks.
   *
   * <p>Die Antwort traegt neben den Bloecken die {@code version} des
   * Projekts; sie ist der Stand fuer den naechsten schreibenden Request
   * (§6.4) und wandert unveraendert in den naechsten PUT.
   *
   * <p><strong>Kein {@code staleTime}, aber auch kein Nachladen im
   * Hintergrund.</strong> Der Editor haelt das Dokument nach dem ersten
   * Lesen in ProseMirror; ein Refetch mitten im Schreiben wuerde die
   * Schreibflaeche gegen den Serverstand tauschen und Eingaben verlieren.
   * Neu gelesen wird ausschliesslich auf Anforderung, also nach einem
   * Versionskonflikt.
   */
  list: (projectId: string) =>
    queryOptions({
      queryKey: ["projects", "blocks", projectId] as const,
      queryFn: ({ signal }) =>
        api.get<BlocksResponse>(apiPaths.projects.blocks(projectId), {
          signal,
        }),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
}

/**
 * PUT /api/projects/{id}/blocks (§6.1): ersetzt die gesamte Blockliste und
 * antwortet mit {@code { version, blocks }}.
 *
 * <p><strong>Ersetzend, nicht ergaenzend.</strong> Was nicht im Rumpf
 * steht, ist danach geloescht; {@code []} leert den Beitrag. Deshalb darf
 * der Editor nur speichern, wenn er die gelesene Fassung vollstaendig
 * darstellen konnte ({@code BlocksToDocResult.canSave}).
 *
 * <p><strong>Die Antwort wird uebernommen, nicht verworfen.</strong> Sie
 * traegt die neue {@code version} und die IDs der angelegten Bloecke; ohne
 * beides schickte der naechste Takt dieselben Bloecke wieder ohne
 * {@code id}, der Server legte sie neu an, und blockbezogene Kommentare
 * waeren dauerhaft unmoeglich (§6.1, offener Punkt 6 in §7).
 *
 * <p><strong>Bei 409 {@code PROJECT_VERSION_CONFLICT} wird nie automatisch
 * wiederholt</strong> (§6.4). Ein zweiter Versuch mit der neuen Version
 * ueberschriebe genau die fremde Aenderung, vor der das Locking schuetzt.
 */
export function replaceBlocks(
  projectId: string,
  version: number,
  blocks: readonly ContentBlockRequest[]
): Promise<BlocksResponse> {
  return api.put<BlocksResponse>(apiPaths.projects.blocks(projectId), {
    version,
    blocks,
  })
}
