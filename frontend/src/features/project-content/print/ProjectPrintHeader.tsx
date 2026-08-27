import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { fullNameOf } from "@/lib/name"

/**
 * Der Kopfbereich des Ausdrucks (KAN-41): Titelbild, Projekttitel, die
 * Angaben aus §3.3 und das Abstract.
 *
 * <p><strong>Der Titel ist hier die einzige {@code h1}</strong>, wie auf
 * jeder Projektansicht (§2.5, §3.3, SC 1.3.1). Der Blockinhalt darunter
 * beginnt bei {@code h2}, weil der Renderer die sechs Editor-Ebenen um eine
 * Stufe versetzt ausgibt ({@code headingRendering}). Auf dem Bildschirm
 * steht die {@code h1} der Seite ein zweites Mal; sie kommen sich nicht ins
 * Gehege, weil {@code project-content.css} den ganzen Druckbereich am
 * Bildschirm auf {@code display: none} setzt und er damit weder sichtbar
 * noch im Baum der Hilfsmittel ist. Ausserhalb des Druckens steht der
 * Kopfbereich ohnehin gar nicht im DOM ({@code ProjectPrintView}).
 *
 * <p><strong>Was fehlen darf, entfaellt als ganze Zeile</strong>, statt
 * eine Luecke zu behaupten: ein Entwurf hat oft weder Studiengang noch
 * Semester (§3.3 verlangt beides erst zum Einreichen), und ein Ausdruck mit
 * der Zeile „Semester:" ohne Wert sieht nach einem Fehler aus.
 *
 * <p><strong>Das Ausdrucksdatum steht als {@code time}</strong> mit
 * maschinenlesbarem {@code dateTime}. Es ist die einzige Angabe, die nicht
 * aus dem Projekt kommt, und genau deshalb gehoert sie auf das Blatt: ein
 * Ausdruck ohne Datum laesst nicht erkennen, welchen Stand er zeigt.
 *
 * <p>Die Beschriftungen kommen aus i18n wie ueberall (Frontend-Regel 7);
 * die Gestaltung steht in {@code styles/project-content.css}, damit das
 * Aussehen des Ausdrucks an einer Stelle liegt.
 */
export function ProjectPrintHeader({
  project,
  coverUrl,
  now,
}: {
  project: ProjectDetailResponse
  /**
   * Die aufgeloeste Adresse des Titelbildes, oder {@code null}. Die
   * verwendende Seite loest sie auf, weil sie bei einem noch nicht
   * veroeffentlichten Projekt den angemeldeten Weg braucht (§3.15).
   */
  coverUrl: string | null
  /**
   * Der Zeitpunkt des Ausdrucks. Als Prop und nicht als {@code new Date()}
   * im Rumpf: eine Komponente, die die Uhr liest, ist nicht pruefbar.
   */
  now?: Date
}) {
  const { t, i18n } = useTranslation()

  const printedAt = now ?? new Date()
  const author = project.author
  const authorName = author ? fullNameOf(author) : ""
  const studyProgram = project.studyProgram?.name
  const semester = project.semester?.name
  const status = project.status
  const summary = project.summary

  return (
    <header data-print="header">
      {/* Beiwerk zum Titel daneben, wie auf der Detailseite: alt="" statt
          einer Beschreibung, die das Bild nicht hergibt (SC 1.1.1). */}
      {coverUrl !== null && <img src={coverUrl} alt="" />}

      <h1 className="type-title">{project.title}</h1>

      <dl>
        {authorName !== "" && (
          <div>
            <dt>{t("projectContent.print.author")}</dt>
            <dd>{authorName}</dd>
          </div>
        )}
        {studyProgram !== undefined && (
          <div>
            <dt>{t("projectContent.print.studyProgram")}</dt>
            <dd>{studyProgram}</dd>
          </div>
        )}
        {semester !== undefined && (
          <div>
            <dt>{t("projectContent.print.semester")}</dt>
            <dd>{semester}</dd>
          </div>
        )}
        {status !== undefined && (
          <div>
            <dt>{t("projectContent.print.status")}</dt>
            {/* Der Enum-Wert laeuft unveraendert durch den Code und wird nur
                fuer die Anzeige uebersetzt (Frontend-Regel 6). Kein
                StatusBadge: eine gefuellte Pille ist auf Papier eine
                graue Flaeche und kostet Farbe. */}
            <dd>{t(`project.status.${status}`)}</dd>
          </div>
        )}
        <div>
          <dt>{t("projectContent.print.printedAt")}</dt>
          <dd>
            <time dateTime={printedAt.toISOString()}>
              {new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "long",
              }).format(printedAt)}
            </time>
          </dd>
        </div>
      </dl>

      {/* Auf dem Blatt dasselbe Bild wie am Schirm (KAN-83): die
          Kurzbeschreibung ist ein unbeschrifteter Vorspann und keine eigene
          Rubrik. Eine Zeile „Abstract" haette dort eine Gliederungsebene
          behauptet, die der Beitrag nicht fuehrt. */}
      {summary !== undefined && summary !== "" && (
        <p className="print-summary">{summary}</p>
      )}
    </header>
  )
}
