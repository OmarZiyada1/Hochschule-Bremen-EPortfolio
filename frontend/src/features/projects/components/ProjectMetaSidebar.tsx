import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { Tag } from "@/components/common/Tag"
import { fullNameOf } from "@/lib/name"

/**
 * Eine Zeile der Seitenleiste: Beschriftung und Wert.
 *
 * <p><strong>Was ohne Wert passiert, entscheidet der Verwender.</strong> Auf
 * der oeffentlichen Detailseite entfaellt die Zeile samt Beschriftung: dort
 * steht ein fertiger Beitrag, und eine Beschriftung ohne Wert waere eine
 * leere Behauptung. Im Editor bleibt sie mit einem Strich stehen
 * ({@code showEmpty}): dort wird noch geschrieben, und die vollstaendige
 * Liste zeigt auf einen Blick, was schon eingetragen ist und was nicht.
 * Die Reihenfolge steht damit fest und springt nicht, sobald ein Feld
 * gefuellt wird.
 *
 * <p><strong>Der Strich ist kein Pflichthinweis.</strong> Zum Einreichen
 * verlangt §3.3 sieben bestimmte Angaben; Modul, Projektmitglieder und Tags
 * gehoeren ausdruecklich nicht dazu und stehen hier trotzdem mit Strich.
 * Diese Liste ist eine Uebersicht ueber die Metadaten, keine Mangelliste;
 * welche Angabe das Einreichen blockiert, sagt das Metadatenformular
 * (KAN-35) und nicht diese Karte.
 *
 * <p>Der Strich ist ein Zeichen und keine Aussage: Screenreader lesen ihn je
 * nach Einstellung als „Bindestrich" oder gar nicht vor. Deshalb steht er
 * {@code aria-hidden} und daneben der Satz, den er meint (SC 1.3.1).
 */
function MetaRow({
  label,
  showEmpty = false,
  children,
}: {
  label: string
  /** Ob die Zeile ohne Wert stehenbleibt statt zu entfallen. */
  showEmpty?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  /*
   * false und "" kommen aus den Kurzschluessen der Aufrufer ("wert && …")
   * und heissen dasselbe wie null: kein Wert. Daran haengt ein
   * Verwendungsvertrag: ein Aufrufer reicht entweder einen Wert herein oder
   * einen dieser vier Ausdruecke fuer „keiner". Eine leere Liste
   * ({@code items.map(…)} ohne Eintraege) gaelte als Wert und stuende als
   * leere Zeile da; die Aufrufer unten fangen sie deshalb selbst ab
   * ({@code length > 0 && …}).
   */
  const hasValue =
    children !== null &&
    children !== undefined &&
    children !== false &&
    children !== ""

  if (!hasValue && !showEmpty) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      <dt className="type-body-sm text-muted-foreground">{label}</dt>
      <dd className="type-body font-semibold text-primary">
        {hasValue ? (
          children
        ) : (
          <span className="font-normal text-muted-foreground">
            <span aria-hidden="true">
              {t("project.detail.meta.emptyValue")}
            </span>
            <span className="sr-only">
              {t("project.detail.meta.emptyLabel")}
            </span>
          </span>
        )}
      </dd>
    </div>
  )
}

/**
 * Metadaten-Seitenleiste der Projektdetailseite (Figma "Projektdetail",
 * Knoten "Info"; KAN-32).
 *
 * <p>Reihenfolge wie im Template: Projekttyp, Fakultaet, Studiengang mit
 * Kuerzel, Abschluss, Semester, Kategorie, Fach/Modul, Veroeffentlicht,
 * danach die Beteiligten und die Schlagwoerter.
 *
 * <p><strong>Die Autor:in steht an erster Stelle der Projektmitglieder.</strong>
 * Der Contract trennt {@code author} (§3.3) und {@code members} (§3.13, mit
 * freier Funktionsbezeichnung); das Template fuehrt beide unter einer
 * Ueberschrift. Die Urheberin zuerst zu nennen, haelt die Reihenfolge
 * aussagekraeftig, ohne eine Rubrik zu erfinden (Klaerungsrunde zu KAN-32).
 *
 * <p><strong>Die Redaktion erscheint, wenn der Server sie mitliefert.</strong>
 * Bei einem veroeffentlichten Projekt ist das fuer alle der Fall (§3.3, seit
 * Contract v55), sonst nur fuer Beteiligte. Die Seite raet daran nichts
 * anhand der Rolle: {@code null} heisst „nicht sichtbar", eine leere Liste
 * dagegen „keine zugewiesen". Der Unterschied bleibt auch mit
 * {@code showEmptyFields} bestehen: eine leere Liste wird zur Strichzeile,
 * ein {@code null} entfaellt weiterhin ganz, denn ein Strich behauptete
 * „keine zugewiesen", wo in Wahrheit nur die Sicht fehlt.
 *
 * <p><strong>Veroeffentlicht bleibt immer bedingt.</strong> Das Datum ist
 * kein Metadatum, das jemand eintraegt, sondern ein Ergebnis des
 * Zustandsautomaten (§4.1); als Strichzeile im Entwurf sagte es nichts, was
 * der Status nicht schon sagt.
 */
export function ProjectMetaSidebar({
  project,
  showEmptyFields = false,
}: {
  project: ProjectDetailResponse
  /**
   * Ob Felder ohne Wert als Strichzeile stehenbleiben statt zu entfallen.
   *
   * <p>Standard ist die oeffentliche Lesart (entfallen). Der Editor setzt
   * es, weil dort die vollstaendige Feldliste zeigt, was zum Einreichen noch
   * fehlt.
   */
  showEmptyFields?: boolean
}) {
  const { t, i18n } = useTranslation()

  /* Nur Monat und Jahr, wie im Template ("10/2025"): der Tag der
     Veroeffentlichung ist fuer die Einordnung einer Arbeit ohne Belang. */
  const publishedFormat = new Intl.DateTimeFormat(i18n.language, {
    month: "2-digit",
    year: "numeric",
  })

  const author = project.author
    ? {
        firstName: project.author.firstName,
        lastName: project.author.lastName,
      }
    : null

  const members = project.members ?? []
  const editors = project.editors ?? []
  const tags = project.tags ?? []

  const hasPeople = author !== null || members.length > 0

  return (
    <dl className="flex flex-col gap-5">
      <MetaRow
        label={t("project.detail.meta.type")}
        showEmpty={showEmptyFields}
      >
        {project.projectType && t(`project.type.${project.projectType}`)}
      </MetaRow>

      <MetaRow
        label={t("project.detail.meta.faculty")}
        showEmpty={showEmptyFields}
      >
        {project.faculty?.name}
      </MetaRow>

      {/* Ohne Kuerzel: der volle Name steht hier bereits, das Kuerzel
          daneben wiederholt ihn nur in kurz und traegt allein keine
          Bedeutung (Vorgabe zur Abnahme von KAN-32). Auf der Kachel bleibt
          es, dort ist aus Platzgruenden nur das Kuerzel zu sehen. */}
      <MetaRow
        label={t("project.detail.meta.studyProgram")}
        showEmpty={showEmptyFields}
      >
        {project.studyProgram?.name}
      </MetaRow>

      <MetaRow
        label={t("project.detail.meta.degree")}
        showEmpty={showEmptyFields}
      >
        {project.degree && t(`project.degree.${project.degree}`)}
      </MetaRow>

      <MetaRow
        label={t("project.detail.meta.semester")}
        showEmpty={showEmptyFields}
      >
        {project.semester?.name}
      </MetaRow>

      <MetaRow
        label={t("project.detail.meta.category")}
        showEmpty={showEmptyFields}
      >
        {project.category?.name}
      </MetaRow>

      <MetaRow
        label={t("project.detail.meta.module")}
        showEmpty={showEmptyFields}
      >
        {project.module?.name}
      </MetaRow>

      {project.publishedAt && (
        <MetaRow label={t("project.detail.meta.published")}>
          <time dateTime={project.publishedAt}>
            {publishedFormat.format(new Date(project.publishedAt))}
          </time>
        </MetaRow>
      )}

      <MetaRow
        label={t("project.detail.meta.members")}
        showEmpty={showEmptyFields}
      >
        {hasPeople && (
          <ul className="flex flex-col gap-1">
            {/*
             * Die Autor:in steht nicht in members (§3.13.1), traegt aber
             * seit Contract v66 ihre eigene Funktionsbezeichnung (§3.3).
             * Sie steht vorn: der Beitrag gehoert ihr.
             */}
            {author && (
              <li>
                {fullNameOf(author)}
                {project.authorRole && (
                  <span className="type-body-sm font-normal text-muted-foreground">
                    {` · ${project.authorRole}`}
                  </span>
                )}
              </li>
            )}
            {members.map((member, index) => (
              <li key={member.userId ?? index}>
                {fullNameOf({
                  firstName: member.firstName,
                  lastName: member.lastName,
                })}
                {member.projectRole && (
                  <span className="type-body-sm font-normal text-muted-foreground">
                    {` · ${member.projectRole}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </MetaRow>

      {/* editors ist null, solange die Zuweisung nicht sichtbar ist; dann
          entfaellt die Zeile auch mit showEmptyFields (siehe Klassenkopf). */}
      {project.editors !== null && project.editors !== undefined && (
        <MetaRow
          label={t("project.detail.meta.editors")}
          showEmpty={showEmptyFields}
        >
          {editors.length > 0 && (
            <ul className="flex flex-col gap-1">
              {editors.map((editor, index) => (
                <li key={editor.id ?? index}>
                  {fullNameOf({
                    firstName: editor.firstName,
                    lastName: editor.lastName,
                  })}
                </li>
              ))}
            </ul>
          )}
        </MetaRow>
      )}

      <MetaRow
        label={t("project.detail.meta.tags")}
        showEmpty={showEmptyFields}
      >
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        )}
      </MetaRow>
    </dl>
  )
}
