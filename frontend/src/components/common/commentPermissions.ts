import type { CommentType, ProjectDetailResponse, Role } from "@/api/types"

/**
 * Die beiden Rechtefragen der Kommentarspalte als reine Funktionen (§5,
 * §2.3, §2.4; KAN-37).
 *
 * <p>Sie liegen neben der Komponente und nicht in ihr, damit sie ohne
 * Rendern pruefbar sind (Skill frontend-modul, Abschnitt 3) und damit die
 * Komponentendatei ausschliesslich Komponenten ausfuehrt (Lint
 * react-refresh/only-export-components).
 *
 * <p><strong>Sie bilden die Rechtematrix ab und ersetzen sie nicht.</strong>
 * Verbindlich bleibt der Server; die Oberflaeche bietet nur an, was ohnehin
 * greift, und behandelt ein trotzdem eintreffendes 403 sichtbar
 * (Frontend-Regel 4, Skill frontend-api Abschnitt 8).
 */

/**
 * Welche Kommentartypen die anfragende Person hier anlegen darf.
 *
 * <p>§5 gibt {@code REPLY} der gesamten Projektseite samt Redaktion und
 * Administration, {@code NOTE} und {@code CHANGE_REQUEST} allein EDITOR und
 * ADMIN. Im Editor bleibt es bei der Antwort, auch fuer ein
 * Redaktionskonto: dort schreibt jemand am eigenen Beitrag, und ein
 * Aenderungswunsch an sich selbst waere ein Arbeitsauftrag ohne
 * Auftraggeber.
 */
export function creatableTypes(
  role: Role | undefined,
  context: "review" | "editor"
): readonly CommentType[] {
  if (role === undefined) {
    return []
  }
  if (context === "editor") {
    return ["REPLY"]
  }
  return role === "EDITOR" || role === "ADMIN"
    ? ["REPLY", "NOTE", "CHANGE_REQUEST"]
    : ["REPLY"]
}

/**
 * Dieselbe Liste als nicht leeres Tupel, wie das zod-Schema und das
 * Formular sie brauchen. {@code null}, wenn nichts erlaubt ist; dann
 * entfaellt das Formular ganz, statt eine Eingabe anzubieten, die in einem
 * 403 endet.
 */
export function creatableTuple(
  role: Role | undefined,
  context: "review" | "editor"
): readonly [CommentType, ...CommentType[]] | null {
  const types = creatableTypes(role, context)
  return types.length === 0
    ? null
    : (types as readonly [CommentType, ...CommentType[]])
}

/**
 * Darf die anfragende Person diesen Kommentar loeschen (§6.1, Zeile
 * „DELETE /comments/{id} | Autor:in / ADMIN")?
 *
 * <p><strong>Autor:in meint die verfassende Person des Kommentars</strong>
 * und nicht die des Projekts. Bildet
 * {@code ProjectPermissionService.mayDeleteComment} ab: wer geschrieben
 * hat, nimmt zurueck, und die Administration raeumt auf. Die Projektseite
 * darf einen Aenderungswunsch der Redaktion <em>erledigen</em> (§2.4), aber
 * nicht wegloeschen; sonst waere die Vorbedingung beim Einreichen (§4.1,
 * 409 CHANGE_REQUESTS_OPEN) mit einem Klick zu umgehen.
 */
export function mayDeleteComment(
  commentAuthorId: string,
  user: { id: string; role: Role } | null
): boolean {
  if (user === null) {
    return false
  }
  return user.role === "ADMIN" || commentAuthorId === user.id
}

/**
 * Darf die anfragende Person den Stand eines Aenderungswunsches setzen
 * (§5, Zeile „CHANGE_REQUEST-Status setzen": STUDENT (✓), EDITOR ✓,
 * ADMIN ✓)?
 *
 * <p>Bildet {@code ProjectPermissionService.maySetChangeRequestStatus} ab:
 * Redaktion und Administration duerfen es aus ihrer Rolle heraus, die
 * Projektseite aus ihrer Beteiligung. Fussnote 2 zu §5 meint mit
 * „Projektseite" Autor:in und Projektmitglieder (§3.13) und nicht jedes
 * studentische Konto; deshalb wird sie aus dem Projekt abgeleitet und nicht
 * aus der Rolle.
 */
export function maySetChangeRequestStatus(
  project: ProjectDetailResponse,
  user: { id: string; role: Role } | null
): boolean {
  if (user === null) {
    return false
  }
  if (user.role === "EDITOR" || user.role === "ADMIN") {
    return true
  }
  if (project.author.id === user.id) {
    return true
  }
  return (project.members ?? []).some((member) => member.userId === user.id)
}
