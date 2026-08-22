import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { Tag } from "@/components/common/Tag"
import { fullNameOf } from "@/lib/name"

/**
 * Eine Zeile der Seitenleiste: Beschriftung und Wert. Der Wert entfaellt
 * samt Beschriftung, wenn er fehlt; im DRAFT sind die meisten Metadaten
 * noch nicht gesetzt (§3.3), und eine Beschriftung ohne Wert waere eine
 * leere Behauptung.
 */
function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="type-body-sm text-muted-foreground">{label}</dt>
      <dd className="type-body font-semibold text-primary">{children}</dd>
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
 * dagegen „keine zugewiesen", und beides fuehrt hier zu keiner Ausgabe.
 */
export function ProjectMetaSidebar({
  project,
}: {
  project: ProjectDetailResponse
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
      {project.projectType && (
        <MetaRow label={t("project.detail.meta.type")}>
          {t(`project.type.${project.projectType}`)}
        </MetaRow>
      )}

      {project.faculty?.name && (
        <MetaRow label={t("project.detail.meta.faculty")}>
          {project.faculty.name}
        </MetaRow>
      )}

      {/* Ohne Kuerzel: der volle Name steht hier bereits, das Kuerzel
          daneben wiederholt ihn nur in kurz und traegt allein keine
          Bedeutung (Vorgabe zur Abnahme von KAN-32). Auf der Kachel bleibt
          es, dort ist aus Platzgruenden nur das Kuerzel zu sehen. */}
      {project.studyProgram?.name && (
        <MetaRow label={t("project.detail.meta.studyProgram")}>
          {project.studyProgram.name}
        </MetaRow>
      )}

      {project.degree && (
        <MetaRow label={t("project.detail.meta.degree")}>
          {t(`project.degree.${project.degree}`)}
        </MetaRow>
      )}

      {project.semester?.name && (
        <MetaRow label={t("project.detail.meta.semester")}>
          {project.semester.name}
        </MetaRow>
      )}

      {project.category?.name && (
        <MetaRow label={t("project.detail.meta.category")}>
          {project.category.name}
        </MetaRow>
      )}

      {project.module?.name && (
        <MetaRow label={t("project.detail.meta.module")}>
          {project.module.name}
        </MetaRow>
      )}

      {project.publishedAt && (
        <MetaRow label={t("project.detail.meta.published")}>
          <time dateTime={project.publishedAt}>
            {publishedFormat.format(new Date(project.publishedAt))}
          </time>
        </MetaRow>
      )}

      {hasPeople && (
        <MetaRow label={t("project.detail.meta.members")}>
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
        </MetaRow>
      )}

      {editors.length > 0 && (
        <MetaRow label={t("project.detail.meta.editors")}>
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
        </MetaRow>
      )}

      {tags.length > 0 && (
        <MetaRow label={t("project.detail.meta.tags")}>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        </MetaRow>
      )}
    </dl>
  )
}
