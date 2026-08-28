import { LockIcon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

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
import { EmptyState } from "@/components/common/EmptyState"
import { useEditLock } from "@/features/project-content/hooks/useEditLock"

/**
 * Laesst die Schreibansicht eines Projekts nur entstehen, wenn diese
 * Sitzung die Bearbeitungssperre haelt (§6.9, KAN-86).
 *
 * <p><strong>Die Pruefung sitzt hier und nicht an den Knoepfen, die in den
 * Editor fuehren.</strong> Dorthin fuehren mehrere Wege: die Projektkachel
 * unter „Mein Portfolio", der Schalter auf der Detailseite, der Weg von der
 * Metadatenseite zurueck, dazu Lesezeichen und die eingetippte Adresse. Eine
 * Pruefung je Knopf liesse den direkten Aufruf offen und liefe an vier
 * Stellen auseinander; an der Route laufen sie alle zusammen.
 *
 * <p><strong>Zwei Faelle, zwei Darstellungen, und der Unterschied ist
 * wesentlich.</strong>
 *
 * <ul>
 * <li><em>Noch nie hineingekommen:</em> die Kinder entstehen gar nicht erst.
 * Eine Zustandsflaeche sagt, wer haelt. Eine ausgegraute Schreibflaeche waere
 * die schlechtere Loesung: sie baut den ganzen Editor auf, laedt seinen
 * Inhalt und laedt dazu ein, es doch zu versuchen.</li>
 * <li><em>Sperre unterwegs verloren:</em> die Kinder <strong>bleiben
 * stehen</strong>, der Hinweis legt sich als Dialog darueber. Wuerde das
 * Gatter auch hier abraeumen, verschwaende es die Schreibflaeche samt
 * ungespeichertem Text, und die Fehlermeldung des letzten Speicherversuchs
 * ginge mit ihr unter (Skill frontend-design, Abschnitt 5: der Ausgang
 * gehoert an eine Stelle, die danach noch sichtbar ist). Genau dieser Fall
 * tritt ein, wenn ein Hintergrundtab gedrosselt wird, der Rechner schlaeft
 * oder das Netz wechselt: die Frist aus §6.9 laeuft dann ab, obwohl die
 * Person noch am Text sitzt.</li>
 * </ul>
 *
 * <p><strong>Ein Fehler beim Beanspruchen sperrt nicht.</strong> Gibt es das
 * Projekt nicht (404), gehoert die Person nicht dazu (403) oder ist der
 * Status nicht mehr bearbeitbar (409), rendert das Gatter seine Kinder: die
 * Seite dahinter zeigt dann ihre eigene Meldung oder ihre read-only Ansicht,
 * und die Entscheidung darueber faellt ohnehin im Server (§5). Gesperrt wird
 * allein, wenn jemand anders die Sperre haelt.
 *
 * <p><strong>Der Takt laeuft weiter, waehrend der Hinweis steht.</strong>
 * Wird die Sperre frei, verschwindet er von selbst und die Seite erscheint,
 * ohne dass jemand etwas anklickt.
 */
export function EditLockGate({
  projectId,
  fallback,
  children,
}: {
  projectId: string
  /**
   * Was zu sehen ist, solange die erste Antwort aussteht. Die Seite gibt
   * ihren eigenen Ladeumriss herein, damit der Wechsel nicht springt.
   */
  fallback: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  const lock = useEditLock(projectId)

  /*
   * Ob diese Montierung die Sperre je gehalten hat. Ein Zustand und kein
   * Ref: die Antwort entscheidet, was gerendert wird, und ein waehrend des
   * Renderns beschriebener Ref waere genau die Nebenwirkung, vor der React
   * warnt. Das zusaetzliche Rendern kostet nichts: im Augenblick des
   * Wechsels ist {@code blockedBy} ohnehin {@code null}, es wird also in
   * beiden Durchgaengen dasselbe gezeigt.
   */
  const [entered, setEntered] = useState(false)
  if (!entered && lock.heldBySelf) {
    /* Der von React vorgesehene Weg, Zustand aus einem Wechsel abzuleiten
       ("adjusting state while rendering"): React rendert diese Komponente
       sofort noch einmal, ohne den DOM anzufassen. Ein Effekt taete
       dasselbe eine Bildwiederholung spaeter und mit einem sichtbaren
       Zwischenzustand. */
    setEntered(true)
  }

  /*
   * Der Weg hinaus fuehrt auf die Detailseite dieses Projekts und nicht
   * ueber die Browserhistorie zurueck: wer die Adresse eingetippt oder ein
   * Lesezeichen benutzt hat, landete damit auf einer fremden Seite oder gar
   * keiner. Die Detailseite gibt es immer, und wer bis hierher gekommen ist,
   * darf sie lesen.
   */
  const leave = () => {
    void navigate(`/projects/${projectId}`)
  }

  if (!entered) {
    if (lock.pending) {
      return fallback
    }
    if (lock.blockedBy !== null) {
      return (
        <BlockedNotice
          holder={lock.blockedBy}
          busy={lock.retrying}
          onRetry={lock.retry}
          onLeave={leave}
        />
      )
    }
    return children
  }

  return (
    <>
      {children}
      {lock.blockedBy !== null && (
        <LostLockDialog
          /* Geht die Sperre erneut verloren, nachdem der Hinweis weggeklickt
             wurde, entsteht er neu und steht wieder offen: der Zustand ist
             ein neuer, auch wenn der Name derselbe ist. */
          key={`${lock.blockedBy.userId}-${lock.blockedBy.since}`}
          holder={lock.blockedBy}
          busy={lock.retrying}
          onRetry={lock.retry}
          onLeave={leave}
        />
      )}
    </>
  )
}

type Holder = {
  firstName: string
  lastName: string
  since: string
}

function nameOf(holder: Holder): string {
  return `${holder.firstName} ${holder.lastName}`.trim()
}

/**
 * Formuliert den Beginn der Sperre als Uhrzeit (§6.9: {@code since} ist der
 * Beginn und nicht der letzte Herzschlag). Ohne ihn stuende im Hinweis nur
 * ein Name, und die Frage „seit wann warte ich hier" bliebe offen.
 */
function useSince(holder: Holder): string {
  const { i18n } = useTranslation()
  const parsed = new Date(holder.since)
  return Number.isNaN(parsed.getTime())
    ? ""
    : new Intl.DateTimeFormat(i18n.language, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed)
}

/**
 * Der Zustand „gerade belegt", bevor die Schreibansicht je gestanden hat.
 *
 * <p>Eine Zustandsflaeche und kein Dialog: dahinter ist nichts, was sich
 * ansehen liesse. Ein modaler Kasten ueber einer leeren Seite liesse die
 * {@code main}-Landmarke ohne Ueberschrift und den Fokus beim Schliessen
 * ins Nichts fallen; {@code EmptyState} traegt die Ebene 1 und den Weg
 * hinaus (Skill frontend-shadcn, Abschnitt 1).
 */
function BlockedNotice({
  holder,
  busy,
  onRetry,
  onLeave,
}: {
  holder: Holder
  busy: boolean
  onRetry: () => void
  onLeave: () => void
}) {
  const { t } = useTranslation()
  const since = useSince(holder)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <EmptyState
        headingLevel={1}
        icon={<LockIcon aria-hidden="true" />}
        title={t("projectContent.editLock.title")}
        description={t("projectContent.editLock.description", {
          name: nameOf(holder),
          since,
        })}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" onClick={onLeave}>
              {t("projectContent.editLock.leave")}
            </Button>
            <Button onClick={onRetry} disabled={busy}>
              {t("projectContent.editLock.retry")}
            </Button>
          </div>
        }
      />
      {/*
       * Der Ausgang des Versuchs wird angesagt (SC 4.1.3): sichtbar aendert
       * sich nichts, wenn die andere Person weiterhin haelt, und ohne
       * Ansage waere der Knopf fuer Hilfsmittel wirkungslos.
       */}
      <p role="status" className="sr-only">
        {busy
          ? t("projectContent.editLock.retrying")
          : t("projectContent.editLock.stillHeld", { name: nameOf(holder) })}
      </p>
    </div>
  )
}

/**
 * Die Sperre ist waehrend der Arbeit weggefallen: die Schreibflaeche steht
 * noch, was darin steht, geht aber nicht mehr zum Server.
 *
 * <p>Hier ist der Dialog richtig, anders als beim Zustand davor: hinter ihm
 * liegt der eigene Text, und er ist der Grund, warum die Seite nicht
 * abgeraeumt wird. Er hat einen Trigger-losen Aufbau und deshalb ein
 * {@code finalFocus}, sonst faellt der Fokus beim Schliessen auf
 * {@code body} (SC 2.4.3).
 */
function LostLockDialog({
  holder,
  busy,
  onRetry,
  onLeave,
}: {
  holder: Holder
  busy: boolean
  onRetry: () => void
  onLeave: () => void
}) {
  const { t } = useTranslation()
  const since = useSince(holder)
  const [open, setOpen] = useState(true)
  const anchorRef = useRef<HTMLSpanElement>(null)

  return (
    <>
      <span ref={anchorRef} tabIndex={-1} className="sr-only" />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          className="rounded-modal"
          finalFocus={anchorRef as React.RefObject<HTMLElement>}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("projectContent.editLock.lostTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectContent.editLock.lostDescription", {
                name: nameOf(holder),
                since,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onLeave}>
              {t("projectContent.editLock.leave")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onRetry} disabled={busy}>
              {t("projectContent.editLock.retry")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
