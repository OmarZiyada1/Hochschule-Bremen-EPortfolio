import type { ProjectStatus } from "@/api/types"

/**
 * Aus welcher Liste heraus ein Projekt geoeffnet wird.
 *
 * <p>Nicht die Rolle, sondern die Liste: dieselbe Person kann ein Projekt
 * als Autor:in in „Mein Portfolio" und als Redakteur:in in „Meine Reviews"
 * vor sich haben, und sie will an den beiden Stellen Verschiedenes.
 */
export type ProjectListView = "public" | "own" | "review"

/**
 * Wohin eine Kachel oder Tabellenzeile fuehrt.
 *
 * <p><strong>Die Adresse haengt am Status, nicht am Ort.</strong> Bis dahin
 * zielte jede Kachel, jede Zeile und jede Nominierung auf
 * {@code /projects/:projectId}, also auf die oeffentliche Seite. Fuer ein
 * veroeffentlichtes Projekt ist das richtig; fuer alles davor war es eine
 * Sackgasse. Seit KAN-104 traegt diese Seite keinen Weg mehr in den Editor
 * oder in die Reviewansicht, und der Stift auf der Kachel gibt es nur in
 * {@code DRAFT} und {@code REVISION} und nur unter „Mein Portfolio": wer ein
 * eingereichtes Projekt oeffnete, sah eine Vorschau, in der sich nichts tun
 * liess, nicht einmal das Zurueckziehen.
 *
 * <p>Die drei Ziele im Einzelnen:
 *
 * <ul>
 * <li>{@code public}: immer die oeffentliche Seite. Aus der Projektliste,
 * einem fremden Portfolio oder der Startseite kommt ohnehin nur, was
 * veroeffentlicht ist (§5).</li>
 * <li>{@code own}: solange nicht veroeffentlicht, der Editor. Dort stehen
 * der Umschalter zwischen Vorschau und Bearbeiten und die Handlungen des
 * Zustandsautomaten, also auch das Zurueckziehen eines eingereichten
 * Projekts (KAN-104). Dass der Editor in einem gesperrten Status nicht
 * schreibt, ist kein Widerspruch: er zeigt dann die Vorschau, und
 * {@code EditLockGate} laesst einen 409 ausdruecklich durch.</li>
 * <li>{@code review}: solange nicht veroeffentlicht, die Reviewansicht. Sie
 * traegt denselben Umschalter und daneben die Redaktionswerkzeuge. Fehlt
 * die Zustaendigkeit, antwortet der Server mit 403, und die Seite zeigt das
 * sichtbar an; geraten wird an der Zustaendigkeit hier nichts.</li>
 * </ul>
 *
 * <p><strong>Ein unbekannter Status fuehrt auf die oeffentliche Seite.</strong>
 * In den erzeugten Typen ist {@code status} seit KAN-76 ein Pflichtfeld
 * ({@code api/types.ts}); der Zweig faengt also keinen Typfall ab, sondern
 * einen Aufrufer, der eine Teilantwort oder einen Testdatensatz ohne Status
 * hereingibt. Jemanden auf Verdacht in den Editor zu schicken waere der
 * teurere Irrtum: die oeffentliche Seite gibt es fuer jedes Projekt, das man
 * lesen darf.
 */
export function projectHref(
  projectId: string,
  status: ProjectStatus | undefined,
  view: ProjectListView
): string {
  const detail = `/projects/${projectId}`
  if (view === "public" || status === undefined || status === "PUBLISHED") {
    return detail
  }
  return view === "own" ? `${detail}/editor` : `${detail}/review`
}
