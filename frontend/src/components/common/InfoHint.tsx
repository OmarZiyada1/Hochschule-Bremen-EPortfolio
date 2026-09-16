import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * Ein kleines „i", hinter dem ein Satz Erklaerung steht.
 *
 * <p><strong>Wofuer.</strong> Formulare sammeln mit der Zeit Hilfstexte an:
 * einer sagt, was der Stern bedeutet, einer, wann ein Eintrag zustande
 * kommt, einer, wie viele Schlagwoerter gehen. Jeder einzelne ist
 * berechtigt, zusammen erschlagen sie die Felder, um die es geht. Der Text
 * bleibt erreichbar, er steht nur nicht mehr dauernd da.
 *
 * <p><strong>Ein Popover und kein Tooltip auf Ueberfahren.</strong> Auf
 * einem Telefon gibt es kein Ueberfahren, und ein Hinweis, an den die
 * Haelfte der Leute nicht herankommt, ist keiner. Der Knopf laesst sich
 * anklicken, antippen und mit der Tastatur bedienen, der Text bleibt
 * stehen, solange man liest, und Escape schliesst ihn. Die Tooltips im
 * Editor sind etwas anderes: sie benennen ein Icon, das sonst namenlos
 * waere, und dafuer sind sie richtig (Skill frontend-design, Abschnitt 4).
 *
 * <p><strong>Der Name des Knopfes sagt, worum es geht</strong>, nicht
 * „Information". Wer die Knopfliste eines Screenreaders durchgeht, findet
 * sonst fuenfmal dasselbe Wort und muss jedes einzeln oeffnen.
 *
 * <p><strong>{@code descriptionId} haengt den Text zusaetzlich ans Feld.</strong>
 * Wo der Hinweis eine Anweisung zur Eingabe ist und nicht nur Beiwerk, darf
 * er nicht allein hinter einem Knopf liegen (SC 3.3.2): dann steht er
 * zusaetzlich unsichtbar da und wird ueber {@code aria-describedby} mit dem
 * Feld verbunden. Sichtbar bleibt er trotzdem nur im Popover.
 */
export function InfoHint({
  label,
  text,
  descriptionId,
  className,
}: {
  /**
   * Der zugaengliche Name des Knopfes, etwa „Was bedeutet der Stern?". Eine
   * Frage und kein Etikett: sie sagt, was der Knopf beantwortet.
   */
  label: string
  /** Der Satz, der im Popover steht. */
  text: string
  /**
   * Gesetzt, wenn der Text zusaetzlich unsichtbar am Feld haengen soll.
   * Der Aufrufer verbindet ihn dann selbst ueber {@code aria-describedby}.
   */
  descriptionId?: string
  className?: string
}) {
  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              /* Der Knopf traegt die Farbe der Beschriftung, neben der er
                 steht: er ist eine Fussnote und keine Handlung. */
              className={cn("text-muted-foreground", className)}
            />
          }
        >
          <InfoIcon aria-hidden="true" />
        </PopoverTrigger>
        {/*
         * Der Name des Dialogs ist dieselbe Frage wie die des Knopfes.
         * Base UI gibt dem Popup fest {@code role="dialog"} und benennt es
         * ueber einen {@code Popover.Title}; ohne den entstuende ein
         * namenloser Dialog, den ein Screenreader als „Dialog" ansagt und
         * axe als Verstoss meldet. Ein sichtbarer Titel waere hier zu viel:
         * hinter dem „i" steht ein Satz und keine Maske (Befund des
         * frontend-reviewers).
         */}
        <PopoverContent aria-label={label} className="w-64">
          <PopoverDescription>{text}</PopoverDescription>
        </PopoverContent>
      </Popover>
      {descriptionId !== undefined && (
        <span id={descriptionId} className="sr-only">
          {text}
        </span>
      )}
    </>
  )
}
