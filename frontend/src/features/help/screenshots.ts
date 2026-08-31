import adminDashboard from "@/assets/help/admin-dashboard.jpg"
import adminProjects from "@/assets/help/admin-projects.jpg"
import adminSiteContent from "@/assets/help/admin-site-content.jpg"
import adminStudyStructure from "@/assets/help/admin-study-structure.jpg"
import adminSupport from "@/assets/help/admin-support.jpg"
import adminTop10 from "@/assets/help/admin-top10.jpg"
import adminUsers from "@/assets/help/admin-users.jpg"
import editor from "@/assets/help/editor.jpg"
import editorInsert from "@/assets/help/editor-insert.jpg"
import editorSidebar from "@/assets/help/editor-sidebar.jpg"
import editorToolbar from "@/assets/help/editor-toolbar.jpg"
import myPortfolio from "@/assets/help/my-portfolio.jpg"
import navigation from "@/assets/help/navigation.jpg"
import projectDetail from "@/assets/help/project-detail.jpg"
import projectList from "@/assets/help/project-list.jpg"
import projectMetadata from "@/assets/help/project-metadata.jpg"
import publicPortfolio from "@/assets/help/public-portfolio.jpg"
import register from "@/assets/help/register.jpg"
import reviewComments from "@/assets/help/review-comments.jpg"
import reviewDetail from "@/assets/help/review-detail.jpg"
import reviewList from "@/assets/help/review-list.jpg"
import reviewStatusMenu from "@/assets/help/review-status-menu.jpg"
import support from "@/assets/help/support.jpg"
import top10 from "@/assets/help/top10.jpg"

import sizes from "@/assets/help/sizes.json"

/**
 * Die Bildschirmfotos der Hilfeseite (KAN-93).
 *
 * <p><strong>Sie werden nicht von Hand geschossen.</strong> Jedes Bild
 * entsteht im Lauf {@code pnpm screenshots} aus der laufenden Anwendung, mit
 * fest hinterlegter Rolle, Route und Fenstergroesse
 * ({@code e2e/screenshots.spec.ts}). Aendert sich eine Ansicht, wird der Satz
 * neu erzeugt statt nachgestellt; ein von Hand ersetztes Bild hier waere
 * beim naechsten Lauf wieder weg.
 *
 * <p><strong>Ein Satz, nicht vier.</strong> Ausgeliefert ist heller Modus mit
 * englischer Oberflaeche. Im dunklen Modus steht damit ein helles Bild auf
 * dunklem Grund; das ist eine bewusste Entscheidung der Klaerungsrunde und
 * kein Fehler. Die uebrigen Kombinationen erzeugt derselbe Lauf ueber
 * {@code SHOT_THEME} und {@code SHOT_LANG}.
 *
 * <p><strong>Import statt Pfad.</strong> Ein {@code public/}-Verzeichnis gibt
 * es in diesem Frontend nicht; statische Bilder laufen wie
 * {@code clap-filled.png} ueber den {@code @/}-Alias und bekommen von Vite
 * ihren Hash. Ein Schluessel ohne Datei faellt damit beim Bauen auf und nicht
 * erst als leeres Bild im Browser.
 *
 * <p><strong>Die Masse kommen aus derselben Aufnahme</strong>
 * ({@code assets/help/sizes.json}, ebenfalls vom Lauf erzeugt). Sie stehen am
 * {@code img} als Seitenverhaeltnis und verhindern, dass das Akkordeon beim
 * Oeffnen auf die falsche Hoehe springt; die Anzeigegroesse macht weiterhin
 * das Stylesheet. Von Hand gepflegte Zahlen waeren beim naechsten Lauf falsch.
 *
 * <p>Die Alternativtexte stehen nicht hier, sondern in i18n
 * (Frontend-Regel 7): sie sind Oberflaechentext und in beiden Sprachen
 * gepflegt.
 */
const SOURCES = {
  projectList,
  projectDetail,
  top10,
  publicPortfolio,
  register,
  navigation,
  support,
  myPortfolio,
  projectMetadata,
  editor,
  editorToolbar,
  editorInsert,
  editorSidebar,
  reviewList,
  reviewDetail,
  reviewStatusMenu,
  reviewComments,
  adminDashboard,
  adminProjects,
  adminUsers,
  adminStudyStructure,
  adminTop10,
  adminSupport,
  adminSiteContent,
} as const

/** Der Schluessel eines Bildes; erlaubt nur, was es wirklich gibt. */
export type HelpScreenshotKey = keyof typeof SOURCES

export interface HelpScreenshot {
  src: string
  width: number
  height: number
}

/*
 * Die Masse liegen als JSON neben den Dateien und werden hier zugeordnet.
 * Fehlt ein Eintrag, faellt das Bild auf die Masse des Sichtfelds zurueck:
 * das ist die Groesse fast aller Aufnahmen, und ein fehlender Eintrag soll
 * die Seite nicht zerreissen, sondern nur ungenau messen lassen.
 */
const FALLBACK = { width: 2560, height: 1600 }

const measured = sizes as Record<string, { width: number; height: number }>

export const helpScreenshots = Object.fromEntries(
  Object.entries(SOURCES).map(([key, src]) => [
    key,
    { src, ...(measured[key] ?? FALLBACK) },
  ])
) as Record<HelpScreenshotKey, HelpScreenshot>
