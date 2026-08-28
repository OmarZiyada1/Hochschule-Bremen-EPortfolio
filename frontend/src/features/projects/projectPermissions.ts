import type { ProjectDetailResponse } from "@/api/types"

/**
 * Die Ressourcenebene der Rechtematrix, soweit das Frontend sie spiegelt
 * (§5, §6.1), als reine Funktionen: ohne Rendern pruefbar (Skill
 * frontend-modul, Abschnitt 3) und an genau einer Stelle aufgeschrieben.
 *
 * <p><strong>Warum eine eigene Datei.</strong> Dieselbe Bedingung stand bis
 * zur Nacharbeit zweimal wortgleich im Code, im Editor und im
 * Metadatenformular, und genau daraus entstand der Fehler, den die
 * Nacharbeit behebt: an einer der beiden Stellen fehlte sie. Das Backend
 * fuehrt dieselbe Frage nach Hausregel 5 ebenfalls an einer Stelle
 * ({@code ProjectPermissionService}); dies ist ihr Gegenstueck.
 *
 * <p><strong>Verbindlich bleibt der Server.</strong> Diese Funktionen
 * entscheiden nur, ob die Oberflaeche ein Feld beschreibbar zeigt; wer sie
 * umgeht, scheitert am Server mit 403 beziehungsweise 409. Sie nehmen ihm
 * die Ueberraschung, sie ersetzen ihn nicht.
 */

/**
 * Gehoert diese Person zur „Projektseite" (§2.4, §3.13), also Autor:in oder
 * Projektmitglied?
 *
 * <p>Ohne geladenes Projekt oder ohne angemeldete Person ist die Antwort
 * {@code false}. Das ist die vorsichtige Richtung: eine Flaeche, die
 * beschreibbar erscheint, bevor die Antwort da ist, laedt zu einer Eingabe
 * ein, die anschliessend abgewiesen wuerde.
 *
 * @param project geladenes Projekt, oder {@code undefined} waehrend des Ladens
 * @param userId  angemeldete Person, oder {@code null}/{@code undefined}
 */
export function isProjectSide(
  project: ProjectDetailResponse | undefined,
  userId: string | null | undefined
): boolean {
  if (project === undefined || userId === null || userId === undefined) {
    return false
  }
  return (
    project.author.id === userId ||
    project.members.some((member) => member.userId === userId)
  )
}

/**
 * Darf diese Person die Metadaten dieses Projekts aendern?
 *
 * <p>Zwei Bedingungen, wie am Server (§6.1, Zeile {@code PUT /projects/{id}}:
 * „Autor:in und Mitglieder, in DRAFT und REVISION";
 * {@code ProjectPermissionService.mayEditMetadata}): die Zugehoerigkeit und
 * der Status. Der Status allein genuegt nicht, und die Zugehoerigkeit allein
 * auch nicht.
 *
 * <p><strong>Ein Admin faellt ebenfalls darunter</strong>, solange er nicht
 * selbst zur Projektseite gehoert: die Endpoint-Zeile nennt ihn nicht, und
 * sein Aufruf endet mit 403. Fremde Zustaendigkeiten verteilt er ueber
 * {@code PUT /projects/{id}/editors}, Status aendert er ueber die
 * Aktions-Endpoints.
 */
export function mayEditMetadata(
  project: ProjectDetailResponse | undefined,
  userId: string | null | undefined
): boolean {
  if (project === undefined) {
    return false
  }
  return (
    isProjectSide(project, userId) &&
    (project.status === "DRAFT" || project.status === "REVISION")
  )
}
