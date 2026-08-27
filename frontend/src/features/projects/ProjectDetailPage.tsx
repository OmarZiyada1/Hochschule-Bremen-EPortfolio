import {
  FileQuestionIcon,
  FileTextIcon,
  InfoIcon,
  LockIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Alert, AlertTitle } from "@/components/ui/alert"
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
import { useProjectFileUrls } from "@/features/project-content/hooks/useProjectFileUrls"
import { useFileUrl } from "@/api/useFileUrl"
import { PrintTrigger } from "@/features/project-content/print/PrintTrigger"
import { ProjectPrintView } from "@/features/project-content/print/ProjectPrintView"
import { usePrintProject } from "@/features/project-content/print/usePrintProject"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { CommentPanel } from "@/components/common/CommentPanel"
import { ProjectInfoSection } from "@/components/common/ProjectInfoSection"
import { ReactionPanel } from "@/features/projects/components/ReactionPanel"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"
import { useBreadcrumbTitle } from "@/routes/useBreadcrumb"
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
 * <p><strong>Die Ueberschrift ueber dem Beitrag steht nur fuer
 * Hilfsmittel</strong> (KAN-83, Nutzerentscheidung). Sichtbar gehen
 * Projekttitel, Kurzbeschreibung und Beitrag ohne Rubrik und ohne
 * Trennlinie ineinander ueber. Im Dokument bleibt die Ueberschrift
 * trotzdem stehen: der Beitrag ist der Hauptteil der Seite, und ohne sie
 * faende die Ueberschriftenliste eines Screenreaders zwischen der h1 und
 * der ersten Blockueberschrift keine Sprungmarke (SC 1.3.1, SC 2.4.6).
 * Dasselbe Mittel benutzt die Kurzbeschreibung im Editor
 * ({@code EditorIntro}, sr-only-Label).
 *
 * <p>Sie benennt zugleich das {@code section} darum ueber
 * {@code aria-labelledby}. Eine Ueberschrift <em>in</em> einem Abschnitt
 * benennt ihn naemlich nicht: ohne {@code aria-label} oder
 * {@code aria-labelledby} war das {@code section} auch vorher schon kein
 * Landmark und fiel aus der Landmark-Liste. Der Name kostet nichts und
 * macht den Sprungpunkt echt.
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
 * <p><strong>Die Aktion „PDF" steht am Titelbild oben rechts</strong>
 * (KAN-41, Nutzerentscheidung). Das Template zeichnet sie auf dieser Seite
 * nicht, anders als in der Editor-Kopfzeile; sie sitzt deshalb dort, wo sie
 * zum Titel gehoert und in jeder Breite sichtbar ist, gegenueber dem Knopf
 * fuer die Projektdaten. Ohne Titelbild gibt es die Flaeche nicht, dann
 * steht sie in der Zeile ueber dem Titel. Gedruckt wird der Bereich aus
 * {@code ProjectPrintView}, nicht diese Seite: er traegt Kopfbereich und
 * Beitrag und sonst nichts.
 */
/* Eine Liste, nicht bei jedem Rendern eine neue: sie steht in den
   Abhaengigkeiten der Bildaufloesung. */
const EMPTY_BLOCKS: readonly BlockResponse[] = []

export default function ProjectDetailPage() {
  const { t } = useTranslation()
  const { projectId } = useParams()
  const { data, isPending, error } = useProjectDetail(projectId ?? "")

  /*
   * Die Medien eines noch nicht veroeffentlichten Beitrags brauchen den
   * angemeldeten Weg; ohne ihn beantwortet der Server jede Medienanfrage
   * dieser Seite mit 401, und die Vorschau eines Entwurfs zeigt leere
   * Stellen statt Bild, Video, Ton und Dokument (Begruendung an
   * useProjectFileUrls).
   * Bei PUBLISHED bleibt es beim blossen Pfad: dort ist die Datei
   * oeffentlich und obendrein zwischenspeicherbar (§3.15).
   */
  const needsToken = data !== undefined && data.status !== "PUBLISHED"
  const { resolveFileUrl, fileState } = useProjectFileUrls(
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

  /* Der Name des Beitragsabschnitts. Er zeigt auf die sr-only-Ueberschrift
     darin, damit der Abschnitt ein benanntes Landmark bleibt (Javadoc oben). */
  const contentHeadingId = useId()

  /* Der Ausdruck (KAN-41): clientseitig aus dem Read-Only-Renderer, ohne
     Endpoint und ohne zusaetzliches Paket. */
  const { print, printing } = usePrintProject()

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

  /* Der Projekttitel wird zur letzten Ebene des Brotkrumenpfades; das Band
     selbst zeichnet der Anwendungsrahmen (KAN-80). Solange der Titel laedt,
     steht dort der Platzhalter „Projekt". */
  useBreadcrumbTitle(data?.title)

  return (
    <>
      {/* Die Ebene "Projekte" ersetzt den fruheren Knopf "Zurueck zu
          Projekte": ohne ihn braucht die Seite trotzdem einen Weg zurueck
          in die Liste, und im Pfad steht er ohnehin. */}
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
                  {/* Und gegenueber, oben rechts, der Ausdruck. Anders als
                    der Info-Knopf bleibt er in jeder Breite stehen: die
                    Projektdaten stehen breit ohnehin daneben, ein Ausdruck
                    nicht. */}
                  <PrintTrigger
                    onPrint={() => void print()}
                    busy={printing}
                    floating
                  />
                </>
              )}
              <CardContent>
                <article className="flex min-w-0 flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="type-overline text-muted-foreground">
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
                      {/* Ohne sichtbares Titelbild fehlt die Flaeche fuer die
                        beiden schwebenden Knoepfe; dann stehen sie in dieser
                        Zeile. Das gilt auch, solange das Bild eines Entwurfs
                        noch geladen wird: sonst gaebe es kurz keinen Weg zu
                        den Projektdaten. */}
                      {cover.url === null && (
                        <div className="ms-auto flex items-center gap-2">
                          <PrintTrigger
                            onPrint={() => void print()}
                            busy={printing}
                          />
                          <InfoTrigger onOpen={() => setInfoOpen(true)} />
                        </div>
                      )}
                    </div>

                    <h1 className="type-title min-w-0 text-primary">
                      {data.title}
                    </h1>
                  </div>

                  {/* Die Kurzbeschreibung steht als grauer Vorspann direkt
                      unter dem Titel, ohne Ueberschrift (KAN-83). „Abstract"
                      ist etwas anderes: den schreibt die Autor:in selbst als
                      Inhaltsblock. */}
                  {data.summary && (
                    <p className="type-body-lg text-muted-foreground">
                      {data.summary}
                    </p>
                  )}

                  {/* Kein Trennstrich und keine sichtbare Rubrik mehr
                      (KAN-83): der Beitrag schliesst unmittelbar an die
                      Kurzbeschreibung an. Die Ueberschrift bleibt sr-only
                      stehen und benennt den Abschnitt; warum, steht im
                      Javadoc oben. Auf dem Papier bleibt die Trennung
                      dagegen erhalten, dort trennt sie Kopfbereich und
                      Beitrag (project-content.css). */}
                  <section
                    aria-labelledby={contentHeadingId}
                    className="flex flex-col gap-3"
                  >
                    <h2 id={contentHeadingId} className="sr-only">
                      {t("project.detail.content")}
                    </h2>
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
                        fileState={fileState}
                      />
                    )}
                  </section>
                </article>
              </CardContent>
            </Card>

            {/* Eigene Karte, nicht dieselbe Flaeche wie der Inhalt: Metadaten
              und Projekttext sind zwei Gegenstaende und stehen deshalb in
              zwei Panels nebeneinander.

              Sie laeuft nicht mit. Bis KAN-37 klebte sie ab lg am oberen
              Rand; das half beim langen Projekttext, nahm der Karte aber
              jede ruhige Lage, sobald sie selbst laenger wurde als das
              Fenster: die letzten Zeilen blieben dann unerreichbar, bis die
              Seite weit genug gescrollt war. Mit der Kommentarspalte in
              derselben Spalte tritt genau das ein. Die Karte steht deshalb
              am Stueck und scrollt mit der Seite (Nutzerentscheidung zu
              KAN-37).

              Schmal ist die Karte ausgeblendet; denselben Inhalt zeigt dort
              die Schublade. */}
            <Card className="hidden [--card-spacing:--spacing(10)] lg:block">
              <CardContent>
                {/* „Projektdaten" benennt die ganze Nebenspalte und nicht
                    den Aufklapper darin. Beide Namen stehen nebeneinander,
                    ohne sich zu widersprechen: das aside ist die
                    ergaenzende Landmarke, „Projektinformationen" die
                    Ueberschrift eines Kastens darin, und beide erscheinen
                    in getrennten Listen der Hilfsmittel. Dieselbe Form
                    haben in dieser Spalte laengst die Reaktionen und die
                    Kommentare (section mit eigenem Namen). */}
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
        {/* Der Druckbereich (KAN-41). Er haengt als Portal unmittelbar an
            body und ist am Bildschirm verborgen; im Ausdruck bleibt allein
            er stehen, also Kopfbereich und Beitrag ohne Navigation,
            Fusszeile, Seitenleiste und Reaktionen. Derselbe Renderer wie
            oben, nur mit anderen Regeln. */}
        {data !== undefined && (
          <ProjectPrintView
            project={data}
            blocks={data.blocks ?? EMPTY_BLOCKS}
            coverUrl={cover.url}
            resolveFileUrl={resolveFileUrl}
            fileState={fileState}
          />
        )}

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
  const [searchParams] = useSearchParams()

  /*
   * Der Rueckweg in den Review-Modus (KAN-37). Die Redaktion kommt von dort
   * ueber den Umschalter „Vorschau"; ohne diesen Zweig faende sie hier
   * keinen Weg zurueck, obwohl der Schalter drueben einen zweiseitigen
   * Wechsel verspricht. Der Herkunftsvermerk steht in der Adresse und nicht
   * im Zustand: nur so uebersteht er einen Reload, und nur so bleibt die
   * Seite fuer alle anderen unveraendert.
   */
  const fromReview = searchParams.get("from") === "review"

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
      {fromReview && (
        <ViewModeSwitch
          mode="preview"
          alternate="review"
          onModeChange={(mode) => {
            if (mode === "review") {
              void navigate(`/projects/${project.id}/review`)
            }
          }}
        />
      )}
      {!fromReview && editable && participates && (
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
          {/* key an der Projekt-ID: die Route rendert bei einem Wechsel
              dieselbe Instanz weiter, und der Ausgangswert hasReacted wird
              nur beim ersten Rendern gelesen. Ohne den key behauptete das
              Symbol fuer das neue Projekt, was fuer das alte galt (Befund
              des frontend-reviewers). */}
          <ReactionPanel
            key={project.id}
            projectId={project.id}
            reactionCount={project.reactionCount}
            hasReacted={project.hasReacted}
            status={project.status}
          />
          <hr />
        </>
      )}
      {/*
       * Die Projektinformationen sind zu- und aufklappbar wie im Editor und
       * im Review-Modus (KAN-83, gemeldet aus der Sicht Studierender): wer
       * ein eingereichtes Projekt oeffnet, landet auf dieser Seite und nicht
       * im Editor, denn Stift und Umschalter gibt es nur in DRAFT und
       * REVISION und die Review-Seite ist rollengesperrt. Bis dahin stand
       * hier die nackte ProjectMetaSidebar, und die lange Liste liess sich
       * nicht wegklappen, obwohl der Kommentarkasten unmittelbar darunter
       * es konnte.
       *
       * <p>Aufgeklappt als Vorgabe: auf dieser Seite sind die Angaben Teil
       * der Auskunft ueber das Projekt und keine Nachschlagesache wie im
       * Review-Modus. Der Anblick bleibt damit derselbe wie zuvor, nur laesst
       * er sich jetzt einklappen.
       *
       * <p><strong>ProjectInfoSection allein und nicht ProjectSidePanels.</strong>
       * Das Akkordeon dort ist eine Aussage ueber ein <em>Paar</em>: hoechstens
       * einer der beiden Kaesten steht offen. Hier stehen zwischen den beiden
       * der Umschalter und die Reaktionen, und der Kommentarkasten bleibt
       * bewusst offen (siehe unten), weil diese Seite fuer die Autor:in eines
       * eingereichten Projekts der einzige Ort mit ihren Aenderungswuenschen
       * ist. Ausserdem haengt er hier zusaetzlich an der Anmeldung; diese
       * Bedingung in ProjectSidePanels hineinzureichen hiesse, eine Regel zu
       * fuehren, die nur einer von drei Verwendungsstellen gehoert.
       *
       * <p>Zwei Instanzen, zwei Zustaende: die Karte ab lg und die Schublade
       * darunter fuehren je einen eigenen Aufklapper. Das ist gewollt, denn
       * sichtbar ist immer nur eine von beiden, und ein geteilter Zustand
       * verknuepfte zwei Flaechen, die einander nie begegnen.
       */}
      <ProjectInfoSection project={project} defaultOpen />

      {/*
       * Die Kommentarspalte gehoert auch hierher (Nacharbeit an KAN-37).
       * Bis dahin stand sie nur im Editor und im Review-Modus, und beide
       * sind fuer die Autor:in eines eingereichten oder genehmigten
       * Projekts unerreichbar: der Stift auf der Kachel und der Umschalter
       * oben erscheinen nur in DRAFT und REVISION, die Review-Seite ist
       * rollengesperrt. Ihre Aenderungswuensche standen damit an keiner
       * Stelle, an die sie kam, obwohl §2.3 sie jeder Person zeigt, die das
       * Projekt lesen darf. Dasselbe galt fuer Projektmitglieder und fuer
       * die Administration.
       *
       * Nicht bei PUBLISHED: dort ist die Seite die oeffentliche Ansicht,
       * und die Rueckmeldungen der Redaktion gehen die Oeffentlichkeit
       * nichts an. Dieselbe Bedingung wie an den beiden anderen Orten.
       *
       * Nur fuer Angemeldete: ohne Token liefert der Endpoint 401, und ein
       * leerer Kasten mit Fehlermeldung waere die schlechtere Auskunft als
       * gar keiner. Was innerhalb davon sichtbar ist, entscheidet ohnehin
       * der Server (§6.1).
       */}
      {user !== null && project.status !== "PUBLISHED" && (
        <>
          <hr />
          {/* Aufgeklappt: hier ist die Spalte der einzige Ort, an dem die
              Autor:in ihre Aenderungswuensche sieht. */}
          <CommentPanel project={project} context="editor" defaultOpen />
        </>
      )}
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
 *
 * <p>Rund wie der Druckknopf gegenueber (KAN-41): zwei gleich grosse
 * Symbolknoepfe auf demselben Titelbild mit verschiedenem Radius fallen
 * sofort auf.
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
        "rounded-full lg:hidden",
        floating ? "absolute top-4 left-4 z-10 shadow-md" : undefined
      )}
    >
      <InfoIcon aria-hidden="true" />
    </Button>
  )
}
