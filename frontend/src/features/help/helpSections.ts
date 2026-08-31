import type { Role } from "@/api/types"

import type { HelpScreenshotKey } from "./screenshots"

/**
 * Aufbau und Sichtbarkeit der Hilfeseite (KAN-93).
 *
 * <p><strong>Die Gliederung steht hier und nicht in der Seite</strong>, damit
 * sie ohne Rendern pruefbar ist (Skill frontend-modul, Abschnitt 3). Die
 * Seite komponiert nur; welche Bereiche eine Zugriffsebene sieht, entscheidet
 * {@link helpSectionsFor}.
 *
 * <p><strong>Die Sichtbarkeit ist Bequemlichkeit, keine Sicherheitsmassnahme</strong>
 * (Contract §5). Diese Seite zeigt ohnehin keine Serverdaten, sondern
 * uebersetzten Text und Bildschirmfotos; wer den Quelltext liest, sieht auch
 * die Abschnitte der anderen Ebenen. Verborgen werden sie, weil eine
 * Anleitung fuer Rechte, die man nicht hat, verwirrt, nicht weil sie geheim
 * waere.
 */

/**
 * Die Zugriffsebene, ab der ein Bereich erscheint.
 *
 * <p>Bewusst kein {@code Role[]} je Bereich: die vier Ebenen bauen
 * aufeinander auf, und eine Liste je Bereich muesste diese Ordnung an vier
 * Stellen wiederholen. {@code ADMIN} ist seit KAN-82 die Obermenge von
 * STUDENT und EDITOR (§2.1); wer verwaltet, arbeitet auch redaktionell und
 * fuehrt ein eigenes Portfolio.
 */
export type HelpLevel =
  /** Jede Person, auch nicht angemeldet. PUBLIC ist keine Rolle (§2.1). */
  | "public"
  /** Jedes angemeldete Konto, unabhaengig von der Rolle. */
  | "authenticated"
  /** Rolle EDITOR oder ADMIN. */
  | "editorial"
  /** Rolle ADMIN. */
  | "admin"

/** Ein aufklappbarer Punkt innerhalb eines Bereichs. */
export interface HelpTopic {
  /** Schluesselbestandteil: {@code help.<section>.topics.<key>.*}. */
  key: string
  /**
   * Das erklaerende Bild, oder {@code undefined}.
   *
   * <p>Ohne Bild bleiben die Punkte, die keine Ansicht beschreiben, sondern
   * eine Regel: der Zustandsablauf eines Projekts, das Vier-Augen-Prinzip,
   * der Weg einer Nominierung. Ein Bildschirmfoto zeigt davon einen
   * Ausschnitt und behauptet damit mehr, als es zeigt; die Aufzaehlung
   * daneben sagt es vollstaendig.
   */
  shot?: HelpScreenshotKey
}

/** Ein Bereich der Seite: eine Ueberschrift der Ebene 2 mit einem Akkordeon. */
export interface HelpSection {
  /** Schluesselbestandteil {@code help.<key>.*} und Sprungziel {@code help-<key>}. */
  key: string
  level: HelpLevel
  topics: readonly HelpTopic[]
}

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    key: "visitors",
    level: "public",
    topics: [
      { key: "browse", shot: "projectList" },
      { key: "projectPage", shot: "projectDetail" },
      { key: "top10", shot: "top10" },
      { key: "portfolio", shot: "publicPortfolio" },
      { key: "account", shot: "register" },
      { key: "appearance", shot: "navigation" },
      { key: "contact", shot: "support" },
    ],
  },
  {
    key: "students",
    level: "authenticated",
    topics: [
      { key: "myPortfolio", shot: "myPortfolio" },
      { key: "metadata", shot: "projectMetadata" },
      { key: "workspace", shot: "editor" },
      { key: "blocks", shot: "editorInsert" },
      { key: "formatting", shot: "editorToolbar" },
      { key: "sidebar", shot: "editorSidebar" },
      { key: "workflow" },
    ],
  },
  {
    key: "editors",
    level: "editorial",
    topics: [
      { key: "list", shot: "reviewList" },
      { key: "open", shot: "reviewDetail" },
      { key: "comments", shot: "reviewComments" },
      { key: "decide", shot: "reviewStatusMenu" },
      { key: "fourEyes" },
      { key: "nominate" },
    ],
  },
  {
    key: "admins",
    level: "admin",
    topics: [
      { key: "dashboard", shot: "adminDashboard" },
      { key: "projects", shot: "adminProjects" },
      { key: "users", shot: "adminUsers" },
      { key: "masterData", shot: "adminStudyStructure" },
      { key: "top10", shot: "adminTop10" },
      { key: "support", shot: "adminSupport" },
      { key: "siteContent", shot: "adminSiteContent" },
    ],
  },
]

/**
 * Welche Ebenen eine Rolle einschliesst, von aussen nach innen.
 *
 * <p>{@code null} heisst „nicht angemeldet" und ist kein vierter Enum-Wert:
 * die Rechtematrix kennt PUBLIC, STUDENT, EDITOR und ADMIN, gespeichert sind
 * davon nur die letzten drei (§2.1).
 */
const LEVELS_BY_ROLE: Record<"public" | Role, readonly HelpLevel[]> = {
  public: ["public"],
  STUDENT: ["public", "authenticated"],
  EDITOR: ["public", "authenticated", "editorial"],
  ADMIN: ["public", "authenticated", "editorial", "admin"],
}

/** Die Bereiche, die diese Zugriffsebene sieht, in der Reihenfolge der Seite. */
export function helpSectionsFor(role: Role | null): readonly HelpSection[] {
  const levels = LEVELS_BY_ROLE[role ?? "public"]
  return HELP_SECTIONS.filter((section) => levels.includes(section.level))
}
