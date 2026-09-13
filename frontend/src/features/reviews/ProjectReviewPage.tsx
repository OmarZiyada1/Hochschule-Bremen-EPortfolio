import { useQuery } from "@tanstack/react-query"
import {
  CheckIcon,
  ChevronDownIcon,
  FileQuestionIcon,
  FileTextIcon,
  HistoryIcon,
  LockIcon,
} from "lucide-react"
import { useId, useRef, useState, type ReactNode, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { isApiError } from "@/api/errors"
import { top10Queries } from "@/api/queries/top10"
import { useFileUrl } from "@/api/useFileUrl"
import type {
  BlockResponse,
  ProjectDetailResponse,
  ProjectStatus,
} from "@/api/types"
import { ErrorState } from "@/components/common/ErrorState"
import { useBreadcrumbTitle } from "@/routes/useBreadcrumb"
import { EmptyState } from "@/components/common/EmptyState"
import { PreviewModeButton } from "@/components/common/PreviewModeButton"
import { ProjectSidePanels } from "@/components/common/ProjectSidePanels"
import { StatusBadge } from "@/components/common/StatusBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { HistoryDialog } from "@/features/project-content/components/HistoryDialog"
import { useProjectFileUrls } from "@/features/project-content/hooks/useProjectFileUrls"
import { PrintTrigger } from "@/features/project-content/print/PrintTrigger"
import { ProjectPrintView } from "@/features/project-content/print/ProjectPrintView"
import { usePrintProject } from "@/features/project-content/print/usePrintProject"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { ReactionPanel } from "@/features/projects/components/ReactionPanel"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"
import { RevisionDialog } from "@/features/reviews/components/RevisionDialog"
import { useReviewWorkflow } from "@/features/reviews/hooks/useReviews"

/* Eine Liste, nicht bei jedem Rendern eine neue: sie steht in den
   Abhaengigkeiten der Bildaufloesung. */
const EMPTY_BLOCKS: readonly BlockResponse[] = []

/**
 * Der Review-Modus nach Template „Editor (Review-Modus)" (Ticket KAN-37):
 * links der gelesene Beitrag, rechts der Umschalter in die Vorschau, Status
 * samt Aktionen, Projektdaten und die Kommentarspalte.
 *
 * <p><strong>Er bleibt im Anwendungsrahmen</strong> und nicht im rahmenlosen
 * {@code EditorLayout}: das Template zeichnet NavBar und Ruecksprungleiste.
 *
 * <p><strong>Kein Editor.</strong> Der Inhalt laeuft ausschliesslich ueber
 * {@code ProjectContent} aus KAN-10, den JSON-Renderer ohne Tiptap. Aus
 * {@code features/project-content/} darf diese Seite nur ziehen, was kein
 * {@code @tiptap/*} und kein {@code prosemirror-*} nachzieht: den Renderer,
 * {@code useProjectFileUrls} und {@code HistoryDialog}; dazu seit KAN-104
 * {@code PreviewModeButton} aus {@code components/common} und
 * {@code ReactionPanel} aus {@code features/projects}. Der Importwaechter
 * ({@code src/tests/features/project-content/rendererImports.test.ts})
 * prueft genau das, sonst kaeme das ProseMirror-Buendel ueber eine
 * Zwischendatei ins Hauptbuendel zurueck.
 *
 * <p><strong>Die Vorschau entsteht an Ort und Stelle</strong> (KAN-104). Der
 * Knopf oben in der rechten Spalte wechselt zwischen „Review" und
 * „Vorschau", ohne die Route zu verlassen; bis dahin fuehrte er auf die
 * oeffentliche Detailseite und brauchte dort einen eigenen Rueckweg. In der
 * Vorschau faellt der Kartenrahmen um den Beitrag weg, und darunter stehen
 * die Reaktionen wie auf der Detailseite: so sieht die Redaktion das Bild,
 * das die Oeffentlichkeit spaeter sieht. Die rechte Spalte bleibt in beiden
 * Modi vollstaendig stehen, denn die redaktionelle Arbeit endet nicht mit
 * einem Blick auf die Vorschau (KAN-104, Entscheidung).
 *
 * <p><strong>Angeboten wird nur, was §4.1 im aktuellen Status
 * zulaesst</strong>, und nur, was das Vier-Augen-Prinzip nicht sperrt: wer
 * zur Projektseite gehoert, genehmigt und veroeffentlicht nicht, auch nicht
 * als zugewiesene Redaktion (§4.1 seit v61). Ein dauerhaft gesperrter Knopf
 * entsteht nicht; ein trotzdem eintreffendes 403 wird sichtbar behandelt.
 *
 * <p><strong>Kein Nominierungsknopf.</strong> Nominiert wird aus der
 * Reviewliste. Hier steht ein Projekt in aller Regel auf {@code SUBMITTED},
 * wo jede Nominierung nur 409 {@code PROJECT_NOT_PUBLISHED} ergaebe.
 *
 * <p><strong>Die Aktion „PDF" steht am Titelbild oben rechts</strong>, wie
 * auf der Detailseite (KAN-41, Nutzerentscheidung; hierher gezogen mit
 * KAN-83). Von den beiden Ansichten ohne Werkzeugleiste war diese die
 * Ausnahme: der Ausdruck stand als beschrifteter Knopf in der Aktionskarte
 * der rechten Spalte und damit an einem anderen Ort als ueberall sonst.
 * Ohne Titelbild gibt es die Flaeche nicht, dann steht er in der Zeile
 * ueber dem Titel. Gedruckt wird der Bereich aus {@code ProjectPrintView}:
 * Kopfbereich und Beitrag, keine redaktionellen Interna.
 *
 * <p><strong>Die Ueberschrift ueber dem Beitrag steht nur fuer
 * Hilfsmittel</strong>, aus denselben Gruenden wie auf der Detailseite
 * (KAN-83): sichtbar geht der Beitrag ohne Rubrik und ohne Trennlinie aus
 * der Kurzbeschreibung hervor, im Dokument bleibt die Ueberschrift als
 * einzige Sprungmarke zwischen der h1 und der ersten Blockueberschrift
 * stehen (SC 1.3.1) und benennt ueber {@code aria-labelledby} zugleich den
 * Abschnitt.
 */
export default function ProjectReviewPage() {
  const { t } = useTranslation()
  const { projectId } = useParams()
  const { data, isPending, error } = useProjectDetail(projectId ?? "")

  /*
   * Ein Projekt im Review steht selten auf PUBLISHED; seine Medien
   * brauchen deshalb den angemeldeten Weg, sonst beantwortet der Server
   * jede Medienanfrage mit 401 und die Seite zeigt leere Stellen
   * (Begruendung an useProjectFileUrls). Beide Rueckgabewerte werden
   * durchgereicht: ohne fileState zeigt der Renderer keinen Ladezustand.
   */
  const needsToken = data !== undefined && data.status !== "PUBLISHED"
  const { resolveFileUrl, fileState } = useProjectFileUrls(
    data?.blocks ?? EMPTY_BLOCKS,
    needsToken
  )
  const cover = useFileUrl(data?.coverImageUrl, needsToken)

  /* Derselbe Ausdruck wie auf der Detailseite (KAN-41), seit KAN-83 auch
     hier: die Redaktion soll das Blatt lesen koennen, das die Autor:in
     abgibt. Gedruckt wird derselbe Umfang, Kopfbereich und Beitrag; die
     redaktionellen Interna bleiben am Schirm. */
  const { print, printing } = usePrintProject()

  const forbidden =
    error !== null && isApiError(error) && error.errorCode === "NO_PERMISSION"
  const notFound =
    error !== null &&
    isApiError(error) &&
    error.errorCode === "PROJECT_NOT_FOUND"

  /* Titel als letzte Ebene des Pfades; das Band zeichnet der Rahmen (KAN-80). */
  useBreadcrumbTitle(data?.title)

  /* Der Name des Beitragsabschnitts: er zeigt auf die sr-only-Ueberschrift
     darin (Javadoc oben). */
  const contentHeadingId = useId()

  /*
   * Review oder Vorschau (KAN-104). Lokal und nicht in der Adresse: die
   * Vorschau ist ein anderer Blick auf dieselbe Arbeitsseite und kein
   * eigenes Ziel. Ein Neuladen oeffnet wieder die Reviewansicht.
   */
  const [mode, setMode] = useState<"review" | "preview">("review")
  const previewing = mode === "preview"
  /*
   * Die Ansage des Wechsels (SC 4.1.3). Eine eigene Region, die dauerhaft im
   * DOM steht und nur ihren Text wechselt: eine Region, die erst mit ihrer
   * Meldung entsteht, lesen manche Screenreader gar nicht vor. Die Region
   * der Aktionskarte bleibt den Statuswechseln vorbehalten.
   */
  const [modeNotice, setModeNotice] = useState("")

  const toggleMode = () => {
    const next = previewing ? "review" : "preview"
    setMode(next)
    setModeNotice(t(`review.detail.mode.announce.${next}`))
  }

  return (
    <>
      {/* Das Brotkrumenband traegt den Weg zurueck vollstaendig; ein
          zweiter Link „Zurueck zu Meine Reviews" daneben sagte dasselbe ein
          zweites Mal und schoebe die Ueberschrift nach unten (stehende
          Entscheidung, Skill frontend-modul Abschnitt 0a). */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
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
                render={<Link to="/reviews" />}
              >
                {t("review.detail.back")}
              </Button>
            }
          />
        )}

        {forbidden && (
          <EmptyState
            headingLevel={1}
            icon={<LockIcon aria-hidden="true" />}
            title={t("review.detail.forbidden.title")}
            description={t("review.detail.forbidden.description")}
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/reviews" />}
              >
                {t("review.detail.back")}
              </Button>
            }
          />
        )}

        {error !== null && !forbidden && !notFound && (
          <>
            <h1 className="type-h2">{t("project.detail.error.title")}</h1>
            <ErrorState error={error} />
          </>
        )}

        {isPending && (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start lg:gap-12">
            {/* Auch der Ladezustand traegt eine Ueberschrift: sonst hat die
                Seite fuer die Sprungnavigation eines Screenreaders bis zur
                Antwort gar keine (SC 1.3.1, SC 2.4.6). */}
            <h1 className="sr-only">{t("review.detail.loading")}</h1>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-110 w-full rounded-xl" />
              <Skeleton className="h-12 w-3/4 rounded-control" />
              <Skeleton className="h-32 w-full rounded-control" />
            </div>
            <Skeleton className="h-160 rounded-xl" />
          </div>
        )}

        {data !== undefined && (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start lg:gap-12">
            {/* Der Rahmen des Beitrags wechselt mit dem Modus, der Beitrag
                selbst nicht (ContributionFrame, KAN-104). */}
            <ContributionFrame
              previewing={previewing}
              coverUrl={cover.url}
              footer={
                /* key an der Projekt-ID wie auf der Detailseite: der
                   Ausgangswert hasReacted wird nur beim ersten Rendern
                   gelesen, und ohne key behauptete das Symbol fuer ein
                   anderes Projekt, was fuer dieses galt. */
                <ReactionPanel
                  key={data.id}
                  projectId={data.id}
                  reactionCount={data.reactionCount}
                  hasReacted={data.hasReacted}
                  status={data.status}
                />
              }
            >
              <article className="flex min-w-0 flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="type-overline text-muted-foreground">
                      {t("project.list.label")}
                    </p>
                    <StatusBadge status={data.status} />
                    {/*
                     * Der Ausdruck oben rechts, an derselben Stelle wie
                     * auf der Detailseite. Er steht hier allein und nicht
                     * wie dort einem Info-Knopf gegenueber: die
                     * Reviewansicht fuehrt keine Schublade fuer die
                     * Projektdaten, die stehen schmal ohnehin als eigene
                     * Karte unter dem Beitrag. Ein zweiter Knopf entstuende
                     * allein der Symmetrie wegen und oeffnete nichts.
                     *
                     * <strong>Genau ein Knopf, nur seine Lage wechselt.</strong>
                     * Mit Titelbild schwebt er darauf (die Karte ist
                     * relative), ohne steht er in dieser Zeile. Zwei
                     * getrennte Zweige waeren zwei Stellen im Baum: sobald
                     * die angemeldet nachgeladene Bildadresse eintrifft,
                     * baute React den einen ab und den anderen auf, und ein
                     * Knopf, der unter dem Fokus verschwindet, gibt ihn an
                     * body zurueck (SC 2.4.3; Befund des
                     * frontend-reviewers). So bleibt es derselbe Knoten.
                     *
                     * Die Huelle traegt ms-auto und schiebt ihn in dieser
                     * Zeile nach rechts; schwebt er, ist sie leer und ohne
                     * Wirkung, weil sie das letzte Kind der Zeile ist.
                     */}
                    <div className="ms-auto">
                      <PrintTrigger
                        onPrint={() => void print()}
                        busy={printing}
                        floating={cover.url !== null}
                      />
                    </div>
                  </div>
                  <h1 className="type-title min-w-0 text-primary">
                    {data.title}
                  </h1>
                </div>

                {/* Wie auf der Detailseite: grauer Vorspann ohne
                      Ueberschrift, damit beide Lesepfade gleich aussehen
                      (KAN-83). */}
                {data.summary !== null && (
                  <p className="type-body-lg text-muted-foreground">
                    {data.summary}
                  </p>
                )}

                {/* Kein Trennstrich und keine sichtbare Rubrik: der
                      Beitrag schliesst unmittelbar an die Kurzbeschreibung
                      an, und die Redaktion liest damit dasselbe Bild wie
                      die Oeffentlichkeit (KAN-83). Die Ueberschrift bleibt
                      sr-only und benennt den Abschnitt; Begruendung im
                      Javadoc oben. */}
                <section
                  aria-labelledby={contentHeadingId}
                  className="flex flex-col gap-3"
                >
                  <h2 id={contentHeadingId} className="sr-only">
                    {t("project.detail.content")}
                  </h2>
                  {(data.blocks ?? []).length === 0 ? (
                    <EmptyState
                      headingLevel={3}
                      icon={<FileTextIcon aria-hidden="true" />}
                      title={t("project.detail.empty.title")}
                      description={t("project.detail.empty.description")}
                    />
                  ) : (
                    <ProjectContent
                      blocks={data.blocks ?? EMPTY_BLOCKS}
                      resolveFileUrl={resolveFileUrl}
                      fileState={fileState}
                    />
                  )}
                </section>
              </article>
            </ContributionFrame>

            <div className="flex flex-col gap-6">
              {/*
               * Der Umschalter oben in der rechten Spalte, an der Stelle des
               * frueheren Schiebeschalters (KAN-104). Er wechselt an Ort und
               * Stelle; keine sticky Kopfzeile wie im Editor, die Seite hat
               * keine Werkzeuge, die beim Scrollen mitlaufen muessten.
               *
               * <p>Die Spalte steht in beiden Modi an derselben Stelle des
               * Baums, und der Knopf in ihr bleibt derselbe Knoten: nach dem
               * Druck bleibt der Fokus, wo er war (SC 2.4.3). Nur der Rahmen
               * links wechselt.
               */}
              <PreviewModeButton
                previewing={previewing}
                counterpart="review"
                onToggle={toggleMode}
                className="w-full"
              />

              {/*
               * Darunter alles, was zum Projekt gehoert: Statuszeile,
               * Projektinformationen und Kommentare in einer Karte, die
               * beiden Aufklapper als Akkordeon.
               */}
              <ReviewActionsCard project={data} />
            </div>
          </div>
        )}

        {/* Der Druckbereich liegt ausserhalb der Spalten und ist am
            Bildschirm verborgen; im Ausdruck bleibt allein er stehen. Je
            Seite gibt es genau einen, deshalb erst mit geladenem Projekt.
            resolveFileUrl und fileState gehen mit: ein Projekt im Review
            steht selten auf PUBLISHED, und ohne den angemeldeten Weg blieben
            seine Medien auf dem Papier leer. */}
        {data !== undefined && (
          <ProjectPrintView
            project={data}
            blocks={data.blocks ?? EMPTY_BLOCKS}
            coverUrl={cover.url}
            resolveFileUrl={resolveFileUrl}
            fileState={fileState}
          />
        )}

        {/* Die Ansage des Moduswechsels (KAN-104). Dauerhaft im Baum, auch
            waehrend des Ladens, und nur ihr Text wechselt. */}
        <p aria-live="polite" className="sr-only">
          {modeNotice}
        </p>
      </div>
    </>
  )
}

/**
 * Der Status als Menue: aktueller Stand als Marke, darunter die vier
 * redaktionellen Staende aus §2.2.
 *
 * <p><strong>Warum ein Menue und keine Knopfreihe.</strong> Vorher standen
 * bis zu drei Knoepfe untereinander, und welcher fehlte, sagte nichts
 * darueber, was es sonst noch gaebe. Das Menue zeigt immer dieselben vier
 * Eintraege; welcher gerade geht, entscheidet §4.1.
 *
 * <p><strong>Entwurf steht bewusst nicht darin.</strong> Nach §4.1 fuehrt
 * dorthin kein redaktioneller Weg: die Autor:in zieht ihre Einreichung
 * selbst zurueck, und die Redaktion kommt nur ueber das Abgeben der
 * Zuweisung dorthin, was etwas anderes ist als ein Statuswechsel.
 *
 * <p><strong>Gesperrt statt versteckt, und mit Grund.</strong> Ein
 * ausgegrauter Eintrag ohne Erklaerung sagt nicht, warum (SC 3.3.2); jeder
 * gesperrte traegt deshalb eine zweite Zeile. Gesperrt wird ueber
 * {@code aria-disabled} und nicht ueber {@code disabled}, sonst waere der
 * Eintrag nicht mehr fokussierbar und der Grund fuer die Tastatur
 * unerreichbar. Dasselbe Muster wie im Zeilenmenue der Reviewliste.
 *
 * <p>Der aktuelle Stand ist kein Ziel: er traegt einen Haken und ist
 * gesperrt, ohne Begruendung, denn dass man dort schon steht, sieht man an
 * der Marke daneben.
 */
function StatusMenu({
  project,
  mayRelease,
  inTop10,
  pending,
  onSelect,
  triggerRef,
}: {
  project: ProjectDetailResponse
  /** Vier-Augen-Prinzip (§5 Fussnote 1), nur fuer Freigaben. */
  mayRelease: boolean
  /**
   * Steht das Projekt gerade in der kuratierten Top-10? Dann sperrt §4.1
   * seit Contract v72 den Weg nach REVISION: erst aus der Liste nehmen,
   * dann zurueckgeben. Verbindlich bleibt der Server mit 409
   * RESOURCE_IN_USE; die Oberflaeche sagt es nur vorher.
   */
  inTop10: boolean
  pending: boolean
  onSelect: (
    target: "APPROVED" | "PUBLISHED" | "REVISION" | "SUBMITTED"
  ) => void
  /*
   * Der Menueknopf, fuer die Fokusrueckgabe aus den Dialogen (SC 2.4.3).
   * Nicht je Eintrag einer: der Eintrag ist abgebaut, sobald das Menue
   * schliesst, und der Fokus faellt sonst auf body.
   */
  triggerRef: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation()
  const status = project.status

  const targets: { value: ProjectStatus; blocked: string | null }[] = [
    {
      value: "SUBMITTED",
      /*
       * Seit Contract v73 gibt es einen redaktionellen Weg dorthin, aber nur
       * aus REVISION („Projekt zurueck in die Pruefung geben", §5). Aus
       * DRAFT reicht weiterhin allein die Autor:in ein, und aus APPROVED und
       * PUBLISHED fuehrt nach §4.1 ueberhaupt kein Weg zurueck nach
       * SUBMITTED, auch nicht fuer sie. Der Grund muss die beiden
       * auseinanderhalten, sonst schickt er auf eine falsche Faehrte.
       */
      blocked:
        status === "SUBMITTED" || status === "REVISION"
          ? null
          : status === "DRAFT"
            ? "editorial"
            : "from",
    },
    {
      value: "APPROVED",
      blocked:
        status === "APPROVED"
          ? null
          : status !== "SUBMITTED"
            ? "from"
            : !mayRelease
              ? "ownProject"
              : null,
    },
    {
      value: "PUBLISHED",
      blocked:
        status === "PUBLISHED"
          ? null
          : status !== "APPROVED"
            ? "from"
            : !mayRelease
              ? "ownProject"
              : null,
    },
    {
      value: "REVISION",
      blocked:
        status === "REVISION"
          ? null
          : status === "PUBLISHED" && inTop10
            ? "inTop10"
            : status === "SUBMITTED" ||
                status === "APPROVED" ||
                status === "PUBLISHED"
              ? null
              : "from",
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={triggerRef}
        render={<Button variant="ghost" size="sm" className="gap-1.5 px-1" />}
      >
        <StatusBadge status={status} />
        <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{t("review.detail.statusMenu.label")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {targets.map((target) => {
          const current = target.value === status
          const disabled = current || target.blocked !== null || pending
          return (
            <DropdownMenuItem
              key={target.value}
              aria-disabled={disabled || undefined}
              /*
               * Gesperrt heisst hier: lesbar bleiben. Base UIs MenuItem
               * schliesst das Menue auch bei aria-disabled (closeOnClick
               * steht auf true), und ein Menue, das sich ohne Wirkung und
               * ohne Meldung schliesst, laesst die Begruendung daneben nie
               * lesen. Gedaempft wird deshalb nur die Beschriftung ueber
               * die Rolle text-disabled; der Grund bleibt bei vollem
               * muted-foreground, weil er die Erklaerung ist, fuer die der
               * Eintrag ueberhaupt fokussierbar bleibt (SC 1.4.3).
               */
              closeOnClick={!disabled}
              onClick={() => {
                if (disabled) {
                  return
                }
                onSelect(
                  target.value as
                    "APPROVED" | "PUBLISHED" | "REVISION" | "SUBMITTED"
                )
              }}
            >
              {current ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className="size-4" />
              )}
              <span className="flex flex-col items-start">
                <span className={disabled ? "text-text-disabled" : undefined}>
                  {t(`project.status.${target.value}`)}
                </span>
                {!current && target.blocked !== null && (
                  <span className="type-label-xs text-muted-foreground">
                    {t(`review.detail.statusMenu.blocked.${target.blocked}`)}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Statuskarte: aktueller Status, die im Status moeglichen Aktionen und der
 * Zugang zur Historie.
 *
 * <p>Der Verlauf laeuft ueber {@code HistoryDialog} aus
 * {@code features/project-content/}; eine zweite Fassung entsteht nicht,
 * und die vorhandene zieht nicht um.
 */
function ReviewActionsCard({ project }: { project: ProjectDetailResponse }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { approve, publish, requestRevision, submit } = useReviewWorkflow(
    project.id
  )

  const [historyOpen, setHistoryOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  /*
   * Die kuratierte Liste, allein fuer die Frage, ob dieses Projekt darin
   * steht (§4.1 seit v72). Der Endpoint ist oeffentlich, liefert hoechstens
   * zehn Eintraege und teilt sich den Cache mit „Meine Reviews"; ein
   * eigenes Feld an der Projektantwort waere dafuer zu viel.
   */
  const top10 = useQuery(top10Queries.list())
  const inTop10 = (top10.data ?? []).some(
    (entry) => entry.project.id === project.id
  )
  const [notice, setNotice] = useState("")
  /*
   * Beide Freigabeschritte fragen vorher zurueck (Skill frontend-design,
   * Abschnitt 5): sie aendern die Sicht anderer. Das Veroeffentlichen macht
   * den Beitrag fuer alle sichtbar und laesst sich nur ueber „Zur
   * Ueberarbeitung" wieder einfangen. Nicht destruktiv eingefaerbt, es wird
   * nichts zerstoert.
   */
  const [confirm, setConfirm] = useState<"approve" | "publish" | "submit">(
    "approve"
  )
  /*
   * Offen und Schritt stehen getrennt, damit die Beschriftung waehrend der
   * Schliessanimation stehen bleibt. Zusammengelegt zeigte der Dialog beim
   * Zugehen kurz den Text des Genehmigens, auch wenn er zum Veroeffentlichen
   * geoeffnet war.
   */
  const [confirmOpen, setConfirmOpen] = useState(false)
  /* Ein Ausloeser fuer beide Dialoge: das Statusmenue. */
  const statusMenuRef = useRef<HTMLButtonElement | null>(null)

  /*
   * Vier-Augen-Prinzip (§4.1 seit v61, §5 Fussnote 1): wer zur Projektseite
   * gehoert, gibt sie nicht frei, auch nicht als zugewiesene Redaktion. Seit
   * KAN-82 gilt das fuer jede Rolle; bis dahin stand hier eine Ausnahme fuer
   * ADMIN, weil ein Admin-Konto gar keine eigenen Projekte haben konnte. Die
   * Oberflaeche blendet aus, was nicht greift; verbindlich bleibt der Server.
   */
  const onProjectSide =
    user !== null &&
    (project.author.id === user.id ||
      (project.members ?? []).some((member) => member.userId === user.id))
  const mayRelease = !onProjectSide

  const mayApprove = project.status === "SUBMITTED" && mayRelease
  const mayPublish = project.status === "APPROVED" && mayRelease
  /* Die Ruecknahme ist keine Freigabe und traegt in §5 keine Fussnote 1. */
  const mayRequestRevision =
    project.status === "SUBMITTED" ||
    project.status === "APPROVED" ||
    project.status === "PUBLISHED"

  /*
   * Die Freigabe ist am eigenen Projekt gesperrt, und der Status waere sonst
   * einer, in dem sie ginge. Ohne die zweite Haelfte stuende der Hinweis auch
   * in REVISION, wo ohnehin niemand freigibt. Bis KAN-82 stand hier zusaetzlich
   * !mayRelease, weil die Sperre eine Ausnahme fuer ADMIN trug und aus
   * onProjectSide nicht folgte; seit sie fuer jede Rolle gilt, sagte die
   * Bedingung zweimal dasselbe.
   */
  const releaseBlocked =
    onProjectSide &&
    (project.status === "SUBMITTED" || project.status === "APPROVED")
  /*
   * Seit Contract v73 gibt es aus REVISION heraus einen redaktionellen Weg
   * zurueck in die Pruefung. Ohne ihn hier meldete die Karte „keine
   * redaktionelle Aktion", waehrend das Menue daneben „Eingereicht" anbot.
   */
  const maySubmitBack = project.status === "REVISION"
  const nothingPossible =
    !mayApprove && !mayPublish && !mayRequestRevision && !maySubmitBack

  const failure =
    approve.error ?? publish.error ?? requestRevision.error ?? submit.error
  const failed = isApiError(failure) ? failure : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusMenu
            project={project}
            mayRelease={mayRelease}
            inTop10={inTop10}
            pending={approve.isPending || publish.isPending || submit.isPending}
            onSelect={(target) => {
              if (target === "REVISION") {
                setRevisionOpen(true)
                return
              }
              /*
               * Auch dieser Schritt fragt zurueck (Skill frontend-design,
               * Abschnitt 5, Zeile „einreichen"): er nimmt der Autor:in die
               * Bearbeitbarkeit, denn REVISION ist editierbar und SUBMITTED
               * nicht, und schiebt das Projekt in eine fremde
               * Warteschlange. Nicht destruktiv eingefaerbt, es wird nichts
               * zerstoert. Ein 409 CHANGE_REQUESTS_OPEN erscheint sichtbar
               * darunter.
               */
              setConfirm(
                target === "APPROVED"
                  ? "approve"
                  : target === "PUBLISHED"
                    ? "publish"
                    : "submit"
              )
              setConfirmOpen(true)
            }}
            triggerRef={statusMenuRef}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            disabled={project.statusHistory === null}
          >
            <HistoryIcon aria-hidden="true" />
            {t("review.detail.history")}
          </Button>
          {/* Der Ausdruck steht seit KAN-83 nicht mehr hier, sondern am
              Titelbild oben rechts, wo ihn jede Ansicht ohne Werkzeugleiste
              fuehrt (Begruendung im Javadoc der Seite). */}
        </div>

        {/*
         * Die frueheren drei Knoepfe stecken jetzt im Statusmenue oben. Was
         * bleibt, ist der Hinweis darauf, warum es an diesem Projekt
         * weniger anbietet als sonst. Ein Menue, dessen Eintraege gesperrt
         * sind, nennt zwar je Eintrag einen Grund, aber das
         * Vier-Augen-Prinzip betrifft die ganze Karte und gehoert deshalb
         * auch neben sie (§5 Fussnote 1).
         */}
        {nothingPossible ? (
          <p className="type-body-sm text-muted-foreground">
            {releaseBlocked
              ? t("review.detail.actions.ownProject")
              : t("review.detail.actions.none")}
          </p>
        ) : (
          releaseBlocked && (
            <p className="type-label-xs text-muted-foreground">
              {t("review.detail.actions.ownProject")}
            </p>
          )
        )}

        {failed !== null && <ErrorState error={failed} />}

        {/*
         * Statuszeile, Projektinformationen und Kommentare in einer Karte
         * (Frame 109:2). Das Paar und sein Akkordeon stecken seit KAN-83 in
         * ProjectSidePanels, weil die Seitenleiste des Editors dieselbe Form
         * bekommen hat und der gemeinsame Zustand sonst zweimal gefuehrt
         * wuerde.
         *
         * Offen stehen voreingestellt die Kommentare, bei PUBLISHED die
         * Angaben. Beides entscheidet seit KAN-104 ProjectSidePanels selbst,
         * fuer diese Ansicht wie fuer den Editor; das ausdrueckliche Setzen
         * hier ist damit entfallen. Veroeffentlicht die Redaktion an Ort und
         * Stelle, oeffnen sich die Angaben, statt eine Karte ohne offenen
         * Kasten zu hinterlassen.
         */}
        <ProjectSidePanels project={project} context="review" />

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent
            className="rounded-modal"
            finalFocus={statusMenuRef}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(`review.detail.actions.${confirm}Dialog.title`)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(`review.detail.actions.${confirm}Dialog.description`, {
                  title: project.title,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={
                  approve.isPending || publish.isPending || submit.isPending
                }
                onClick={() => {
                  const step = confirm
                  setConfirmOpen(false)
                  if (step === "approve") {
                    approve.mutate(undefined, {
                      onSuccess: () =>
                        setNotice(t("review.detail.actions.approveDone")),
                    })
                  }
                  if (step === "publish") {
                    publish.mutate(undefined, {
                      onSuccess: () =>
                        setNotice(t("review.detail.actions.publishDone")),
                    })
                  }
                  if (step === "submit") {
                    submit.mutate(undefined, {
                      onSuccess: () =>
                        setNotice(t("review.detail.actions.submitDone")),
                    })
                  }
                }}
              >
                {t(`review.detail.actions.${confirm}Dialog.confirm`)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          history={project.statusHistory}
        />

        <RevisionDialog
          open={revisionOpen}
          onOpenChange={(next) => {
            setRevisionOpen(next)
            if (!next) {
              requestRevision.reset()
            }
          }}
          pending={requestRevision.isPending}
          error={requestRevision.error}
          finalFocus={statusMenuRef}
          onSubmit={(reason) => {
            requestRevision.mutate(reason, {
              onSuccess: () => {
                setRevisionOpen(false)
                setNotice(t("review.detail.actions.revisionDone"))
              },
            })
          }}
        />

        <span className="sr-only" role="status">
          {notice}
        </span>
      </CardContent>
    </Card>
  )
}

/**
 * Der Rahmen um den Beitrag, je nach Modus (KAN-104).
 *
 * <p><strong>In der Reviewansicht die Karte</strong>, wie seit KAN-37: das
 * Titelbild laeuft als erstes Kind bis an deren Kante, und die Karte ist der
 * positionierte Vorfahr des schwebenden Druckknopfs.
 *
 * <p><strong>In der Vorschau ohne Karte und mit den Reaktionen
 * darunter</strong>, wie auf der Detailseite (KAN-104, Entscheidung): so
 * sieht die Oeffentlichkeit den Beitrag. Das Titelbild traegt seine Rundung
 * dann selbst, und {@code relative} bleibt am Rahmen, damit der Druckknopf
 * weiter auf dem Bild schwebt. Die Reaktionen kommen mit dem Projektstatus:
 * reagieren laesst sich erst bei PUBLISHED (§3.10), und genau das sagt die
 * Komponente sichtbar. Das ist keine Attrappe, sondern das Bild, das die
 * Vorschau zeigen soll.
 *
 * <p>Der Beitrag kommt als {@code children} und ist in beiden Faellen
 * derselbe. Ein Wechsel baut ihn neu auf, weil sich der Rahmen um ihn
 * aendert; Daten und Dateien liegen im Query-Cache, es wird also nichts neu
 * geladen. Der Fokus liegt dabei auf dem Umschalter in der rechten Spalte,
 * und die bleibt stehen.
 */
function ContributionFrame({
  previewing,
  coverUrl,
  footer,
  children,
}: {
  previewing: boolean
  /** Die aufgeloeste Adresse des Titelbilds, ohne Bild {@code null}. */
  coverUrl: string | null
  /** Was in der Vorschau unter dem Beitrag steht: die Reaktionen. */
  footer: ReactNode
  children: ReactNode
}) {
  if (previewing) {
    return (
      <div className="relative flex min-w-0 flex-col gap-8">
        {coverUrl !== null && (
          <img
            src={coverUrl}
            alt=""
            className="h-60 w-full rounded-card object-cover sm:h-110"
          />
        )}
        {children}
        <hr />
        {footer}
      </div>
    )
  }

  return (
    /* relative wie auf der Detailseite: der schwebende Druckknopf haengt am
       naechsten positionierten Vorfahren. */
    <Card className="relative min-w-0 [--card-spacing:--spacing(10)]">
      {coverUrl !== null && (
        <img
          src={coverUrl}
          alt=""
          className="h-60 w-full object-cover sm:h-110"
        />
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}
