import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { masterDataQueries } from "@/api/queries/masterData"
import {
  approveProject,
  projectQueries,
  publishProject,
  requestProjectRevision,
  resignAsEditor,
  type ReviewListParams,
} from "@/api/queries/projects"
import { nominateProject, top10Queries } from "@/api/queries/top10"
import type {
  NominationTier,
  ProjectDetailResponse,
  ProjectStatus,
} from "@/api/types"
import { REVIEW_STATUSES } from "@/features/reviews/reviewFilters"

/**
 * Die Hooks von „Meine Reviews" und des Review-Modus (KAN-37). Pfade, Typen
 * und Query-Keys liegen in den Fabriken unter api/queries (Skill
 * frontend-modul, Abschnitt 2); diese Hooks benennen nur die Fachlichkeit.
 */

/** Die der angemeldeten Redakteur:in zugewiesenen Projekte (§6.1). */
export function useReviewList(params: ReviewListParams) {
  return useQuery(projectQueries.reviews(params))
}

/**
 * Die vier Kennzahlen der Kopfkarte: je Status die Gesamtzahl der eigenen
 * Zuweisungen.
 *
 * <p><strong>Vier eigene Abfragen mit {@code size=1}</strong> und nicht aus
 * der geladenen Seite gerechnet: sichtbar sind hoechstens zwanzig Zeilen,
 * und sobald ein Filter oder eine Seite gesetzt ist, zaehlte eine
 * Ableitung aus der Liste etwas anderes als „alle meine Eingereichten".
 * Die Zahl steht in {@code totalElements} (§6.6); die eine mitgelieferte
 * Zeile ist der Preis dafuer, dass §6.1 keinen Zaehl-Endpoint fuehrt.
 *
 * <p>Die Kennzahlen ignorieren Suche und Filter bewusst: sie beschreiben
 * die Arbeitslast und nicht die aktuelle Trefferliste.
 */
export function useReviewCounts() {
  return useQueries({
    queries: REVIEW_STATUSES.map((status) =>
      projectQueries.reviews({ status, size: 1 })
    ),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      /*
       * Eine gescheiterte Zaehlabfrage ist keine Null. Ohne diesen Zustand
       * zeigte die Kachel nach einem 500 die Zahl 0 und damit eine falsche
       * Aussage statt eines Fehlers (Befund des frontend-reviewers).
       */
      isError: results.some((result) => result.isError),
      counts: Object.fromEntries(
        REVIEW_STATUSES.map((status, index) => [
          status,
          results[index]?.data?.totalElements,
        ])
      ) as Partial<Record<ProjectStatus, number>>,
    }),
  })
}

/**
 * Die eigenen Top-10-Nominierungen und die kuratierte Liste selbst.
 *
 * <p>Beides zusammen, weil die Karte beides braucht: die Nominierungen als
 * Inhalt und die Liste fuer die Angabe „n von zehn Plaetzen aktiv" sowie
 * fuer die Sperre „Bereits in Top 10" im Zeilenmenue.
 */
export function useOwnNominations() {
  return {
    nominations: useQuery(top10Queries.nominations()),
    top10: useQuery(top10Queries.list()),
  }
}

/** Die Optionen der drei Auswahlfelder (§3.7, §3.18, §3.9). */
export function useReviewFilterOptions() {
  return {
    studyPrograms: useQuery(masterDataQueries.studyPrograms()),
    semesters: useQuery(masterDataQueries.semesters()),
    modules: useQuery(masterDataQueries.modules()),
  }
}

/**
 * Ein Projekt fuer die Top-10 vorschlagen (§3.11.1).
 *
 * <p>Danach wird der Nominierungs-Ast invalidiert: die Karte „Meine
 * Top-10-Nominierungen" zeigt den Vorschlag sonst erst nach einem Reload.
 * Die Projektliste bleibt unberuehrt, ein Vorschlag aendert am Projekt
 * nichts.
 */
export function useNominateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId,
      proposedTier,
    }: {
      projectId: string
      proposedTier: NominationTier
    }) => nominateProject(projectId, proposedTier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["top10", "nominations"] })
    },
  })
}

/**
 * Die drei Statuswechsel der Redaktion und das Abgeben der Zuweisung
 * (§4.1, §6.1).
 *
 * <p>Alle vier liefern die Detailantwort mit neuer {@code version}. Sie
 * wird per {@code setQueryData} gelegt: die Antwort <em>ist</em> der neue
 * Stand, und die Oberflaeche zeigt ihn damit sofort, ohne durch den
 * Ladezustand zu laufen. Danach wird der {@code projects}-Ast invalidiert,
 * weil Status und Zuweisung in Zeilen und Kennzahlen stehen; der Praefix
 * umfasst den Detailschluessel mit, die Detailabfrage laeuft also noch
 * einmal nach. Das ist gewollt: sie holt sich damit auch das, was die
 * Antwort nicht traegt, etwa eine inzwischen fremd geaenderte
 * Mitgliederliste. Der gelegte Stand verhindert nur das Flackern
 * dazwischen.
 *
 * <p><strong>Kein {@code retry}.</strong> Bei 409
 * {@code PROJECT_VERSION_CONFLICT} wuerde ein zweiter Versuch genau die
 * fremde Aenderung ueberschreiben, vor der die Versionspruefung schuetzt
 * (§6.4, Frontend-Regel 4). TanStack Query wiederholt Mutationen ohnehin
 * nicht; hier steht es, damit niemand es aus Versehen einschaltet.
 */
export function useReviewWorkflow(projectId: string) {
  const queryClient = useQueryClient()

  function applyResult(updated: ProjectDetailResponse): void {
    queryClient.setQueryData(projectQueries.detail(projectId).queryKey, updated)
    void queryClient.invalidateQueries({ queryKey: ["projects"] })
  }

  const approve = useMutation({
    mutationFn: () => approveProject(projectId),
    onSuccess: applyResult,
  })

  const publish = useMutation({
    mutationFn: () => publishProject(projectId),
    onSuccess: applyResult,
  })

  const requestRevision = useMutation({
    mutationFn: (reason: string) => requestProjectRevision(projectId, reason),
    onSuccess: (updated) => {
      applyResult(updated)
      /*
       * Die Begruendung wird serverseitig zu einem CHANGE_REQUEST mit Stand
       * OPEN (§4.1). Ohne diese Invalidierung stuende die Kommentarspalte
       * daneben und zeigte den Arbeitsauftrag nicht an, den der Aufruf
       * gerade erzeugt hat.
       */
      void queryClient.invalidateQueries({ queryKey: ["comments", projectId] })
    },
  })

  const resign = useMutation({
    mutationFn: () => resignAsEditor(projectId),
    onSuccess: applyResult,
  })

  return { approve, publish, requestRevision, resign }
}
