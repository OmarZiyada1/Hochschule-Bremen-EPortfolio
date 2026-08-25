import type { ProjectCardResponse } from "@/api/types"
import type { DisplayPerson } from "@/components/common/ProjectPeople"

/**
 * Die Personen, die an einem Projekt gearbeitet haben, in Anzeigereihenfolge
 * (§3.3, §3.13; seit Contract v78 fuehrt die Kachel beide).
 *
 * <p><strong>Die Autor:in zuerst, danach die Mitwirkenden.</strong> Sie ist
 * keine Mitgliedszeile, sondern steht in {@code Project.authorId} (§3.13.1);
 * eine Doppelung kann deshalb nicht entstehen, der Server weist ihre ID in
 * {@code members} mit 400 ab. Die Reihenfolge der Mitwirkenden ist die des
 * Servers, also nach Nachname; umsortiert wird hier nichts, sonst stuende an
 * zwei Ansichten dieselbe Gruppe in zwei Ordnungen.
 *
 * <p><strong>Die Redaktion gehoert nicht dazu.</strong> Sie betreut das
 * Projekt, sie hat es nicht geschrieben, und wer sie sehen darf, entscheidet
 * §5. Sie steht deshalb nicht an der Kachel und auch nicht in dieser Liste.
 *
 * <p>Eigene Datei und keine Funktion neben der Komponente: eine
 * Komponentendatei, die auch etwas anderes ausfuehrt, bricht das Fast
 * Refresh der Entwicklungsumgebung (Lint
 * {@code react-refresh/only-export-components}).
 */
export function peopleOfProject(
  project: ProjectCardResponse
): DisplayPerson[] {
  const author: DisplayPerson = {
    id: project.author.id,
    firstName: project.author.firstName,
    lastName: project.author.lastName,
    avatarUrl: project.author.avatarUrl,
  }

  const members = (project.members ?? []).map((member) => ({
    id: member.userId,
    firstName: member.firstName,
    lastName: member.lastName,
    avatarUrl: member.avatarUrl,
  }))

  return [author, ...members]
}
