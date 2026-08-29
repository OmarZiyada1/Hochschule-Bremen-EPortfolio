import {
  CalendarIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  TagsIcon,
  TrophyIcon,
  TypeIcon,
  UsersIcon,
} from "lucide-react"
import type { ComponentType } from "react"

/**
 * Die Eintraege der Seitennavigation, in der Reihenfolge der Figma-Komponente
 * {@code Sidebar} (KAN-38).
 *
 * <p><strong>Der neunte Eintrag haengt hinten an, und das ist eine
 * Entscheidung.</strong> „Startseitentexte" hat als einziger Bereich keinen
 * Frame in der Figma-Komponente {@code Sidebar}: die redaktionelle Pflege der
 * Startseite (§2.16, §3.21) ist nach dem Entwurf entstanden. Es gibt deshalb
 * keine entworfene Position fuer ihn, und jede Einordnung mittendrin waere
 * eine erfundene: sie verschoebe die acht bestehenden Eintraege gegen den
 * Frame, aus dem ihre Reihenfolge stammt. Angehaengt bleibt sie unberuehrt,
 * und die Abweichung steht an genau einer Stelle, naemlich am Ende.
 *
 * <p><strong>Acht seit KAN-85.</strong> „Support" steht als letzter der
 * entworfenen Eintraege hinter „Studienstruktur", wie im Frame
 * {@code Admin · Support}. Es ist der
 * einzige Bereich der Administrationsseite, dessen Inhalt von aussen entsteht:
 * die Zeilen legt das oeffentliche Kontaktformular an (§6.1).
 *
 * <p><strong>Sieben, nicht sechs.</strong> Der Eintrag „Semester" ist am
 * 17.08.2026 zwischen „Kategorien" und „Studienstruktur" dazugekommen
 * (Confluence „Template-Abdeckung"), zusammen mit den Screens
 * {@code Template / Admin · Semester}. Die Ticketbeschreibung nannte bis dahin
 * sechs; entschieden ist der Frame (Klaerungsrunde zu KAN-38). Auch die
 * Reihenfolge stammt von dort und nicht aus dem Ticket: Top 10 steht an
 * dritter Stelle und nicht am Ende.
 *
 * <p><strong>Das Aenderungsprotokoll bekommt keinen achten Eintrag.</strong>
 * {@code /administration/top10/audit} zeigt den Verlauf der Kuratierung und
 * wird aus der Top-10-Verwaltung heraus geoeffnet (KAN-40).
 *
 * <p>Die Liste steht hier und nicht im Layout, damit sie ohne Rendern pruefbar
 * ist (Skill frontend-modul, Abschnitt 3). Die Beschriftungen sind
 * i18n-Schluessel; uebersetzt wird erst in der Darstellung.
 */
export interface AdminNavEntry {
  /** Routenziel aus dem Routenbaum (KAN-7). */
  to: string
  /** Schluessel unter administration.nav.* in de.json und en.json. */
  labelKey: string
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
  /**
   * Welcher Zaehler rechts im Eintrag steht, oder {@code undefined} fuer
   * keinen.
   *
   * <p><strong>Ein Schluessel und keine Zahl.</strong> Diese Liste ist eine
   * reine Beschreibung und laedt nichts; welche Abfrage hinter einem
   * Schluessel steckt, entscheidet der Rahmen. Ohne das muesste entweder die
   * Liste zu einem Hook werden oder das Layout die Zuordnung ueber einen
   * Pfadvergleich raten, und dann stuende der fachliche Zusammenhang
   * nirgends geschrieben.
   */
  badge?: "openSupportRequests"
}

export const ADMIN_NAV: readonly AdminNavEntry[] = [
  {
    to: "/administration",
    labelKey: "administration.nav.dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    to: "/administration/projects",
    labelKey: "administration.nav.projects",
    icon: FolderKanbanIcon,
  },
  {
    to: "/administration/top10",
    labelKey: "administration.nav.top10",
    icon: TrophyIcon,
  },
  {
    to: "/administration/users",
    labelKey: "administration.nav.users",
    icon: UsersIcon,
  },
  {
    to: "/administration/categories",
    labelKey: "administration.nav.categories",
    icon: TagsIcon,
  },
  {
    to: "/administration/semesters",
    labelKey: "administration.nav.semesters",
    icon: CalendarIcon,
  },
  {
    to: "/administration/study-structure",
    labelKey: "administration.nav.studyStructure",
    icon: GraduationCapIcon,
  },
  {
    to: "/administration/support",
    labelKey: "administration.nav.support",
    icon: LifeBuoyIcon,
    /* Support ist der einzige Bereich, dessen Inhalt von aussen entsteht: die
       Zeilen legt das oeffentliche Kontaktformular an (§6.1). Wer die
       Administrationsseite betritt, soll ohne Klick sehen, ob etwas wartet. */
    badge: "openSupportRequests",
  },
  {
    /* Ohne Frame in der Komponente Sidebar und deshalb am Ende, damit die
       entworfene Reihenfolge der acht darueber unberuehrt bleibt. Das „T"
       steht fuer den Bereich, in dem ausschliesslich Text gepflegt wird
       (§2.16). */
    to: "/administration/site-content",
    labelKey: "administration.nav.siteContent",
    icon: TypeIcon,
  },
]

/**
 * Ist dieser Eintrag der aktuelle? Reine Funktion, damit die Faelle ohne
 * Rendern pruefbar sind.
 *
 * <p><strong>Die Startansicht braucht einen exakten Vergleich.</strong> Ihr
 * Pfad {@code /administration} ist Praefix jedes anderen Eintrags; mit einem
 * blossen {@code startsWith} waere sie auf allen Admin-Seiten zugleich
 * markiert. Die uebrigen vergleichen mit Praefix, damit eine Unterseite ihren
 * Eintrag markiert haelt: {@code /administration/top10/audit} gehoert zur
 * Top-10-Verwaltung, auch wenn es eine eigene Route ist.
 */
export function isAdminNavActive(entry: AdminNavEntry, pathname: string) {
  if (entry.to === "/administration") {
    return pathname === "/administration" || pathname === "/administration/"
  }
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`)
}
