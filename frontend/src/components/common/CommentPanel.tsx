import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  MessageSquareIcon,
  ReplyIcon,
  SendIcon,
  StickyNoteIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type {
  CommentResponse,
  CommentStatus,
  CommentType,
  ProjectDetailResponse,
} from "@/api/types"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import {
  COMMENT_TEXT_MAX,
  commentFormSchema,
  type CommentFormValues,
} from "@/components/common/CommentForm.schema"
import {
  creatableTuple,
  maySetChangeRequestStatus,
} from "@/components/common/commentPermissions"
import { EmptyState } from "@/components/common/EmptyState"
import { RoleBadge } from "@/components/common/RoleBadge"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  useComments,
  useCreateComment,
  useSetCommentStatus,
} from "@/features/comments/hooks/useComments"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Die Kommentarspalte (§2.3, §2.4, §3.5, §6.1; KAN-37), die
 * <strong>einzige</strong> Kommentardarstellung im Repository.
 *
 * <p><strong>Zwei Orte, ein Baustein.</strong> Sie steht im Review-Modus
 * und im Editor. Zwei Abschriften liefen auseinander, sobald ein
 * Kommentartyp, ein Stand oder eine Barrierefreiheitszusage dazukommt, und
 * die Autor:in saehe ihre Aenderungswuensche dann anders als die Redaktion
 * sie geschrieben hat.
 *
 * <p><strong>Die drei Typen sind ohne Farbwahrnehmung unterscheidbar</strong>
 * (SC 1.4.1): jeder traegt Symbol und Beschriftung, die Flaechenfarbe ist
 * Zugabe. Dasselbe gilt fuer den Stand eines Aenderungswunsches.
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
 * <p><strong>Den Stand eines Aenderungswunsches schaltet jede Person um,
 * die §5 dazu berechtigt</strong>, also Projektseite, Redaktion und
 * Administration, und zwar in beide Richtungen: §2.4 begruendet den
 * Rueckweg damit, dass die Redaktion ein zu frueh gesetztes
 * {@code RESOLVED} wieder oeffnen kann, ohne dafuer einen neuen Kommentar
 * schreiben zu muessen. Der Umschalter wird aus der Rolle abgeleitet und
 * nicht ueber eine Prop gesteuert; er erscheint ausschliesslich an einem
 * {@code CHANGE_REQUEST}, weil nur der einen Stand traegt.
 *
 * <p><strong>Offene Aenderungswuensche stehen oben.</strong> Sie sind der
 * Arbeitsauftrag, und in {@code REVISION} beginnt die Spalte deshalb
 * aufgeklappt. Der Rest folgt in der Reihenfolge des Verlaufs.
 *
 * <p><strong>Der Eintrag komponiert bewusst nicht die Primitive
 * {@code item}.</strong> Sie modelliert eine Zeile aus Medien-, Inhalts- und
 * Aktionsbereich; ein Kommentar ist eine Flaeche mit typabhaengigem
 * Hintergrund, einer Kopfzeile aus Name, Rolle und Typ, einem
 * mehrzeiligen Text und einer Fusszeile aus Zeitpunkt, Stand und
 * Umschalter. Das in {@code ItemContent} zu pressen hiesse, gegen die
 * Primitive zu arbeiten statt mit ihr. Die Nominierungszeilen daneben
 * ({@code NominationCards}) passen dagegen genau und benutzen sie. Die
 * Frage ist entschieden und nicht uebersehen (Befund aus KAN-7, geprueft
 * im Review zu KAN-37).
 */
export function CommentPanel({
  project,
  context = "review",
  className,
}: {
  project: ProjectDetailResponse
  /**
   * Der Ort. Im Editor entsteht allein eine Antwort; im Review-Modus
   * entscheidet die Rolle nach §5.
   */
  context?: "review" | "editor"
  className?: string
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const projectId = project.id

  const comments = useComments(projectId)
  const create = useCreateComment(projectId)
  const setStatus = useSetCommentStatus(projectId)

  const entries = comments.data ?? []
  const openChangeRequests = entries.filter(isOpenChangeRequest)
  const ordered = [
    ...openChangeRequests,
    ...entries.filter((entry) => !isOpenChangeRequest(entry)),
  ]

  /*
   * In REVISION aufgeklappt: dort sind die offenen Aenderungswuensche der
   * Arbeitsauftrag, und eine zugeklappte Spalte verstuende sich als
   * Nebensache. Sonst folgt die Spalte dem Template und beginnt offen im
   * Review-Modus, im Editor dagegen zugeklappt, damit die Schreibflaeche
   * die Seite behaelt.
   */
  const [open, setOpen] = useState(
    project.status === "REVISION" || context === "review"
  )

  /*
   * Eine Ansage je Vorgang, getrennt von der Liste: ein neuer Kommentar und
   * ein umgeschalteter Stand aendern die Liste weiter unten im Dokument,
   * und ohne Live-Region bliebe beides fuer Screenreader unbemerkt
   * (SC 4.1.3).
   */
  const [announcement, setAnnouncement] = useState("")

  const allowedTypes = creatableTuple(user?.role, context)
  const mayToggleStatus = maySetChangeRequestStatus(
    project,
    user === null ? null : { id: user.id, role: user.role }
  )

  return (
    <aside
      aria-label={t("comment.panel.label")}
      className={cn("flex flex-col gap-2", className)}
    >
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Collapsible open={open} onOpenChange={setOpen}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="type-body-sm flex items-center gap-2 font-semibold">
                <MessageSquareIcon
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                {t("comment.panel.title")}
                {openChangeRequests.length > 0 && (
                  <span className="type-label-xs flex items-center gap-1 text-pill-danger-fg">
                    <AlertCircleIcon aria-hidden="true" className="size-3.5" />
                    {t("comment.panel.openCount", {
                      count: openChangeRequests.length,
                    })}
                  </span>
                )}
              </h2>
              <CollapsibleTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      open
                        ? t("comment.panel.collapse")
                        : t("comment.panel.expand")
                    }
                  />
                }
              >
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn("transition-transform", open && "rotate-180")}
                />
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="flex flex-col gap-4 pt-4">
              {comments.isPending && (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-20 w-full rounded-control" />
                  <Skeleton className="h-20 w-full rounded-control" />
                </div>
              )}

              {/* Ein fehlgeschlagenes Umschalten blieb sonst unsichtbar: der
                  Stand aendert sich schlicht nicht (Befund des
                  frontend-reviewers). */}
              {setStatus.error !== null && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {isApiError(setStatus.error)
                      ? t(apiErrorMessageKey(setStatus.error), {
                          defaultValue: setStatus.error.message,
                        })
                      : t("apiError.INTERNAL_ERROR")}
                  </AlertTitle>
                </Alert>
              )}

              {comments.error !== null && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {isApiError(comments.error)
                      ? t(apiErrorMessageKey(comments.error), {
                          defaultValue: comments.error.message,
                        })
                      : t("apiError.INTERNAL_ERROR")}
                  </AlertTitle>
                </Alert>
              )}

              {comments.data !== undefined && ordered.length === 0 && (
                <EmptyState
                  headingLevel={3}
                  icon={<MessageSquareIcon aria-hidden="true" />}
                  title={t("comment.panel.empty.title")}
                  description={t("comment.panel.empty.description")}
                />
              )}

              {ordered.length > 0 && (
                <ol className="flex flex-col gap-3">
                  {ordered.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      mayToggleStatus={mayToggleStatus}
                      pending={setStatus.isPending}
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
                              setAnnouncement(
                                isApiError(error)
                                  ? t(apiErrorMessageKey(error), {
                                      defaultValue: error.message,
                                    })
                                  : t("apiError.INTERNAL_ERROR")
                              ),
                          }
                        )
                      }}
                    />
                  ))}
                </ol>
              )}

              {allowedTypes !== null && (
                <CommentForm
                  allowedTypes={allowedTypes}
                  pending={create.isPending}
                  error={create.error}
                  onSubmit={(values, reset) => {
                    create.mutate(
                      { type: values.type, text: values.text },
                      {
                        onSuccess: () => {
                          reset()
                          setAnnouncement(t("comment.panel.announce.created"))
                        },
                      }
                    )
                  }}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <span className="sr-only" role="status">
        {announcement}
      </span>
    </aside>
  )
}

/** Nur ein Aenderungswunsch traegt einen Stand (§2.4). */
function isOpenChangeRequest(comment: CommentResponse): boolean {
  return comment.type === "CHANGE_REQUEST" && comment.status === "OPEN"
}

/**
 * Symbol je Kommentartyp. Zusammen mit der Beschriftung ist der Typ damit
 * ohne Farbwahrnehmung erkennbar (SC 1.4.1); die Flaechenfarbe wiederholt
 * die Aussage nur.
 *
 * Record ueber den Enum-Typ ohne Standardzweig, wie im StatusBadge: ein
 * vierter Contract-Typ bricht den Typecheck, statt still ohne Symbol zu
 * erscheinen.
 */
const typeIcons: Record<CommentType, typeof ReplyIcon> = {
  REPLY: ReplyIcon,
  NOTE: StickyNoteIcon,
  CHANGE_REQUEST: AlertCircleIcon,
}

const typeSurfaces: Record<CommentType, string> = {
  REPLY: "bg-muted",
  NOTE: "bg-pill-warning-bg",
  CHANGE_REQUEST: "bg-pill-danger-bg",
}

/**
 * Ein Eintrag des Verlaufs: Person, Rolle, Typ, Text, Zeitpunkt und, bei
 * einem Aenderungswunsch, der Stand samt Umschalter.
 *
 * <p>Die Rolle steht an jedem Eintrag, weil {@code REPLY} beide Seiten
 * schreiben: ohne sie liesse sich einer Rueckmeldung nicht ansehen, ob sie
 * aus der Redaktion kommt (§6.1 fuehrt {@code role} genau deswegen mit).
 */
function CommentItem({
  comment,
  mayToggleStatus,
  pending,
  onToggleStatus,
}: {
  comment: CommentResponse
  mayToggleStatus: boolean
  pending: boolean
  onToggleStatus: (status: CommentStatus) => void
}) {
  const { t, i18n } = useTranslation()
  const TypeIcon = typeIcons[comment.type]

  const timestamp = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(comment.createdAt))

  const resolved = comment.status === "RESOLVED"

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-control p-3",
        typeSurfaces[comment.type]
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body-sm font-semibold">
            {fullNameOf(comment.author)}
          </span>
          <RoleBadge role={comment.author.role} />
        </div>
        <span className="type-label-xs flex items-center gap-1 font-medium tracking-wide uppercase">
          <TypeIcon aria-hidden="true" className="size-3.5" />
          {t(`comment.type.${comment.type}`)}
        </span>
      </div>

      <p className="type-body-sm whitespace-pre-wrap">{comment.text}</p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-label-xs text-muted-foreground">{timestamp}</span>

        {/* Nur ein Aenderungswunsch traegt einen Stand (§2.4); an REPLY und
            NOTE gaebe es nichts umzuschalten, und der Server antwortete mit
            409. */}
        {comment.status !== null && comment.type === "CHANGE_REQUEST" && (
          <span className="flex items-center gap-2">
            <span className="type-label-xs flex items-center gap-1 font-medium">
              {resolved ? (
                <CheckCircle2Icon aria-hidden="true" className="size-3.5" />
              ) : (
                <AlertCircleIcon aria-hidden="true" className="size-3.5" />
              )}
              {t(`comment.status.${comment.status}`)}
            </span>
            {mayToggleStatus && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onToggleStatus(resolved ? "OPEN" : "RESOLVED")}
              >
                {resolved
                  ? t("comment.action.reopen")
                  : t("comment.action.resolve")}
              </Button>
            )}
          </span>
        )}
      </div>
    </li>
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
  onSubmit,
}: {
  allowedTypes: readonly [CommentType, ...CommentType[]]
  pending: boolean
  error: unknown
  onSubmit: (values: CommentFormValues, reset: () => void) => void
}) {
  const { t } = useTranslation()
  const textId = useId()
  const counterId = useId()

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema(allowedTypes)),
    defaultValues: { type: allowedTypes[0], text: "" },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im Metadatenformular. */
  const text = useWatch({ control: form.control, name: "text" })
  const failed =
    error !== null && error !== undefined && isApiError(error) ? error : null

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit((values) =>
        onSubmit(values, () => form.reset({ type: values.type, text: "" }))
      )}
    >
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
              spacing={0}
              aria-label={t("comment.form.typeLabel")}
              className="max-w-full flex-wrap rounded-control border bg-muted p-1"
            >
              {allowedTypes.map((type) => (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  className="rounded-control px-3 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm data-[state=on]:bg-card"
                >
                  {t(`comment.type.${type}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      )}

      <Field data-invalid={form.formState.errors.text ? true : undefined}>
        <FieldLabel htmlFor={textId} className="sr-only">
          {t("comment.form.textLabel")}
        </FieldLabel>
        <Textarea
          id={textId}
          rows={4}
          placeholder={t("comment.form.placeholder")}
          aria-describedby={counterId}
          {...form.register("text")}
        />
        <CharacterCounter id={counterId} value={text} max={COMMENT_TEXT_MAX} />
        {form.formState.errors.text?.message && (
          <FieldError>{t(form.formState.errors.text.message)}</FieldError>
        )}
      </Field>

      {failed !== null && (
        <Alert variant="destructive">
          <AlertTitle>
            {t(apiErrorMessageKey(failed), { defaultValue: failed.message })}
          </AlertTitle>
        </Alert>
      )}

      <Button type="submit" disabled={pending} className="self-end">
        <SendIcon aria-hidden="true" />
        {t("comment.form.submit")}
      </Button>
    </form>
  )
}
