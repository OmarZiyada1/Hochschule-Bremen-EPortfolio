import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { renderMath } from "@/features/project-content/renderer/renderMath"

/**
 * FORMULA (Contract 2.5) im Blockmodus, dargestellt ueber
 * {@link renderMath}.
 *
 * <p>Dies ist die einzige Stelle des Renderers mit
 * {@code dangerouslySetInnerHTML}, und sie ist es aus einem Grund: die
 * Ausgabe ist von KaTeX <em>erzeugt</em> und nicht eingegeben. Der einzige
 * Eingabewert ist {@code latex}, und er laeuft mit {@code trust: false}
 * durch, womit {@code \href} und {@code \url} nicht greifen. Ueberall sonst
 * setzt der Renderer Textknoten.
 *
 * <p>Eine breite Formel scrollt in ihrem eigenen Bereich, und der ist
 * fokussierbar: ein Container mit {@code overflow-x: auto} ohne Fokus
 * laesst sich mit der Tastatur nicht scrollen (SC 2.1.1). Dieselbe
 * Behandlung wie beim Quelltext- und beim Tabellenbereich.
 *
 * <p>Eine fehlerhafte Formel stuerzt nicht ab, sondern erscheint als
 * Meldung mit dem rohen LaTeX daneben: der Beitrag bleibt lesbar, und wer
 * ihn bearbeitet, sieht, was zu reparieren ist. Die Meldung traegt
 * {@code role="note"} und nicht die {@code role="alert"} der Primitive: als
 * Live-Region wuerde sie beim Laden der Seite dazwischenreden, obwohl sie
 * im Fliesstext steht und dort gelesen wird.
 */
export function MathBlockView({ latex }: { latex: string }) {
  const { t } = useTranslation()
  const result = renderMath(latex)

  if (!result.ok) {
    return (
      <Alert role="note" variant="destructive" data-block="math-error">
        <AlertTitle>{t("projectContent.formula.errorTitle")}</AlertTitle>
        <AlertDescription>
          <p>{t("projectContent.formula.errorDescription")}</p>
          <p>
            <code>{latex}</code>
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      data-block="math"
      tabIndex={0}
      role="region"
      aria-label={t("projectContent.formula.regionLabel")}
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  )
}
