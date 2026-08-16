import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { HsbKeyLogo } from "@/components/common/HsbKeyLogo"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Auffangroute nach Template "404, Seite nicht gefunden" (Ticket KAN-7,
 * Umfang 4): Markenzeichen-Kachel, zentrierter Fehlercode, Titel,
 * Erlaeuterung und der Weg zurueck zur Startseite. Die Seite liegt
 * ausserhalb der Layout-Route, denn ihr Template fuehrt keine NavBar;
 * statt des Anwendungs-Footers traegt sie die einzeilige Fusszeile aus dem
 * Template. main und Fusszeile stellt sie deshalb selbst, wie die
 * /dev-Prueffflaechen.
 *
 * Komponiert aus der empty-Primitive; das Medium ist die Markenkachel
 * (EmptyMedia, Variante icon), der grosse Fehlercode steht als Beiwerk
 * daneben. Anders als beim EmptyState aus KAN-29 setzt die Seite die Teile
 * selbst zusammen, weil dessen Icon-Slot Kachel und Code nicht zugleich
 * darstellt. Die Ueberschrift ist der Titel, nicht der Code: "404" allein
 * sagt Screenreader-Nutzenden nichts; die Ebene setzt wie ueberall die
 * Domaenenhuelle, EmptyTitle rendert ein div.
 */
export default function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <Empty className="max-w-3xl">
          {/* max-w-lg statt des max-w-sm der Primitive: die Erlaeuterung
              steht im Entwurf auf einer Zeile, in 384px braeche sie um. */}
          <EmptyHeader className="max-w-lg">
            {/* Markenzeichen-Kachel aus dem Figma-Template; das Medium des
                Leerzustands (EmptyMedia, Variante icon).

                Am Logo muss eine size-Klasse stehen, und zwar woertlich:
                die Primitive traegt [&_svg:not([class*='size-'])]:size-4 und
                zwingt jedes svg, dessen Klassenzeichenkette die Zeichenfolge
                "size-" nicht enthaelt, auf 16px. Ein h-11.5 w-auto sieht
                gleichwertig aus, faellt aber genau in diese Luecke, und weil
                der Selektor der Primitive spezifischer ist als eine
                Utility-Klasse, gewinnt er (Befund aus dem Review: der
                Schluessel schrumpfte auf ein Viertel).

                Quadratisch und trotzdem im richtigen Verhaeltnis: die
                viewBox ist hochkant, preserveAspectRatio steht auf dem
                Standard, das svg fuellt also die Hoehe von 46px und bleibt
                bei rund 39px Breite. Genau die Masse des Templates. */}
            <EmptyMedia
              variant="icon"
              className="size-23 rounded-modal bg-surface-brand text-surface-brand-foreground"
            >
              <HsbKeyLogo className="size-11.5" />
            </EmptyMedia>
            {/* Die Zahl ist eine Ziffernflaeche und keine Ueberschrift,
                deshalb type-num-rank (Source Sans ExtraBold) und nicht
                type-display (Zilla Slab): die Vorlage setzt hier einen
                schweren Grotesk. Ihre Farbe ist accent-foreground, waehrend
                der Titel darunter foreground traegt; beides steht so im
                Entwurf und ist am Knoten nachgesehen. */}
            <p
              aria-hidden="true"
              className="type-num-rank text-accent-foreground"
            >
              {t("notFound.code")}
            </p>
            <EmptyTitle className="type-h1">
              <h1>{t("notFound.title")}</h1>
            </EmptyTitle>
            <EmptyDescription className="type-body-lg">
              {t("notFound.message")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/" className={buttonVariants()}>
              {t("notFound.backHome")}
            </Link>
          </EmptyContent>
        </Empty>
      </main>
      <footer className="border-t px-4 py-6 text-center">
        <p className="type-caption text-muted-foreground">
          {t("notFound.footer")}
        </p>
      </footer>
    </div>
  )
}
