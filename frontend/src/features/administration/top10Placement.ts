import type { ProjectStatus } from "@/api/types"

/**
 * Der Grund, aus dem sich ein Projekt gerade nicht unmittelbar in die Top-10
 * aufnehmen laesst, oder {@code null}, wenn es geht (§3.11, §3.11.1;
 * Nacharbeit an KAN-87).
 *
 * <p><strong>Aufnehmen ist nicht Nominieren.</strong> Die Administration
 * kuratiert die Liste selbst (§5, Zeile „Top-10 kuratieren") und schreibt
 * dabei ueber {@code PUT /admin/top10} unmittelbar auf die oeffentliche
 * Startseite. Ein Vorschlag mit Stufe, der erst noch entschieden werden
 * muss, ist der Weg der Redaktion; er steht dem Admin in „Meine Reviews"
 * weiterhin offen, wenn er einem Projekt als Redaktion zugewiesen ist.
 * Deshalb sind es zwei Bedienelemente an zwei Orten und nicht eines mit zwei
 * Bedeutungen.
 *
 * <p><strong>Ein offener Vorschlag sperrt hier nicht.</strong> Anders als bei
 * {@code nominationBlockReason} ist {@code hasOpenNomination} kein Grund:
 * §3.11.1 Regel 2 verbietet den <em>zweiten Vorschlag</em> zu einem Projekt,
 * nicht die Aufnahme. Nimmt die Administration ein vorgeschlagenes Projekt
 * unmittelbar auf, geht der offene Vorschlag mit dem Speichern auf
 * {@code ACCEPTED} ueber (§3.11.1 Regel 5); der Vorschlag verfaellt also
 * nicht, er wird eingeloest. Genau so verhaelt sich der Projekt-Picker der
 * Top-10-Verwaltung schon heute.
 *
 * <p>Sie bildet den Contract ab und ersetzt ihn nicht: verbindlich bleibt der
 * Server, der ein unveroeffentlichtes Projekt mit 409
 * {@code PROJECT_NOT_PUBLISHED} und einen doppelten Eintrag mit 400
 * {@code VALIDATION_FAILED} beantwortet. Die Oberflaeche kennt nur den Stand
 * des letzten Ladevorgangs.
 *
 * @param inTop10  belegt das Projekt bereits einen Platz (§3.11.1 Regel 2)?
 * @param listFull sind alle zehn Plaetze vergeben? Dann raeumt auch dieser
 *                 Weg keinen, sondern verlangt zuerst einen freien Platz
 */
export function top10PlacementBlockReason(
  project: { status: ProjectStatus },
  inTop10: boolean,
  listFull: boolean
): "notPublished" | "inTop10" | "listFull" | null {
  if (project.status !== "PUBLISHED") {
    return "notPublished"
  }
  if (inTop10) {
    return "inTop10"
  }
  if (listFull) {
    return "listFull"
  }
  return null
}
