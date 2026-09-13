import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useId, useRef, useState, type KeyboardEvent } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { applyValidationErrors, isApiError } from "@/api/errors"
import type {
  CommentResponse,
  CommentStatus,
  CommentType,
  ProjectDetailResponse,
} from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import {
  COMMENT_TEXT_MAX,
  commentFormSchema,
  type CommentFormValues,
} from "@/components/common/CommentForm.schema"
import { ErrorState } from "@/components/common/ErrorState"
import {
  creatableTuple,
  mayDeleteComment,
  maySetChangeRequestStatus,
} from "@/components/common/commentPermissions"
import { EmptyState } from "@/components/common/EmptyState"
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
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useSetCommentStatus,
} from "@/features/comments/hooks/useComments"
import { fullNameOf } from "@/lib/name"
import { usePortfolioPath } from "@/features/portfolio/hooks/usePortfolioPath"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"
import { cn } from "@/lib/utils"

/**
 * Die Kommentarspalte (§2.3, §2.4, §3.5, §6.1; KAN-37), die
 * <strong>einzige</strong> Kommentardarstellung im Repository.
 *
 * <p><strong>Zwei Orte, ein Baustein.</strong> Sie steht im Review-Modus
 * und im Editor, dort jeweils in der rechten Spalte unmittelbar unter den
 * Projektinformationen (Vorlage „Editor (Review-Modus)", Frame 109:2: drei
 * Karten untereinander, die Kommentare als dritte). Deshalb bringt sie
 * keine eigene Kartenflaeche mit: den Rahmen setzt die Seite, die sie
 * einhaengt, und beide Orte rahmen gleich. Zwei Abschriften liefen
 * auseinander, sobald ein Kommentartyp, ein Stand oder eine
 * Barrierefreiheitszusage dazukommt.
 *
 * <p><strong>Ein {@code section} und kein {@code aside}.</strong> Sie liegt
 * innerhalb der Seitenleiste, und die ist bereits die ergaenzende
 * Landmarke; eine zweite darin verschachtelt sagte nichts dazu. Mit
 * {@code aria-label} bleibt sie eine eigene Region und damit anspringbar
 * (SC 1.3.1).
 *
 * <p><strong>Der Eintrag komponiert die Registry-Primitive
 * {@code message}</strong> (MessageContent, MessageHeader, MessageFooter).
 * Die Aufzaehlung bleibt aussen eine {@code ol} mit {@code li}: die
 * Primitive rendert {@code div} und hat keine {@code render}-Prop, und die
 * Reihenfolge des Verlaufs ist eine Aussage, die im Markup stehen muss.
 * {@code MessageGroup} entfaellt aus demselben Grund, seine Klassen traegt
 * die {@code ol} selbst.
 *
 * <p><strong>Die drei Typen sind ohne Farbwahrnehmung unterscheidbar</strong>
 * (SC 1.4.1): jeder traegt seine Bezeichnung als Wort, die Flaechenfarbe
 * wiederholt sie nur. Dasselbe gilt fuer den Stand eines
 * Aenderungswunsches.
 *
 * <p><strong>Keine Rollenkennzeichnung am Eintrag</strong>
 * (Nutzerentscheidung zur Nacharbeit an KAN-37). Wer geschrieben hat, sagt
 * der Name; die Rolle daneben verdoppelte die Zeile, ohne dass eine
 * Entscheidung daran haengt.
 *
 * <p><strong>Was in der Liste steht, entscheidet der Server.</strong> Eine
 * {@code NOTE} erscheint fuer die Projektseite gar nicht erst in der
 * Antwort (§6.1); hier wird nichts nachgefiltert, denn eine clientseitige
 * Filterung waere ueber die API auslesbar (Skill frontend-api, Abschnitt 8).
 *
 * <p><strong>Was sich anlegen laesst, haengt an Rolle und Ort.</strong> §5
 * gibt {@code REPLY} der gesamten Projektseite samt Redaktion und
 * Administration, {@code NOTE} und {@code CHANGE_REQUEST} allein EDITOR und
 * ADMIN. Im Editor bleibt es bei der Antwort, auch fuer ein
 * Redaktionskonto: dort schreibt jemand am eigenen Beitrag, und ein
 * Aenderungswunsch an sich selbst waere ein Arbeitsauftrag ohne
 * Auftraggeber. Verbindlich bleibt der Server; ein trotzdem eintreffendes
 * 403 wird sichtbar.
 *
 * <p><strong>Den Stand eines Aenderungswunsches schaltet der Stand
 * selbst.</strong> „Offen" und „Erledigt" sind der Umschalter und nicht
 * die Beschriftung neben einem zweiten Knopf (Nutzerentscheidung). Wer §5
 * dazu nicht berechtigt ist, sieht dasselbe Wort als Text. Geschaltet wird
 * in beide Richtungen: §2.4 begruendet den Rueckweg damit, dass die
 * Redaktion ein zu frueh gesetztes {@code RESOLVED} wieder oeffnen kann,
 * ohne dafuer einen neuen Kommentar schreiben zu muessen.
 *
 * <p><strong>Offene Aenderungswuensche stehen oben.</strong> Sie sind der
 * Arbeitsauftrag, und in {@code REVISION} beginnt die Spalte deshalb
 * aufgeklappt. Der Rest folgt in der Reihenfolge des Verlaufs.
 */
export function CommentPanel({
  project,
  context = "review",
  defaultOpen,
  open: openProp,
  onOpenChange,
  className,
}: {
  project: ProjectDetailResponse
  /**
   * Der Ort. Im Editor entsteht allein eine Antwort; im Review-Modus
   * entscheidet die Rolle nach §5.
   */
  context?: "review" | "editor"
  /**
   * Aufgeklappt starten, unabhaengig von Ort und Status. Gesetzt von der
   * Projektdetailseite: dort ist die Spalte der einzige Ort, an dem die
   * Autor:in ihre Aenderungswuensche sieht, und ein zugeklappter Kasten
   * verstuende sich als Nebensache. Ohne Angabe gilt die Regel unten.
   */
  defaultOpen?: boolean
  /**
   * Gesteuert statt selbst verwaltet, wie bei {@code ProjectInfoSection}:
   * gesetzt, wo die Spalte zu einem Akkordeon gehoert.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const { user } = useAuth()
  const projectId = project.id

  const comments = useComments(projectId)
  const create = useCreateComment(projectId)
  const setStatus = useSetCommentStatus(projectId)
  const remove = useDeleteComment(projectId)

  const entries = comments.data ?? []
  const openChangeRequests = entries.filter(isOpenChangeRequest)
  /*
   * Chronologisch, so wie der Server sie liefert (§6.1: aufsteigend nach
   * createdAt). Bis zur Nacharbeit standen offene Aenderungswuensche vorn.
   * Das zerriss den Verlauf: eine Antwort stand ueber der Frage, auf die sie
   * sich bezog, und ein erledigter Punkt sprang beim Umschalten quer durch
   * die Liste. Dass ein Punkt offen ist, sagt seine Flaeche, und die Zahl in
   * der Kopfzeile sagt, wie viele es sind.
   */
  const ordered = entries

  /*
   * Die Vorgabe, solange die Spalte sich selbst verwaltet. In Editor und
   * Reviewansicht gilt sie nicht: dort steht die Spalte im Akkordeon von
   * ProjectSidePanels, und das oeffnet seit KAN-104 in jedem Status die
   * Kommentare. Ohne Steuerung von aussen beginnt die Spalte in REVISION
   * aufgeklappt, weil dort die offenen Aenderungswuensche der Arbeitsauftrag
   * sind, und im Zusammenhang "review" ebenso.
   */
  const [ownOpen, setOwnOpen] = useState(
    defaultOpen ?? (project.status === "REVISION" || context === "review")
  )
  const open = openProp ?? ownOpen
  const setOpen = (next: boolean) => {
    if (onOpenChange === undefined) {
      setOwnOpen(next)
      return
    }
    onOpenChange(next)
  }

  /*
   * Eine Ansage je Vorgang, getrennt von der Liste: ein neuer Kommentar und
   * ein umgeschalteter Stand aendern die Liste weiter unten im Dokument,
   * und ohne Live-Region bliebe beides fuer Screenreader unbemerkt
   * (SC 4.1.3).
   */
  const [announcement, setAnnouncement] = useState("")

  /*
   * Der Status, den das Projekt beim Abschicken eines Aenderungswunsches
   * hatte. Seit Contract v71 loest der Wunsch selbst den Uebergang nach
   * REVISION aus (§4.1), aber nicht immer: in DRAFT und REVISION geschieht
   * nichts, und ohne Zuweisung ebenfalls nicht (§5 Fussnote 11). Die
   * Antwort traegt den Kommentar und nicht den Status.
   *
   * Deshalb wird hier nichts behauptet, sondern verglichen: der Hook laedt
   * das Projekt nach, die Seite rendert mit neuem Status, und erst wenn er
   * sich wirklich unterscheidet, erscheint die Meldung. So steht sie nie
   * da, wo gar nichts passiert ist.
   */
  const [statusAtRequest, setStatusAtRequest] = useState<string | null>(null)
  /* Ziel der Fokusrueckgabe, wenn ein geloeschter Eintrag den Ausloeser
     mitnimmt (SC 2.4.3). */
  const list = useRef<HTMLOListElement | null>(null)
  const statusChanged =
    statusAtRequest !== null && project.status !== statusAtRequest

  const allowedTypes = creatableTuple(user?.role, context)
  const currentUser = user === null ? null : { id: user.id, role: user.role }
  const mayToggleStatus = maySetChangeRequestStatus(project, currentUser)

  return (
    <section
      aria-label={t("comment.panel.label")}
      className={cn("flex flex-col", className)}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        {/*
         * Der Trigger liegt <em>in</em> der Ueberschrift und nicht daneben
         * (APG-Muster Disclosure): sonst haette die Spalte keinen
         * Sprungpunkt, und im Editor spraenge die Gliederung von h1 auf den
         * h3 des Leerzustands (Befund des frontend-reviewers).
         *
         * Kein aria-label: es ueberschriebe den Inhalt vollstaendig, und der
         * Zaehler „1 offen" steht darin. Den Zustand meldet aria-expanded,
         * das Base UI ohnehin setzt.
         *
         * Kein outline-none: es schaltete die globale Fokusregel ab, und der
         * halbdurchsichtige Ring allein bleibt unter 3:1 (SC 1.4.11).
         */}
        <h2>
          <CollapsibleTrigger
            className={cn(
              "group/comments flex w-full items-center justify-between gap-2",
              "text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
            )}
          >
            <span className="type-body flex min-w-0 items-center gap-2 font-semibold">
              <MessageSquareIcon
                aria-hidden="true"
                className="size-4 shrink-0"
              />
              {t("comment.panel.title")}
              {/* Zaehler als blosser Text im Warnton, wie die Vorlage ihn
                zeichnet (Frame 109:155): Symbol, Zahl, kein Hintergrund. */}
              {openChangeRequests.length > 0 && (
                <span className="type-label-xs flex shrink-0 items-center gap-1 font-normal text-destructive">
                  <AlertCircleIcon aria-hidden="true" className="size-3.5" />
                  {t("comment.panel.openCount", {
                    count: openChangeRequests.length,
                  })}
                </span>
              )}
            </span>
            {/*
             * Auf die Anwesenheit geprueft und nicht auf den Wert "false":
             * Base UI setzt data-panel-open ohne Wert, solange offen, und
             * entfernt das Attribut sonst (wie im EditorSidebar begruendet).
             */}
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/comments:rotate-180"
            />
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent className="flex flex-col gap-4 pt-4">
          {comments.isPending && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full rounded-card" />
              <Skeleton className="h-20 w-full rounded-card" />
            </div>
          )}

          {/* Ein fehlgeschlagenes Umschalten blieb sonst unsichtbar: der
              Stand aendert sich schlicht nicht. */}
          {setStatus.error !== null && <ErrorState error={setStatus.error} />}

          {/* Der Statuswechsel, den ein Aenderungswunsch seit Contract v71
              ausloest (§4.1). role="status" statt einer zweiten Live-Region:
              die Meldung ist sichtbar und wird angesagt, und zwar dieselbe
              (SC 4.1.3). Sie erscheint nur, wenn der Status sich wirklich
              geaendert hat. */}
          {statusChanged && (
            <Alert role="status">
              <AlertTitle>
                {t("comment.panel.statusChanged", {
                  status: t(`project.status.${project.status}`),
                })}
              </AlertTitle>
              {/* Ohne Schliessknopf bliebe die Meldung bis zum Abbau der
                  Spalte stehen, auch nach einem spaeteren Statuswechsel
                  ueber das Menue. Sie gehoert zu genau einem Vorgang. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("common.action.close")}
                onClick={() => setStatusAtRequest(null)}
                className="ml-auto size-7 rounded-control"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </Alert>
          )}

          {/* Ein fehlgeschlagenes Loeschen blieb sonst unsichtbar: der
              Eintrag bliebe schlicht stehen. */}
          {remove.error !== null && <ErrorState error={remove.error} />}

          {comments.error !== null && <ErrorState error={comments.error} />}

          {comments.data !== undefined && ordered.length === 0 && (
            <EmptyState
              headingLevel={3}
              icon={<MessageSquareIcon aria-hidden="true" />}
              title={t("comment.panel.empty.title")}
              description={t("comment.panel.empty.description")}
            />
          )}

          {ordered.length > 0 && (
            /*
             * tabIndex -1 und der ref: finalFocus am Dialog gibt den Fokus an
             * den Loeschknopf zurueck, und genau der wird mit seinem Eintrag
             * abgebaut, sobald die neu geladene Liste eintrifft. Der Fokus
             * fiele dann auf body und die naechste Tabulatorreihe begaenne
             * wieder ganz oben (SC 2.4.3). Die Liste selbst bleibt stehen und
             * nimmt ihn deshalb auf.
             */
            <ol
              ref={list}
              tabIndex={-1}
              className="flex min-w-0 flex-col gap-2 outline-none"
            >
              {ordered.map((comment) => (
                <li key={comment.id}>
                  <CommentItem
                    comment={comment}
                    mayToggleStatus={mayToggleStatus}
                    mayDelete={mayDeleteComment(comment.author.id, currentUser)}
                    deletePending={
                      remove.isPending && remove.variables === comment.id
                    }
                    onDelete={() => {
                      remove.mutate(comment.id, {
                        onSuccess: () => {
                          setAnnouncement(t("comment.panel.announce.deleted"))
                          list.current?.focus()
                        },
                        onError: (error) => setAnnouncement(apiMessage(error)),
                      })
                    }}
                    /* Nur der angefasste Eintrag wartet: ein gemeinsames
                       pending sperrte jeden Schalter der Liste, und der
                       gedrueckte verlore als disabled den Fokus an body
                       (Befund des frontend-reviewers). */
                    pending={
                      setStatus.isPending &&
                      setStatus.variables?.commentId === comment.id
                    }
                    onToggleStatus={(status) => {
                      setStatus.mutate(
                        { commentId: comment.id, status },
                        {
                          onSuccess: () =>
                            setAnnouncement(
                              t("comment.panel.announce.status", {
                                status: t(`comment.status.${status}`),
                              })
                            ),
                          onError: (error) =>
                            setAnnouncement(apiMessage(error)),
                        }
                      )
                    }}
                  />
                </li>
              ))}
            </ol>
          )}

          {allowedTypes !== null && (
            <>
              <hr />
              <CommentForm
                allowedTypes={allowedTypes}
                pending={create.isPending}
                error={create.error}
                authorName={user === null ? "" : fullNameOf(user)}
                onSubmit={(values, { reset, setFieldErrors }) => {
                  /* Vor dem Abschicken festhalten, womit verglichen wird:
                     danach traegt project.status womoeglich schon den neuen
                     Wert. */
                  const before = project.status
                  create.mutate(
                    { type: values.type, text: values.text },
                    {
                      onSuccess: () => {
                        reset()
                        setStatusAtRequest(
                          values.type === "CHANGE_REQUEST" ? before : null
                        )
                        setAnnouncement(t("comment.panel.announce.created"))
                      },
                      onError: setFieldErrors,
                    }
                  )
                }}
              />
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <span className="sr-only" role="status">
        {announcement}
      </span>
    </section>
  )
}

/** Nur ein Aenderungswunsch traegt einen Stand (§2.4). */
function isOpenChangeRequest(comment: CommentResponse): boolean {
  return comment.type === "CHANGE_REQUEST" && comment.status === "OPEN"
}

/*
 * Flaeche und Ton je Kommentartyp. Record ueber den Enum-Typ ohne
 * Standardzweig, wie im StatusBadge: ein vierter Contract-Typ bricht den
 * Typecheck, statt still ohne Kennzeichnung zu erscheinen.
 *
 * Die Farbe ist Zugabe und nie die Aussage: die Art steht als Wort in der
 * Kopfzeile des Eintrags (SC 1.4.1).
 */
/**
 * Ein erledigter Aenderungswunsch traegt die Flaeche des erledigten
 * Zustands, nicht mehr die des offenen (Nacharbeit an KAN-37). Vorher blieb
 * er rot, und eine abgehakte Liste sah aus wie eine unerledigte.
 */
const RESOLVED_SURFACE = "bg-status-published-bg text-status-published-fg"

const typeSurfaces: Record<CommentType, string> = {
  /*
   * Die Vorlage zeigt nur Notiz und Aenderung. Fuer die Antwort belegt sie
   * allein den aktiven Typ-Schalter (accent), und genau den nimmt der
   * Eintrag: eine andere Farbe waere geraten, und die beiden gehoeren
   * ohnehin zusammen.
   */
  REPLY: "bg-accent text-accent-foreground",
  NOTE: "bg-status-submitted-bg text-status-submitted-fg",
  CHANGE_REQUEST: "bg-status-revision-bg text-status-revision-fg",
}

/**
 * Ein Eintrag des Verlaufs: Person, Art, Text, Zeitpunkt und, bei einem
 * Aenderungswunsch, der Stand.
 */
function CommentItem({
  comment,
  mayToggleStatus,
  mayDelete,
  deletePending,
  pending,
  onToggleStatus,
  onDelete,
}: {
  comment: CommentResponse
  mayToggleStatus: boolean
  /** §6.1: die verfassende Person und die Administration. */
  mayDelete: boolean
  deletePending: boolean
  pending: boolean
  onToggleStatus: (status: CommentStatus) => void
  onDelete: () => void
}) {
  const { t, i18n } = useTranslation()
  const portfolioPath = usePortfolioPath()
  const origin = useBreadcrumbOrigin()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteTrigger = useRef<HTMLButtonElement | null>(null)

  /*
   * Ein erledigter Aenderungswunsch ist ein anderer Gegenstand als ein
   * offener: die Kopfzeile nennt deshalb nicht mehr die Art, sondern was
   * daraus geworden ist. Nur beim CHANGE_REQUEST, denn REPLY und NOTE
   * tragen keinen Erledigungsstatus (§2.4).
   */
  const resolvedChangeRequest =
    comment.type === "CHANGE_REQUEST" && comment.status === "RESOLVED"

  const timestamp = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(comment.createdAt))

  return (
    <Message>
      {/* Die Flaeche traegt die Textfarbe, die Kinder erben sie: die Vorlage
          setzt Name, Text, Zeitpunkt und Stand eines Eintrags in denselben
          Ton (Frame 109:2). Ein Rahmen entfaellt, in der Vorlage hat er die
          Farbe der Flaeche. */}
      <MessageContent
        className={cn(
          "gap-2 rounded-card px-3.5 py-3",
          resolvedChangeRequest ? RESOLVED_SURFACE : typeSurfaces[comment.type]
        )}
      >
        <MessageHeader className="justify-between gap-2 px-0 text-current">
          {/* Der Name fuehrt zum Portfolio der Person (KAN-80): auch im
              Kommentarstrang ist ein Name ein Weg zu ihr und nicht nur eine
              Beschriftung. Beim eigenen Namen ins eigene Portfolio
              (KAN-83). */}
          <Link
            to={portfolioPath(comment.author.id)}
            state={origin}
            className="type-body-sm truncate hover:underline focus-visible:underline"
          >
            {fullNameOf(comment.author)}
          </Link>
          <span className="type-label-xs flex shrink-0 items-center gap-1 tracking-wide uppercase">
            {resolvedChangeRequest
              ? t("comment.changeRequest.resolvedLabel")
              : t(`comment.type.${comment.type}`)}
            {mayDelete && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      ref={deleteTrigger}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={deletePending}
                      onClick={() => setConfirmDelete(true)}
                    />
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                  {/* Der Name nennt die verfassende Person: in einer Liste
                      stuenden sonst mehrere gleichnamige Knoepfe
                      untereinander (SC 2.4.6). */}
                  <span className="sr-only">
                    {t("comment.panel.delete.action", {
                      author: fullNameOf(comment.author),
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("comment.panel.delete.short")}
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </MessageHeader>

        <p className="type-body-sm whitespace-pre-wrap">{comment.text}</p>

        <MessageFooter className="justify-between gap-2 px-0 text-current">
          <span>{timestamp}</span>

          {/* Nur ein Aenderungswunsch traegt einen Stand (§2.4); an REPLY und
              NOTE gaebe es nichts umzuschalten, und der Server antwortete mit
              400 VALIDATION_FAILED (§6.1, Kommentare: ein eigener Fehlercode
              ist dafuer bewusst nicht vergeben). */}
          {comment.status !== null && comment.type === "CHANGE_REQUEST" && (
            <ChangeRequestStatus
              status={comment.status}
              mayToggle={mayToggleStatus}
              pending={pending}
              onToggle={onToggleStatus}
            />
          )}
        </MessageFooter>

        {/* Rueckfrage vor dem Loeschen: der Text ist danach weg, und ein
            Kommentar laesst sich nicht wiederherstellen. */}
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent
            className="rounded-modal"
            finalFocus={deleteTrigger}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("comment.panel.delete.title")}
              </AlertDialogTitle>
              {/* Der Gegenstand steht im Text und nicht nur im zugaenglichen
                  Namen des Ausloesers (Skill frontend-design, Abschnitt 5):
                  wer den Dialog aus der Tastaturbedienung heraus oeffnet,
                  liest sonst nur „der Kommentar" und weiss nicht, welcher. */}
              <AlertDialogDescription>
                {t("comment.panel.delete.description", {
                  author: fullNameOf(comment.author),
                  timestamp,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deletePending}
                onClick={() => {
                  setConfirmDelete(false)
                  onDelete()
                }}
              >
                {t("comment.panel.delete.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MessageContent>
    </Message>
  )
}

/**
 * Der Stand eines Aenderungswunsches, zugleich sein Umschalter.
 *
 * <p><strong>Das Wort ist der Schalter</strong>, kein zweiter Knopf daneben
 * (Nutzerentscheidung zur Nacharbeit an KAN-37). Wer nach §5 nicht
 * berechtigt ist, sieht dasselbe Wort als Text; die Anzeige bleibt also in
 * beiden Faellen dieselbe.
 *
 * <p><strong>Der zugaengliche Name nennt Stand und Handlung.</strong>
 * Sichtbar steht „Offen", vorgelesen wird „Offen, als erledigt markieren":
 * ein Schalter, dessen Beschriftung den Zustand traegt, sagt sonst nicht,
 * was ein Druck bewirkt (SC 2.4.6). Die Trefferflaeche ist ueber
 * {@code h-7} 28 CSS-Pixel hoch, also mehr als die geforderten 24
 * (SC 2.5.8); der negative Aussenabstand haelt die Zeile trotzdem auf
 * ihrer Linie.
 */
function ChangeRequestStatus({
  status,
  mayToggle,
  pending,
  onToggle,
}: {
  status: CommentStatus
  mayToggle: boolean
  pending: boolean
  onToggle: (next: CommentStatus) => void
}) {
  const { t } = useTranslation()
  const resolved = status === "RESOLVED"

  /*
   * Wer nicht umschalten darf, liest den Stand als Text. Fuer alle anderen
   * steht hier seit der Nacharbeit die Handlung und nicht der Stand: ein
   * blosses Wort „Offen" sah aus wie eine Angabe und nicht wie ein Schalter,
   * auch mit Unterstreichung beim Ueberfahren. Den Stand selbst tragen jetzt
   * die Kopfzeile und die Flaeche der Karte.
   */
  if (!mayToggle) {
    return (
      <span className="type-label-xs">{t(`comment.status.${status}`)}</span>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      /* aria-disabled statt disabled: ein disabled-Knopf verliert den Fokus
         an body, und die naechste Tabulatorreihe begaenne wieder oben. */
      aria-disabled={pending || undefined}
      onClick={() => {
        if (pending) {
          return
        }
        onToggle(resolved ? "OPEN" : "RESOLVED")
      }}
      /* dark:bg-transparent muss danebenstehen: bg-transparent und
         dark:bg-input/30 aus der erzeugten Datei liegen fuer tailwind-merge in
         verschiedenen Gruppen, und ohne die zweite Klasse laege im dunklen
         Modus ein input-Film ueber der Statusflaeche. */
      className="-my-1 h-7 bg-transparent aria-disabled:opacity-60 dark:bg-transparent"
    >
      {resolved ? (
        <RotateCcwIcon aria-hidden="true" />
      ) : (
        <CheckIcon aria-hidden="true" />
      )}
      {resolved ? t("comment.action.reopen") : t("comment.action.resolve")}
    </Button>
  )
}

/**
 * Das Formular: Typwahl als Pillen, Textfeld mit Restzeichenanzeige,
 * Sendeknopf.
 *
 * <p>Validiert ueber {@code react-hook-form} mit einem zod-Schema
 * (Frontend-Regel 12). Der Server bleibt verbindlich: sein 400
 * {@code VALIDATION_FAILED} erscheint am Feld, das er nennt.
 */
function CommentForm({
  allowedTypes,
  pending,
  error,
  authorName,
  onSubmit,
}: {
  allowedTypes: readonly [CommentType, ...CommentType[]]
  pending: boolean
  error: unknown
  /** Wer gerade schreibt; steht als Hinweis unter dem Feld. */
  authorName: string
  onSubmit: (
    values: CommentFormValues,
    handlers: {
      reset: () => void
      setFieldErrors: (error: unknown) => void
    }
  ) => void
}) {
  const { t } = useTranslation()
  const textId = useId()
  const counterId = useId()
  const hintId = useId()

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema(allowedTypes)),
    defaultValues: { type: allowedTypes[0], text: "" },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im Metadatenformular. */
  const text = useWatch({ control: form.control, name: "text" })
  const type = useWatch({ control: form.control, name: "type" })
  const failed =
    error !== null &&
    error !== undefined &&
    isApiError(error) &&
    error.errorCode !== "VALIDATION_FAILED"
      ? error
      : null

  const submit = form.handleSubmit((values) =>
    onSubmit(values, {
      reset: () => form.reset({ type: values.type, text: "" }),
      /*
       * Ein 400 VALIDATION_FAILED landet am genannten Feld und nicht als
       * Sammelmeldung darunter (Frontend-Regel 12, Skill frontend-api
       * Abschnitt 3). Der Server nennt "text" und "type" so, wie das
       * Formular sie fuehrt.
       */
      setFieldErrors: (error) => {
        if (isApiError(error) && error.errorCode === "VALIDATION_FAILED") {
          applyValidationErrors(
            error,
            ["text", "type"],
            /* Dieselbe Bruecke wie in den Auth-Formularen: der Helfer nimmt
               einen Feldnamen als Zeichenkette, react-hook-form seine
               Union. */
            (name, fieldError) =>
              form.setError(name as "text" | "type" | "root.server", fieldError)
          )
        }
      },
    })
  )

  /*
   * Enter sendet, Umschalt und Enter macht den Zeilenumbruch (KAN-83).
   * Umgedreht gegenueber KAN-20: dort war Enter der Umbruch und
   * Strg+Enter das Senden. Ein Kommentar ist in der Praxis meist einzeilig,
   * und der eingeuebte Griff aus jedem Chatfenster ist Enter.
   *
   * Strg+Enter und Cmd+Enter senden weiterhin mit, weil sie die Bedingung
   * ebenfalls erfuellen; die eingeuebte Belegung geht also nicht verloren,
   * und im Code steht dafuer kein zweiter Zweig.
   *
   * isComposing ist kein Beiwerk: eine ostasiatische Eingabemethode
   * schliesst ihr Auswahlfenster mit Enter ab. Ohne diese Abfrage schickte
   * genau dieser Tastendruck den halben Satz ab.
   */
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    void submit()
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      {/* Nur eine Wahl, wenn es etwas zu waehlen gibt: im Editor bleibt es
          bei der Antwort, und eine Gruppe mit einem Knopf waere ein Ziel
          ohne Zweck. */}
      {allowedTypes.length > 1 && (
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <ToggleGroup
              value={[field.value]}
              onValueChange={(next) => {
                /*
                 * Base UI hebt den Druck auf, wenn das aktive Segment
                 * erneut betaetigt wird; die Liste ist dann leer. Ein
                 * Formular ohne Typ ist kein Zustand: die Wahl bleibt
                 * stehen, wie im Statusfilter.
                 */
                const chosen = next.at(-1)
                if (chosen !== undefined) {
                  field.onChange(chosen)
                }
              }}
              size="sm"
              aria-label={t("comment.form.typeLabel")}
              className="flex flex-wrap gap-2"
            >
              {allowedTypes.map((entry) => (
                <ToggleGroupItem
                  key={entry}
                  value={entry}
                  /* Vorlage Frame 109:183: Radius pill, aktiv accent ohne
                     Rahmen, inaktiv durchsichtig mit Rahmen. Die Modifikatoren
                     stehen wie in der erzeugten Datei (aria-pressed,
                     data-[state=on]), damit tailwind-merge sie gegen deren
                     Vorgabe aufloest. */
                  className={cn(
                    "rounded-pill border border-border bg-transparent px-3.5 text-muted-foreground",
                    /* Die gedrueckte Pille traegt zusaetzlich Rahmen und
                       Fettung: die Flaeche accent unterscheidet sich nur um
                       1,2:1 von der Karte, die Auswahl haengt sonst allein
                       an der Textfarbe (SC 1.4.11, Befund des
                       frontend-reviewers). */
                    "aria-pressed:border-accent-foreground aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-foreground",
                    "data-[state=on]:border-accent-foreground data-[state=on]:bg-accent data-[state=on]:font-semibold data-[state=on]:text-accent-foreground"
                  )}
                >
                  {t(`comment.type.${entry}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      )}

      {/* Der Server nennt "type" als Feld, wenn die Art zu seiner Sicht nicht
          passt; ohne diese Zeile passierte fuer die schreibende Person
          sichtbar nichts. */}
      {form.formState.errors.type?.message && (
        <FieldError>{t(form.formState.errors.type.message)}</FieldError>
      )}

      <Field data-invalid={form.formState.errors.text ? true : undefined}>
        <FieldLabel htmlFor={textId} className="sr-only">
          {t("comment.form.textLabel")}
        </FieldLabel>
        <Textarea
          id={textId}
          rows={3}
          /* Der Platzhalter nennt die gewaehlte Art und steht im Feld. Die
             Vorlage zeichnet ihn unter dem Feld neben dem Sendeknopf; das
             ist die Zeichnung eines leeren Modells, nicht die Aufgabe eines
             Platzhalters. Die Geometrie darunter folgt ihr trotzdem: eine
             Zeile mit Angabe links und Sendeknopf rechts. */
          placeholder={t(`comment.form.placeholder.${type}`)}
          aria-describedby={`${counterId} ${hintId}`}
          {...form.register("text")}
          onKeyDown={onKeyDown}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CharacterCounter
            id={counterId}
            value={text}
            max={COMMENT_TEXT_MAX}
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            disabled={pending}
            aria-label={t("comment.form.submit")}
            className="rounded-pill"
          >
            <SendIcon aria-hidden="true" />
          </Button>
        </div>
        <p id={hintId} className="type-label-xs text-muted-foreground">
          {t("comment.form.hint", {
            name: authorName,
            shortcut: t("comment.form.shortcut"),
          })}
        </p>
        {form.formState.errors.text?.message && (
          <FieldError>{t(form.formState.errors.text.message)}</FieldError>
        )}
      </Field>

      {/* Was applyValidationErrors keinem Feld zuordnen konnte, landet in
          root.server. Ohne diese Meldung verschwaende es (Skill frontend-api,
          Abschnitt 3, wie in den Auth-Formularen). */}
      {form.formState.errors.root?.server?.message && (
        <ErrorState message={t(form.formState.errors.root.server.message)} />
      )}

      {failed !== null && <ErrorState error={failed} />}
    </form>
  )
}
