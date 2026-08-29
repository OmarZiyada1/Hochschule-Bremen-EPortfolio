import gsap from "gsap"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import type { ProjectStatus } from "@/api/types"
import { ClapIcon } from "@/components/common/ClapIcon"
import { ErrorState } from "@/components/common/ErrorState"
import { Button } from "@/components/ui/button"
import { useProjectReaction } from "@/features/projects/hooks/useProjectDetail"
import { cn } from "@/lib/utils"

/**
 * Reaktionszaehler am Kopf der Metadaten-Seitenleiste (Figma
 * "Projektdetail", Knoten "rh"; KAN-32).
 *
 * <p><strong>Zaehler und Schaltflaeche sind dasselbe Element.</strong> Die
 * Vorlage zeigt an dieser Stelle Hand und Zahl und darunter nichts weiter;
 * ein zweiter, breiter Knopf waere ein Bedienelement, das die Vorlage nicht
 * kennt. Angeklickt wird deshalb das Symbol samt Ziffer.
 *
 * <p><strong>Der eigene Reaktionszustand kommt seit Contract v84 vom
 * Server</strong> ({@code ProjectDetailResponse.hasReacted}, §3.10). Bis
 * dahin war er eine benannte Grenze: die Schaltflaeche merkte sich die
 * eigene Aktion nur innerhalb der geoeffneten Seite und stand nach jedem
 * Neuladen wieder neutral da. Mit zwei verschiedenen Symbolen fuer die
 * beiden Zustaende (KAN-83) waere das keine Zurueckhaltung mehr, sondern
 * eine falsche Auskunft: das offene Symbol hiesse „noch nicht geklatscht",
 * obwohl es das nicht wusste.
 *
 * <p>Der Serverwert ist der Ausgangswert, danach fuehrt der Klick. Ein
 * {@code useEffect}, der bei jeder Antwort nachzoege, machte aus dem
 * Optimismus des Klicks ein Flackern.
 *
 * <p>Beide Richtungen sind idempotent und liefern den gueltigen Zaehler
 * (§6.1), ein zweiter Klick ist also kein Fehler. Der Zaehler folgt immer
 * der Antwort und wird nie im Client hochgezaehlt.
 *
 * <p><strong>Das Klatschen wird gespielt, nicht nur gefaerbt.</strong> Beim
 * Reagieren poppt das Symbol auf und federt aus (GSAP). Seit KAN-83 ist das
 * eine Bewegung des ganzen Symbols und nicht mehr die dreiteilige aus
 * linker Hand, rechter Hand und Funkenkranz: das Symbol ist eine maskierte
 * Rastergrafik (siehe {@link ClapIcon}) und hat kein Innenleben, an dem eine
 * Bewegung ansetzen koennte. Bewegt wird deshalb das Element, das die Marke
 * {@code data-clap} traegt, und keine Kindposition: eine Animation, die an
 * der Reihenfolge von Kindknoten haengt, bricht beim naechsten Feinschliff
 * still.
 *
 * <p>Gespielt wird nur beim Setzen der Reaktion. Das Zuruecknehmen ist eine
 * Korrektur und keine Zustimmung; sie zu feiern waere die falsche Geste.
 * Unter {@code prefers-reduced-motion: reduce} entfaellt die Bewegung ganz
 * (SC 2.3.3), der Zustand bleibt dann allein an Fuellung und Farbe erkennbar.
 *
 * <p>Ohne Anmeldung ist die Schaltflaeche nicht bedienbar und nennt den
 * Grund, statt einen 401 zu erzeugen: §5 gibt der Zeile „Reaktion geben"
 * bei PUBLIC ein Kreuz. Gesperrt wird ueber {@code disabled} und nicht durch
 * Weglassen, damit die Zahl ihren Platz behaelt.
 */
export function ReactionPanel({
  projectId,
  reactionCount,
  hasReacted,
  status,
}: {
  projectId: string
  /** Zaehler aus der Detailantwort (§3.10). Fehlt er, zeigt die Seite 0. */
  reactionCount: number
  /**
   * Hat die lesende Person selbst schon reagiert (§3.10, seit Contract v84)?
   * Ohne Anmeldung immer {@code false}.
   */
  hasReacted: boolean
  /** Projektstatus (§2.2); reagieren laesst sich nur auf PUBLISHED (§3.10). */
  status: ProjectStatus | undefined
}) {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { add, remove } = useProjectReaction(projectId)

  /*
   * Der Serverwert als Ausgangswert, danach fuehrt der Klick (§3.10, seit
   * Contract v84). useState und nicht die URL: der eigene Reaktionszustand
   * ist keine teilbare Ansicht wie Filter und Seitenzahl (KAN-31).
   */
  const [reacted, setReacted] = useState(hasReacted)

  /* Ein span und kein svg, seit das Symbol eine maskierte Rastergrafik ist
     (KAN-83, siehe ClapIcon). */
  const iconRef = useRef<HTMLSpanElement>(null)

  /* Laeuft eine Animation noch, wenn die Seite verlassen wird, schriebe GSAP
     weiter auf abgeraeumte Knoten. */
  useEffect(() => {
    const icon = iconRef.current
    return () => {
      if (icon !== null) {
        gsap.killTweensOf(icon)
      }
    }
  }, [])

  /**
   * Spielt das Klatschen: das Symbol zuckt kurz zusammen, poppt auf und
   * federt aus. Findet sich das Symbol nicht oder ist Bewegung abbestellt,
   * passiert nichts; die Reaktion selbst haengt nicht daran.
   */
  function playClap(): void {
    /* Das Symbol traegt seine Marke data-clap="icon" selbst und hat kein
       Innenleben mehr, an dem eine Bewegung ansetzen koennte: die Grafik ist
       eine Maske und kein Pfadbaum. Deshalb wird hier kein Kind mehr gesucht,
       sondern das Element bewegt, auf das die Referenz zeigt. */
    const icon = iconRef.current
    if (icon === null) {
      return
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    /* Ein zweiter Klick setzt neu an, statt zwei Zeitleisten uebereinander
       laufen zu lassen. Der Drehpunkt ist die Mitte des Symbols, damit es an
       Ort und Stelle waechst und nicht aus dem Zaehler herauswandert. An
       einem HTML-Element heisst das transformOrigin; svgOrigin, das bis
       KAN-83 hier stand, ist eine SVG-Eigenschaft von GSAP und bliebe an
       einem span wirkungslos. */
    gsap.killTweensOf(icon)
    gsap.set(icon, { scale: 1, rotate: 0, transformOrigin: "center" })

    const tl = gsap.timeline()
    /* Erst ein kurzes Ausholen nach innen, dann der Schlag nach aussen:
       ohne die Gegenbewegung wirkt ein reines Groesserwerden traege. */
    tl.to(icon, { scale: 0.86, duration: 0.09, ease: "power3.in" })
      .to(icon, { scale: 1.22, rotate: -6, duration: 0.11, ease: "power2.out" })
      .to(icon, {
        scale: 1,
        rotate: 0,
        duration: 0.42,
        ease: "elastic.out(1, 0.5)",
      })
  }

  const count = reactionCount
  const pending = add.isPending || remove.isPending

  /*
   * §3.10 fuehrt Reaktionen ausdruecklich auf ein veroeffentlichtes Projekt,
   * und der Server setzt das durch (mayReact: angemeldet UND PUBLISHED, sonst
   * 403 NO_PERMISSION). Ohne diese Bedingung boete die Seite der Autor:in am
   * eigenen Entwurf einen Knopf an, dessen Klick nur einen Fehler ergibt.
   */
  const published = status === "PUBLISHED"
  const failed = add.error ?? remove.error
  const reasonId = useId()
  const blocked = !isAuthenticated || !published

  function toggle(): void {
    if (reacted) {
      remove.mutate(undefined, { onSuccess: () => setReacted(false) })
    } else {
      /* Sofort, nicht erst im onSuccess: die Geste gehoert an den Klick.
         Scheitert der Request, meldet das die Fehlerflaeche darunter; eine
         Animation, die auf die Antwort wartet, laeuft gefuehlt zu spaet. */
      playClap()
      add.mutate(undefined, { onSuccess: () => setReacted(true) })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-overline text-muted-foreground">
          {t("project.detail.reactions.heading")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          disabled={blocked || pending}
          /*
           * Ein disabled-Knopf ist nicht fokussierbar; ohne diese Verbindung
           * erfuehre eine Tastaturbedienung den Grund nur, wenn sie zufaellig
           * am Absatz darunter vorbeikaeme.
           */
          aria-describedby={blocked ? reasonId : undefined}
          /*
           * Der zugaengliche Name traegt den Zaehler mit, denn sichtbar steht
           * neben dem Symbol nur die Ziffer. aria-pressed macht den Zustand
           * hoerbar, statt ihn allein ueber Farbe und Fuellung zu tragen
           * (SC 1.4.1).
           */
          aria-pressed={reacted}
          aria-label={t(
            reacted
              ? "project.detail.reactions.remove"
              : "project.detail.reactions.add",
            { count }
          )}
          /*
           * Gesperrt bleibt die Ziffer voll lesbar: sie ist an dieser Stelle
           * auch Anzeige und nicht nur die Beschriftung einer Handlung. Der
           * Zustand laeuft ueber Fuellung und Textfarbe; eine ausgefuellte
           * Flaeche, wie sie die Variante "default" setzt, erschlaegt die
           * schmale Seitenleiste.
           */
          className={cn(
            "-mr-2 gap-2 px-2 disabled:opacity-100",
            reacted && "text-primary"
          )}
        >
          {/* Gefuellte Fassung statt CSS-Fuellung auf der Kontur: siehe
              ClapIcon. Etwas groesser als die uebrigen Symbole der Zeile,
              weil zwei Haende auf 1rem zu einem Fleck zusammenlaufen. */}
          <ClapIcon ref={iconRef} filled={reacted} className="size-5" />
          <span aria-hidden="true" className="type-body font-semibold">
            {count}
          </span>
        </Button>
      </div>

      {/*
       * Der neue Stand wird nach dem Klick angesagt, ohne den Fokus zu bewegen
       * (SC 4.1.3); polite, damit es eine laufende Ausgabe nicht unterbricht.
       * Die Meldung steht ausserhalb des Knopfes: darin waere sie Teil seines
       * Namens, und eine Namensaenderung liest ein Screenreader nicht als
       * Meldung vor.
       */}
      <p aria-live="polite" className="sr-only">
        {t("project.card.reactions", { count })}
      </p>

      {/* Der Grund steht immer dabei, wenn die Handlung gesperrt ist: ein
          Knopf ohne Wirkung und ohne Erklaerung ist fuer die Tastatur ein
          Ziel ohne Zweck. Die Anmeldung wiegt schwerer, weil sie auch fuer
          ein veroeffentlichtes Projekt gilt. */}
      {blocked && (
        <p id={reasonId} className="type-caption text-muted-foreground">
          {t(
            !isAuthenticated
              ? "project.detail.reactions.loginRequired"
              : "project.detail.reactions.publishedRequired"
          )}
        </p>
      )}

      {/* Ein 403 bleibt nie stumm (Frontend-Regel 4). Entschieden wird ueber
          den errorCode, nie ueber den Meldungstext. */}
      {failed !== null && <ErrorState error={failed} />}
    </div>
  )
}
