import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  replaceSiteContent,
  siteContentKey,
  siteContentQueries,
} from "@/api/queries/siteContent"
import type { SiteContentEntryRequest } from "@/api/types"

/**
 * Die Query- und Mutation-Hooks der Startseitentexte (Contract §2.16,
 * §3.21, §6.1). Sie kennen weder Pfade noch {@code api.*}: beides steht in
 * {@code api/queries/siteContent.ts} (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Der lesende Hook ist derselbe wie auf der Startseite</strong>,
 * und das ist Absicht: die Pflegemaske und die Seite, die sie pflegt, sehen
 * denselben Bestand unter demselben Query-Key. Wer speichert, sieht danach
 * ohne Umweg, was die Startseite zeigen wird.
 */

/**
 * Der gepflegte Stand, wie ihn die Pflegemaske als Ausgangswerte ihrer
 * Felder braucht (§6.1).
 *
 * <p>Die Antwort fuehrt nur gepflegte Stellen; ein Schluessel, der fehlt,
 * ist nicht leer, sondern ungepflegt, und die Maske zeigt dort die Vorgabe
 * des Frontends als Platzhalter. Diese Unterscheidung trifft die Ansicht,
 * nicht der Hook.
 */
export function useSiteContent() {
  return useQuery(siteContentQueries.list())
}

/**
 * Die Textstellen speichern, {@code PUT /api/admin/site-content} (200).
 *
 * <p><strong>Invalidiert wird der ganze Ast.</strong> Die Antwort ist zwar
 * bereits der neue Gesamtstand und liesse sich in den Cache schreiben; das
 * Nachladen ist trotzdem der ehrlichere Weg, weil zwei Personen gleichzeitig
 * pflegen koennen und der Server dabei das letzte Wort hat.
 *
 * <p><strong>Kein zweiter Versuch.</strong> Ein 400
 * {@code VALIDATION_FAILED} scheiterte beim Wiederholen mit derselben
 * Begruendung; TanStack Query wiederholt Mutationen ohnehin nicht
 * (Frontend-Regel 4, {@code api/queryClient.ts}).
 */
export function useReplaceSiteContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entries: readonly SiteContentEntryRequest[]) =>
      replaceSiteContent(entries),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteContentKey() })
    },
  })
}
