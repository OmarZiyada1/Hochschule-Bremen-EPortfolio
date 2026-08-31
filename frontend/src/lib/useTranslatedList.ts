import { useTranslation } from "react-i18next"

/**
 * Liest eine Aufzaehlung als Feld aus den Sprachdateien (KAN-95).
 *
 * <p><strong>Wozu.</strong> Die Punkte einer Liste stehen in {@code de.json}
 * und {@code en.json} als Array, damit ein Punkt mehr keine Codeaenderung
 * braucht. i18next gibt ein Array nur mit {@code returnObjects} heraus, und
 * der Rueckgabetyp ist dann nicht mehr {@code string}: jede Verwendung
 * braucht dieselben zwei Optionen und dieselbe Zusicherung. Bis KAN-95 stand
 * das an drei Stellen woertlich.
 *
 * <p><strong>Der Standardwert ist der Kern und keine Vorsicht.</strong> Ohne
 * ihn liefert ein fehlender Schluessel den Schluessel selbst zurueck, und die
 * Zusicherung auf {@code string[]} macht daraus im Rendern
 * {@code [object Object]} statt einer leeren Liste. Ein Tippfehler im
 * Schluessel faellt so als sichtbarer Unsinn auf der Seite auf, statt als
 * uebersprungener Abschnitt.
 *
 * <p><strong>Ein Hook und keine freie Funktion.</strong> So kommt {@code t}
 * aus derselben Quelle wie in jeder Komponente und bringt den Sprachwechsel
 * von selbst mit; die Alternative haette {@code t} als Parameter durchgereicht
 * und jede Verwendungsstelle daran erinnert.
 */
export function useTranslatedList(): (key: string) => string[] {
  const { t } = useTranslation()
  return (key: string) =>
    t(key, { returnObjects: true, defaultValue: [] }) as string[]
}
