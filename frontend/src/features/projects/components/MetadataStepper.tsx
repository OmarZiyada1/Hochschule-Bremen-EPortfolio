import type { ReactNode } from "react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

/**
 * Das dreistufige Stepper-Accordion der Projekt-Metadaten (KAN-103).
 *
 * <p><strong>Nachgebaut wird hier nichts.</strong> Auf- und Zuklappen,
 * Tastaturbedienung, {@code aria-expanded} und die Verbindung von Kopf und
 * Bereich kommen vollstaendig aus {@code components/ui/accordion}, das
 * ueber die CLI entstanden ist. Diese Datei steuert genau zwei Dinge bei,
 * die kein Accordion mitbringen kann: die Nummernkreise mit ihrer
 * senkrechten Linie und die Aufteilung des Kopfes in Nummer und Titel.
 *
 * <p><strong>Fuer die Stepper-Optik selbst gibt es keine Registry-Vorlage.</strong>
 * {@code pnpm dlx shadcn@latest view stepper} antwortet im Stil
 * {@code base-nova} mit „The item at
 * https://ui.shadcn.com/r/styles/base-nova/stepper.json was not found".
 * Base UI fuehrt ebenfalls keinen Stepper. Deshalb entsteht die Optik hier
 * als Domaenenkomponente und nicht als Datei unter
 * {@code components/ui/} (Frontend-Regel 11, Ausnahmefall greift nicht:
 * es gibt keine Primitive zum Umhuellen).
 *
 * <p><strong>Immer genau ein Schritt offen.</strong> Gesteuert von aussen
 * ueber {@code value}: der Zustand gehoert dem Formular, weil ein
 * fehlgeschlagenes Absenden den obersten beanstandeten Schritt aufklappen
 * muss. Base UI meldet beim Klick auf den bereits offenen Schritt eine
 * leere Liste; die wird verworfen, statt alle drei zuklappen zu lassen
 * (Entscheidung zu KAN-103). Sonst staende die Seite bis auf drei Koepfe
 * leer da, und im Fehlerfall gaebe es keinen offenen Schritt, in den der
 * Fokus springen koennte.
 */
export function MetadataStepper<Value extends string>({
  value,
  onValueChange,
  children,
}: {
  /**
   * Der offene Schritt. Genau einer, nie keiner. Generisch, damit die
   * aufrufende Stelle ihre eigene Aufzaehlung behaelt und den Wert nicht
   * aus einem blanken {@code string} zurueckcasten muss.
   */
  value: Value
  onValueChange: (value: Value) => void
  children: ReactNode
}) {
  return (
    <Accordion
      value={[value]}
      onValueChange={(next: Value[]) => {
        const [opened] = next
        /* Leere Liste heisst: der offene Schritt wurde angeklickt. Er
           bleibt offen, siehe Klassenkopf. */
        if (opened !== undefined) {
          onValueChange(opened)
        }
      }}
    >
      {children}
    </Accordion>
  )
}

/**
 * Ein Schritt: links der Nummernkreis an seiner Linie, rechts Kopf und
 * Bereich.
 *
 * <p><strong>Der Nummernkreis ist rein dekorativ</strong>
 * ({@code aria-hidden}). Bedient wird ueber den Kopf, und zwei Klickziele
 * fuer dieselbe Aktion sind eines zu viel. Die Nummer geht dabei nicht
 * verloren: sie steht als „Schritt 1" im Kopf und damit im zugaenglichen
 * Namen der Schaltflaeche.
 *
 * <p><strong>Die Markierung eines beanstandeten Schrittes ist Text</strong>
 * und nicht allein die Farbe des Kreises (SC 1.4.1). Ohne sie waeren die
 * Fehler der zugeklappten Schritte unsichtbar, und das Absenden bliebe
 * scheinbar wirkungslos.
 *
 * <p><strong>Das Raster traegt die Linie.</strong> Zwei Spalten, die
 * Schiene in der ersten ueber beide Zeilen: so reicht die Linie von selbst
 * bis ans untere Ende des Schrittes, gleich wie hoch sein Inhalt gerade
 * ist. Am letzten Schritt entfaellt sie, sie zeigte sonst auf nichts.
 */
export function MetadataStep({
  value,
  number,
  title,
  flagged = false,
  open = false,
  children,
}: {
  /** Kennung des Schrittes, zugleich der Wert des Accordions. */
  value: string
  /** Die sichtbare Ordnungszahl, 1 bis 3. */
  number: number
  title: string
  /** Enthaelt der Schritt beanstandete Felder? */
  flagged?: boolean
  /**
   * Ist dieser Schritt der offene? Gebraucht fuer {@code aria-disabled},
   * siehe den Kopf der Schaltflaeche weiter unten.
   */
  open?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  /* Erzeugt und nicht fest: anders als das Formular kann dieselbe
     Komponente je Seite mehrfach stehen. */
  const baseId = useId()
  const eyebrowId = `${baseId}-eyebrow`
  const titleId = `${baseId}-title`
  const flaggedId = `${baseId}-flagged`

  return (
    <AccordionItem
      value={value}
      /*
       * not-last:border-b-0 und nicht border-b-0: die erzeugte Datei setzt
       * ihre Trennlinie als not-last:border-b, und tailwind-merge loest
       * Konflikte nur innerhalb derselben Modifikator-Menge auf. Ein
       * blankes border-b-0 stuende daneben statt darueber, und im CSS
       * gewaenne .not-last\:border-b:not(:last-child) mit (0,2,0) gegen
       * .border-b-0 mit (0,1,0): unter Schritt 1 und 2 bliebe ein Strich
       * stehen, der die senkrechte Linie des Steppers kreuzt (Befund des
       * frontend-reviewers).
       */
      className="group/step not-last:border-b-0"
    >
      <div className="grid grid-cols-[2rem_1fr] gap-x-4">
        <div
          aria-hidden="true"
          className="row-span-2 flex flex-col items-center"
        >
          <span
            className={cn(
              "type-body-sm mt-4 flex size-8 shrink-0 items-center justify-center rounded-full border font-semibold",
              flagged
                ? "border-destructive text-destructive"
                : "border-primary text-primary"
            )}
          >
            {number}
          </span>
          {/* Die Linie zum naechsten Kreis. Am letzten Schritt weggelassen
              statt ausgeblendet zu werden, damit sie keine Hoehe belegt. */}
          <span className="my-2 w-px flex-1 bg-border group-last/step:hidden" />
        </div>

        {/*
         * Der Name der Schaltflaeche wird ausdruecklich gesetzt und nicht
         * aus dem Inhalt errechnet.
         *
         * <p>Der Kopf besteht aus zwei Zeilen in zwei Spans, im Fehlerfall
         * aus dreien. Die Namensberechnung setzt zwischen benachbarte
         * Inline-Elemente kein Trennzeichen, und Leerzeichen in eigenen
         * Textknoten wirft sie weg: heraus kaeme „Schritt 1Redaktion &
         * Mitglieder". Ueber aria-labelledby werden die Teile dagegen mit
         * Leerzeichen verbunden, in genau der Reihenfolge, in der sie auch
         * dastehen.
         *
         * <p>Sichtbarer Text und zugaenglicher Name bleiben dabei
         * deckungsgleich (SC 2.5.3): verwiesen wird auf genau die Spans, die
         * man liest, und nicht auf eine zweite Fassung des Textes.
         */}
        {/*
         * <strong>Der offene Kopf meldet sich als nicht bedienbar.</strong>
         * Genau ein Schritt ist offen, ein Klick auf ihn klappt ihn also
         * nicht zu (Entscheidung zu KAN-103). Ohne
         * {@code aria-disabled} stuende dort eine Schaltflaeche mit
         * {@code aria-expanded="true"}, deren Betaetigung nach jeder
         * Erwartung zuklappen muesste und nichts tut; die ARIA-APG verlangt
         * fuer einen Bereich, der sich nicht schliessen laesst, genau
         * dieses Attribut. Es sperrt den Tabstopp nicht, der Kopf bleibt
         * erreichbar und vorlesbar.
         *
         * <p>Die Abstufung, die die erzeugte Datei dafuer mitbringt
         * ({@code aria-disabled:opacity-50}), wird zurueckgenommen: sie
         * gilt einem gesperrten Bedienelement, hier steht dagegen der
         * gerade bearbeitete Schritt, und halbdurchsichtig waere das die
         * falsche Auskunft. Zurueckgenommen statt in der erzeugten Datei
         * geaendert (Frontend-Regel 11); tailwind-merge loest beide
         * Klassen gegeneinander auf, weil sie dieselbe Modifikator-Menge
         * tragen.
         *
         * <p><strong>Die Maus erreicht den offenen Kopf damit nicht mehr.</strong>
         * Die erzeugte Datei setzt zu {@code aria-disabled} auch
         * {@code pointer-events-none}, und das bleibt absichtlich stehen:
         * es ist dieselbe Auskunft wie das Attribut, nur fuer den Zeiger.
         * Tastatur und Maus laufen dabei auseinander, denn Enter und
         * Leertaste erreichen die Schaltflaeche weiter und laufen ins
         * Leere. Das ist der Preis der Einzel-Offen-Regel und faellt im
         * Testlauf nicht auf, weil Vitest ohne CSS laeuft.
         *
         * <p>Die zugeklappten Koepfe tragen dafuer eine Rueckmeldung beim
         * Ueberfahren, siehe den Titel weiter unten.
         */}
        <AccordionTrigger
          aria-disabled={open || undefined}
          aria-labelledby={[eyebrowId, titleId, flagged ? flaggedId : null]
            .filter((entry) => entry !== null)
            .join(" ")}
          className="items-start gap-4 py-4 hover:no-underline aria-disabled:opacity-100"
        >
          <span className="flex flex-col gap-1">
            <span
              id={eyebrowId}
              className="type-overline text-muted-foreground"
            >
              {t("project.metadata.steps.eyebrow", { number })}
            </span>
            {/*
             * Die Rueckmeldung beim Ueberfahren liegt auf dem Titel und
             * nicht als Flaeche hinter dem ganzen Kopf. Eine getoente
             * Flaeche darunter hebt den Kontrast der Fehlermarkierung:
             * bg-muted/60 ueber dem Hintergrund ergibt im hellen Thema
             * rgb(244, 247, 250), und destructive darauf kommt auf 4,49
             * statt der geforderten 4,5 (SC 1.4.3). Die Rolle selbst liegt
             * mit 4,62 knapp darueber, jede Toenung kippt sie also. Ein
             * Unterstrich am Titel aendert keine Farbe und loest zugleich,
             * dass der Kopf sonst gegen den Bereich darunter eingerueckt
             * waere (Befunde des frontend-reviewers).
             *
             * Das hover:underline der erzeugten Datei scheidet aus: es
             * unterstriche alle drei Zeilen des Kopfes, deshalb steht am
             * Trigger hover:no-underline und hier die Gegenrichtung.
             */}
            <span
              id={titleId}
              className="type-h3 font-semibold text-primary group-hover/accordion-trigger:underline"
            >
              {title}
            </span>
            {flagged && (
              <span
                id={flaggedId}
                className="type-body-sm font-medium text-destructive"
              >
                {t("project.metadata.steps.flagged")}
              </span>
            )}
          </span>
        </AccordionTrigger>

        <AccordionContent className="flex flex-col gap-4 pb-8">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  )
}
