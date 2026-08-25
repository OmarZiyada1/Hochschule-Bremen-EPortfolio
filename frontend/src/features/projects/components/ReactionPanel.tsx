import gsap from "gsap"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { ProjectStatus } from "@/api/types"
import { ClapIcon } from "@/components/common/ClapIcon"
import { Alert, AlertTitle } from "@/components/ui/alert"
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
 * <p><strong>Der eigene Reaktionszustand ist nicht abfragbar</strong>, und
 * das ist eine benannte Grenze: weder §3.10 noch ProjectDetailResponse
 * fuehren ein Feld, das sagt, ob die lesende Person bereits reagiert hat.
 * Die Schaltflaeche startet nach jedem Laden deshalb im neutralen Zustand.
 * Sie behauptet nicht, dass noch nicht reagiert wurde, sondern bietet die
 * Handlung an. Innerhalb einer geoeffneten Seite merkt sie sich die eigene
 * Aktion und schaltet um; ueber ein Neuladen hinaus wird nichts behauptet.
 * Ein Feld {@code hasReacted} waere eine Contract-Erweiterung zu §3.10.
 *
 * <p>Beide Richtungen sind idempotent und liefern den gueltigen Zaehler
 * (§6.1), ein zweiter Klick ist also kein Fehler. Der Zaehler folgt immer
 * der Antwort und wird nie im Client hochgezaehlt.
 *
 * <p><strong>Das Klatschen wird gespielt, nicht nur gefaerbt.</strong> Beim
 * Reagieren gehen die beiden Haende auseinander, schlagen zusammen und
 * federn aus, waehrend der Funkenkranz aufgeht (GSAP). Angefasst werden die
 * {@code data-clap}-Gruppen aus {@link ClapIcon}, nicht Kindpositionen:
 * eine Animation, die an der Reihenfolge der Gruppen haengt, bricht beim
 * naechsten Feinschliff am Symbol still.
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
  status,
}: {
  projectId: string
  /** Zaehler aus der Detailantwort (§3.10). Fehlt er, zeigt die Seite 0. */
  reactionCount: number
  /** Projektstatus (§2.2); reagieren laesst sich nur auf PUBLISHED (§3.10). */
  status: ProjectStatus | undefined
}) {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { add, remove } = useProjectReaction(projectId)

  /*
   * Nur der Verlauf innerhalb dieser geoeffneten Seite, kein Abbild eines
   * Serverzustands: siehe die benannte Grenze oben. Deshalb useState und
   * nicht die URL, anders als bei Filtern und Seitenzahl (KAN-31).
   */
  const [reacted, setReacted] = useState(false)

  const iconRef = useRef<SVGSVGElement>(null)

  /* Laeuft eine Animation noch, wenn die Seite verlassen wird, schriebe GSAP
     weiter auf abgeraeumte Knoten. */
  useEffect(() => {
    const svg = iconRef.current
    return () => {
      if (svg !== null) {
        gsap.killTweensOf(svg.querySelectorAll("[data-clap]"))
      }
    }
  }, [])

  /**
   * Spielt das Klatschen: auseinander, zusammen, ausfedern, dazu der
   * Funkenkranz. Findet sich das Symbol nicht oder ist Bewegung abbestellt,
   * passiert nichts; die Reaktion selbst haengt nicht daran.
   */
  function playClap(): void {
    const svg = iconRef.current
    if (svg === null) {
      return
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const left = svg.querySelector('[data-clap="left"]')
    const right = svg.querySelector('[data-clap="right"]')
    const burst = svg.querySelector('[data-clap="burst"]')
    if (left === null || right === null || burst === null) {
      return
    }

    /* Ein zweiter Klick setzt neu an, statt zwei Zeitleisten uebereinander
       laufen zu lassen. */
    gsap.killTweensOf([left, right, burst])
    gsap.set([left, right], { x: 0, rotate: 0 })
    gsap.set(burst, { scale: 1, svgOrigin: "12 5" })

    const tl = gsap.timeline()
    tl.to(left, { x: -2, rotate: -12, duration: 0.13, ease: "power2.out" }, 0)
      .to(right, { x: 2, rotate: 12, duration: 0.13, ease: "power2.out" }, 0)
      /* Der Aufprall: beide schiessen ueber die Ruhelage hinaus. */
      .to(left, { x: 0.8, rotate: 4, duration: 0.09, ease: "power3.in" })
      .to(
        right,
        { x: -0.8, rotate: -4, duration: 0.09, ease: "power3.in" },
        "<"
      )
      .to(burst, { scale: 1.45, duration: 0.12, ease: "power2.out" }, "<")
      .to(left, {
        x: 0,
        rotate: 0,
        duration: 0.34,
        ease: "elastic.out(1, 0.55)",
      })
      .to(
        right,
        { x: 0, rotate: 0, duration: 0.34, ease: "elastic.out(1, 0.55)" },
        "<"
      )
      .to(burst, { scale: 1, duration: 0.26, ease: "power2.out" }, "<")
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
      {failed !== null && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(failed)
              ? t(apiErrorMessageKey(failed), { defaultValue: failed.message })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}
    </div>
  )
}
