import {
  FileQuestionIcon,
  FileTextIcon,
  InfoIcon,
  LockIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { BreadcrumbBar } from "@/components/common/BreadcrumbBar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewModeSwitch } from "@/features/project-content/components/ViewModeSwitch"
import { useProjectImageUrls } from "@/features/project-content/hooks/useProjectImageUrls"
import { useFileUrl } from "@/api/useFileUrl"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"
import { ReactionPanel } from "@/features/projects/components/ReactionPanel"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Detailansicht eines Projekts nach Template „Projektdetail (Oeffentlich)"
 * (Ticket KAN-32): Kopf mit Titelbild und Abstract, der Blockinhalt, die
 * Reaktionen und die Metadaten-Seitenleiste.
 *
 * <p>Sie ist die Seite, auf die Startseite, Bibliothek und Portfolio
 * verweisen, und die einzige Ansicht des Projektinhalts, die ohne Anmeldung
 * erreichbar ist. Was jemand sehen darf, entscheidet allein der Server (§5):
 * ein Projekt in einem anderen Status als PUBLISHED ist fuer PUBLIC nicht
 * sichtbar, und die engere Schranke gilt auch angemeldet (§5 Fussnote 11).
 *
 * <p><strong>Der Inhalt laeuft ausschliesslich ueber ProjectContent</strong>
 * aus KAN-10, einen eigenen JSON-Renderer ohne Tiptap im Lesepfad. Diese
 * Seite uebersetzt nichts selbst, setzt die Klasse {@code .project-content}
 * nicht und ueberschreibt {@code resolveFileUrl} nicht: der Standard aus
 * {@code apiPaths} genuegt, weil eine Datei oeffentlich abrufbar ist, sobald
 * ihr Projekt PUBLISHED ist (§3.15). Nur die Vorschau eines Entwurfs
 * braucht eine eigene Aufloesung, und die liegt in KAN-36.
 *
 * <p><strong>Genau eine h1</strong>, der Projekttitel. Der Renderer gibt nie
 * eine h1 aus, Blockueberschriften stehen auf Ebene 2 und 3 (§2.5); ohne
 * diese Wurzel begaenne die Gliederung bei h2 (SC 1.3.1).
 *
 * <p><strong>Die Statusanzeige haengt an statusHistory.</strong>
 * Seit Contract v55 liefert der Server {@code editors} bei einem
 * veroeffentlichten Projekt an alle aus (§3.3), {@code statusHistory}
 * dagegen weiterhin nur an die Projektseite, die zugewiesene Redaktion und
 * Admins (§3.12). Damit ist dieses eine Feld das verlaessliche Kennzeichen
 * der Beteiligten: steht es, ist die lesende Person beteiligt und sieht
 * den Badge. Die Seite raet nichts anhand der Rolle, wie sie es auch bei den
 * uebrigen Feldern nicht tut. Den Aktivitaetsverlauf zeigt sie nicht: er
 * gehoert in den Editor (KAN-36), nicht in die Leseansicht.
 *
 * <p>Der Platz fuer die Aktion „PDF" bleibt frei, bis KAN-41 sie liefert.
 * Ein dauerhaft gesperrter Knopf ist fuer die Tastatur ein Ziel ohne Zweck
 * (Frontend-Regel 10).
 */
/* Eine Liste, nicht bei jedem Rendern eine neue: sie steht in den
   Abhaengigkeiten der Bildaufloesung. */
const EMPTY_BLOCKS: readonly BlockResponse[] = []

export default function ProjectDetailPage() {
  const { t } = useTranslation()
  const { projectId } = useParams()
  const { data, isPending, error } = useProjectDetail(projectId ?? "")

  /*
   * Bilder eines noch nicht veroeffentlichten Beitrags brauchen den
   * angemeldeten Weg; ohne ihn beantwortet der Server jede Bildanfrage
   * dieser Seite mit 401, und die Vorschau eines Entwurfs zeigt leere
   * Stellen statt der Bilder (Begruendung an useProjectImageUrls).
   * Bei PUBLISHED bleibt es beim blossen Pfad: dort ist die Datei
   * oeffentlich und obendrein zwischenspeicherbar (§3.15).
   */
  const needsToken = data !== undefined && data.status !== "PUBLISHED"
  const resolveFileUrl = useProjectImageUrls(
    data?.blocks ?? EMPTY_BLOCKS,
    needsToken
  )
  /* Dasselbe gilt fuer das Titelbild: nach dem Einreichen ist das Projekt
     SUBMITTED und die Datei damit nicht mehr oeffentlich; ohne den
     angemeldeten Weg verschwand das Bild an dieser Stelle. */
  const cover = useFileUrl(data?.coverImageUrl, needsToken)

  /* Nur schmal gebraucht: ab lg steht das Panel dauerhaft daneben, und die
     Schublade wird dann gar nicht erst geoeffnet. */
  const [infoOpen, setInfoOpen] = useState(false)

  /*
   * 403 bleibt hier, 401 nicht: den Weg zur Anmeldung geht der QueryClient
   * schon zentral (reactToSessionError aus KAN-30 merkt sich die Route und
   * leitet nach /login um). Ein eigener 401-Zustand auf dieser Seite waere
   * nie sichtbar, also tote Oberflaeche (Frontend-Regel 10). Fuer 403 gibt es
   * die zentrale Behandlung nicht, und sie waere auch falsch: wer angemeldet
   * ist und trotzdem nicht darf, kommt durch erneutes Anmelden nicht weiter.
   */
  const forbidden =
    error !== null && isApiError(error) && error.errorCode === "NO_PERMISSION"
  const notFound =
    error !== null &&
    isApiError(error) &&
    error.errorCode === "PROJECT_NOT_FOUND"

  /*
   * Null heisst „darf ich nicht sehen", eine leere Liste „es gibt keine"
   * (§3.12). Nur im ersten Fall entfaellt die Handlung ganz.
   *
   * <p><strong>Geprueft wird auf null, nicht auf undefined.</strong> Der
   * Server laesst das Feld nicht weg, sondern schickt es ausdruecklich als
   * {@code "statusHistory": null} (Jackson steht auf Include.ALWAYS). Eine
   * Pruefung auf undefined waere fuer jede unbeteiligte Person wahr, also im
   * Regelfall dieser Seite, und reichte {@code null} an den Dialog weiter.
   *
   * <p>Seit KAN-74 steht der Unterschied auch im Typ: {@code statusHistory}
   * ist {@code StatusHistoryResponse[] | null}, weil das Dokument unter
   * {@code /v3/api-docs} als OpenAPI 3.0 ausgeliefert wird und
   * {@code nullable} dort ein Schluesselwort ist. Bis dahin trug diese
   * Pruefung die Last allein, ohne dass der Typecheck sie haette
   * nachhalten koennen.
   */
  const statusHistory = data?.statusHistory ?? null
  const participates = statusHistory !== null

  return (
    <>
      {/* Die Ebene "Projekte" ersetzt den fruheren Knopf "Zurueck zu
          Projekte": ohne ihn braucht die Seite trotzdem einen Weg zurueck
          in die Liste, und im Pfad steht er ohnehin. */}
      <BreadcrumbBar
        items={[
          { label: t("common.nav.home"), to: "/" },
          { label: t("common.nav.projects"), to: "/projects" },
          { label: data?.title ?? t("project.detail.breadcrumb") },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {/*
         * 404 PROJECT_NOT_FOUND bleibt auf dieser Route stehen, statt auf die
         * Auffangroute zu springen: die Adresse zeigt weiter, welcher Aufruf
         * ins Leere ging, und Breadcrumb wie Zurueck-Knopf bleiben erreichbar.
         * Bewusst nicht NotFoundPage: die liegt ausserhalb der Layout-Route und
         * bringt eigenes main und eigene Fusszeile mit (ihr Template fuehrt
         * keine NavBar). Hier eingesetzt ergaebe sie zwei main-Landmarken und
         * zwei Fusszeilen im Anwendungsrahmen.
         */}
        {notFound && (
          <EmptyState
            headingLevel={1}
            icon={<FileQuestionIcon aria-hidden="true" />}
            title={t("project.detail.notFound.title")}
            description={t("project.detail.notFound.description")}
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/projects" />}
              >
                {t("project.detail.notFound.action")}
              </Button>
            }
          />
        )}

        {forbidden && (
          <EmptyState
            headingLevel={1}
            icon={<LockIcon aria-hidden="true" />}
            title={t("project.detail.forbidden.title")}
            description={t("project.detail.forbidden.description")}
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/projects" />}
              >
                {t("project.detail.forbidden.action")}
              </Button>
            }
          />
        )}

        {/* Der Rueckfall fuer alles Uebrige. Er traegt die h1 selbst, sonst
          stuende die Seite in diesem Zustand ganz ohne Ueberschrift da, waehrend
          die beiden benannten Faelle darueber je eine setzen (SC 1.3.1). */}
        {error !== null && !forbidden && !notFound && (
          <>
            <h1 className="type-h2">{t("project.detail.error.title")}</h1>
            <Alert variant="destructive">
              <AlertTitle>
                {isApiError(error)
                  ? t(apiErrorMessageKey(error), {
                      defaultValue: error.message,
                    })
                  : t("apiError.INTERNAL_ERROR")}
              </AlertTitle>
            </Alert>
          </>
        )}

        {isPending && (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start lg:gap-12">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-110 w-full rounded-xl" />
              <Skeleton className="h-12 w-3/4 rounded-control" />
              <Skeleton className="h-32 w-full rounded-control" />
            </div>
            <Skeleton className="h-160 rounded-xl" />
          </div>
        )}

        {data !== undefined && (
          /* Der Rahmen ist max-w-6xl wie bei NavBar, Footer, Bibliothek und
           Portfolio: eine Karte, die breiter steht als die Kopfleiste darueber,
           faellt sofort auf. Figma zeichnet 1280 auf einem 1440er Rahmen, die
           Anwendung hat sich aber global auf 1152 festgelegt; das Innenmass
           folgt dem Template (40 Polster, 48 Spaltenabstand, 340 Seitenleiste),
           die Hauptspalte ergibt sich daraus. */
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start lg:gap-12">
            <Card className="relative min-w-0 [--card-spacing:--spacing(10)]">
              {/* Titelbild nur, wenn eines hinterlegt ist (Klaerungsrunde zu
                KAN-32). Ohne Bild entfaellt die Flaeche ersatzlos und der
                Titel rueckt nach oben, statt dass eine grosse leere Flaeche
                stehen bleibt; die Kachel in den Listen haelt dagegen ihren
                Platzhalter, weil dort alle Kacheln gleich hoch sein muessen.
                Das Bild ist Beiwerk zum Titel daneben und traegt deshalb
                alt="" (SC 1.1.1).

                Es steht als erstes Kind der Karte und laeuft damit bis an
                deren Kante, wie es die Vorlage zeigt: die Primitive rundet
                ein erstes img oben mit und nimmt dafuer das obere Polster
                zurueck. In einen Rahmen gesetzt bliebe stattdessen ein
                Polsterrand um das Bild stehen. */}
              {cover.url !== null && (
                <>
                  <img
                    src={cover.url}
                    alt=""
                    className="h-60 w-full object-cover sm:h-110"
                  />
                  {/* Auf dem Titelbild oben links. Der
                    Knopf steht absolut in der Karte und nicht in einem
                    Rahmen um das Bild: ein Rahmen naehme dem Bild die
                    randlose Ausrichtung, die an "erstes Kind" haengt. */}
                  <InfoTrigger onOpen={() => setInfoOpen(true)} floating />
                </>
              )}
              <CardContent>
                <article className="flex min-w-0 flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="type-overline tracking-widest text-muted-foreground uppercase">
                        {t("project.list.label")}
                      </p>
                      {/* Nur fuer Beteiligte: oeffentlich ist ohnehin alles
                      PUBLISHED, dort unterschiede der Badge nichts. Wer einen
                      Entwurf oder eine Einreichung oeffnet, sieht dagegen
                      sofort, dass er keine veroeffentlichte Fassung liest
                      (Klaerungsrunde zu KAN-32). */}
                      {participates && data.status && (
                        <StatusBadge status={data.status} />
                      )}
                      {/* Ohne sichtbares Titelbild fehlt die Flaeche fuer den
                        schwebenden Knopf; dann steht er in dieser Zeile. Das
                        gilt auch, solange das Bild eines Entwurfs noch
                        geladen wird: sonst gaebe es kurz keinen Weg zu den
                        Projektdaten. */}
                      {cover.url === null && (
                        <InfoTrigger onOpen={() => setInfoOpen(true)} />
                      )}
                    </div>

                    <h1 className="type-title min-w-0 text-primary">
                      {data.title}
                    </h1>
                  </div>

                  <hr />

                  {data.summary && (
                    <section className="flex flex-col gap-3">
                      <h2 className="type-h2">
                        {t("project.detail.abstract")}
                      </h2>
                      <p className="type-body-lg text-foreground">
                        {data.summary}
                      </p>
                    </section>
                  )}

                  {/* Redaktionshinweis nach dem Template. Er nennt Studiengang und
                  Semester und, sobald der Server die Redaktion mitliefert,
                  auch sie (§3.3, seit Contract v55). Fehlt eine der Angaben,
                  entfaellt der jeweilige Satzteil, statt eine Luecke zu
                  behaupten; ohne jede Angabe entfaellt der Hinweis ganz. */}
                  <EditorialNote project={data} />

                  <section className="flex flex-col gap-3">
                    <h2 className="type-h2">{t("project.detail.content")}</h2>
                    {/* Ein frischer DRAFT hat keine Bloecke (§3.3). Beteiligte
                    sehen solche Projekte hier, und eine Ueberschrift ueber
                    nichts ist eine leere Flaeche, kein Zustand. */}
                    {(data.blocks ?? []).length === 0 ? (
                      <EmptyState
                        headingLevel={3}
                        icon={<FileTextIcon aria-hidden="true" />}
                        title={t("project.detail.empty.title")}
                        description={t("project.detail.empty.description")}
                      />
                    ) : (
                      /* Der Renderer setzt .project-content selbst und bringt seine
                     Stilquelle mit (styles/project-content.css). Eine zweite
                     entsteht hier nicht. */
                      <ProjectContent
                        blocks={data.blocks ?? EMPTY_BLOCKS}
                        resolveFileUrl={resolveFileUrl}
                      />
                    )}
                  </section>
                </article>
              </CardContent>
            </Card>

            {/* Eigene Karte, nicht dieselbe Flaeche wie der Inhalt: Metadaten
              und Projekttext sind zwei Gegenstaende und stehen deshalb in
              zwei Panels nebeneinander.

              Mitlaufend ab lg: der Projekttext ist um ein Vielfaches laenger
              als die Daten, und wer weit unten liest, soll Semester oder
              Betreuung nicht durch Zurueckscrollen suchen muessen. Moeglich
              ist das erst, seit die Daten eine eigene Karte haben: in der
              gemeinsamen Karte war deren overflow-hidden der Scroll-Container
              und machte sticky wirkungslos. items-start am Raster ist die
              zweite Bedingung, sonst fuellte die Karte die Zeilenhoehe und
              haette keinen Weg zu kleben. Der Abstand nach oben entspricht
              dem py-8 der Seite; die Kopfleiste scrollt mit und braucht
              keinen Platz.

              Ohne eigene Hoehenbegrenzung und ohne inneren Scrollbereich:
              die Karte steht am Stueck. Ein Panel, das laenger ist als das
              Fenster, schiebt seine letzten Zeilen dann aus dem Bild, bis
              die Seite weit genug gescrollt ist.

              Schmal ist die Karte ausgeblendet; denselben Inhalt zeigt dort
              die Schublade. */}
            <Card className="hidden [--card-spacing:--spacing(10)] lg:sticky lg:top-8 lg:block">
              <CardContent>
                <aside
                  aria-label={t("project.detail.meta.label")}
                  className="flex flex-col gap-6"
                >
                  <ProjectInfoPanel project={data} />
                </aside>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Die Schublade traegt denselben Baustein wie die Karte, keine
            zweite Fassung davon. Geschlossen rendert sie nichts, es stehen
            also nie zwei Reaktionsknoepfe im Dokument.

            Von links, von derselben Seite, an der ihr Knopf auf dem
            Titelbild sitzt: eine Flaeche, die dort aufgeht, wo man sie
            angetippt hat, folgt der Hand. */}
        {data !== undefined && (
          <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
            <SheetContent side="left" className="overflow-y-auto lg:hidden">
              <SheetHeader>
                <SheetTitle>{t("project.detail.meta.label")}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-8">
                <ProjectInfoPanel project={data} />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </>
  )
}

/**
 * Reaktionen und Projektdaten, der Inhalt des rechten Panels.
 *
 * <p>Ein eigener Baustein, weil ihn zwei Stellen zeigen: die mitlaufende
 * Karte ab lg und die Schublade darunter. Zwei Abschriften desselben
 * Aufbaus liefen auseinander, sobald eine Zeile dazukommt.
 */
function ProjectInfoPanel({ project }: { project: ProjectDetailResponse }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  /*
   * Der Weg zurueck in den Editor, die zweite Haelfte des Umschalters aus
   * KAN-36. Er erscheint nur, wenn diese Seite fuer die anfragende Person
   * wirklich eine Vorschau ist: im Arbeitszustand des Projekts (§4.1) und
   * fuer die Autor:in oder ein Projektmitglied (§5). Fuer alle anderen ist
   * sie die Seite selbst, und ein Schalter „Bearbeiten" waere ein Weg, der
   * mit 403 endet.
   *
   * Verbindlich bleibt der Server; diese Bedingung entscheidet nur, ob der
   * Schalter sichtbar ist.
   */
  const editable = project.status === "DRAFT" || project.status === "REVISION"
  const participates =
    user !== null &&
    (project.author?.id === user.id ||
      (project.members ?? []).some((member) => member.userId === user.id))

  return (
    <div className="flex flex-col gap-6">
      {editable && participates && (
        <ViewModeSwitch
          mode="preview"
          onModeChange={(mode) => {
            if (mode === "edit") {
              void navigate(`/projects/${project.id}/editor`)
            }
          }}
        />
      )}
      {project.id !== undefined && (
        <>
          <ReactionPanel
            projectId={project.id}
            reactionCount={project.reactionCount}
            status={project.status}
          />
          <hr />
        </>
      )}
      <ProjectMetaSidebar project={project} />
    </div>
  )
}

/**
 * Der Knopf, der schmal die Projektdaten aufzieht.
 *
 * <p>Ab lg ausgeblendet: dort steht das Panel ohnehin daneben, und ein
 * Knopf, der dasselbe noch einmal oeffnet, waere ein Ziel ohne Zweck.
 * {@code floating} legt ihn auf das Titelbild; er traegt dort eine gedeckte
 * Flaeche, damit er auf jedem Foto sichtbar bleibt (SC 1.4.11), und ist mit
 * 2rem groesser als das Mindestmass aus SC 2.5.8.
 */
function InfoTrigger({
  onOpen,
  floating = false,
}: {
  onOpen: () => void
  floating?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={onOpen}
      aria-label={t("project.detail.meta.open")}
      className={cn(
        "lg:hidden",
        floating ? "absolute top-4 left-4 z-10 shadow-md" : "ml-auto"
      )}
    >
      <InfoIcon aria-hidden="true" />
    </Button>
  )
}

/**
 * Der Redaktionshinweis unter dem Abstract (Figma-Knoten "Quote").
 *
 * <p>Er entsteht aus drei Angaben, von denen jede fehlen darf: Studiengang,
 * Semester und Redaktion. Der Text wird deshalb nicht aus Bruchstuecken
 * zusammengesetzt, sondern je Fall als ganzer Satz uebersetzt; nur so bleibt
 * er in beiden Sprachen grammatisch richtig.
 */
function EditorialNote({ project }: { project: ProjectDetailResponse }) {
  const { t } = useTranslation()

  const studyProgram = project.studyProgram?.name
  const semester = project.semester?.name
  const editors = (project.editors ?? [])
    .map((editor) =>
      fullNameOf({
        firstName: editor.firstName,
        lastName: editor.lastName,
      })
    )
    .filter((name) => name !== "")

  if (studyProgram === undefined && semester === undefined) {
    return null
  }

  const setting =
    studyProgram !== undefined && semester !== undefined
      ? t("project.detail.editorial.setting", { studyProgram, semester })
      : studyProgram !== undefined
        ? t("project.detail.editorial.settingStudyProgram", { studyProgram })
        : t("project.detail.editorial.settingSemester", { semester })

  const note =
    editors.length > 0
      ? t("project.detail.editorial.withEditors", {
          setting,
          editors: editors.join(", "),
          count: editors.length,
        })
      : t("project.detail.editorial.plain", { setting })

  return (
    <blockquote className="border-l-2 border-primary pl-4">
      <p className="type-body-sm text-muted-foreground italic">{note}</p>
    </blockquote>
  )
}
