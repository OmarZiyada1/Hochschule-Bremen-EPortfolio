import { resources } from "@/i18n"

/**
 * Die <strong>mitgelieferten</strong> Fassungen der Sprachdateien, gesichert
 * bevor die erste gepflegte Fassung sie ueberschreiben kann (Contract §2.16,
 * §3.21, §6.1).
 *
 * <p><strong>Warum es diese Kopie geben muss.</strong>
 * {@code i18n.addResourceBundle} schreibt mit {@code deep = true} unmittelbar
 * in das Objekt, das aus de.json bzw. en.json importiert wurde;
 * {@code resources} zeigt danach nicht mehr auf die Vorgabe, sondern auf den
 * ueberschriebenen Stand. Eine zurueckgenommene Pflege liesse dann den alten
 * Servertext stehen, statt auf die Sprachdatei zurueckzufallen.
 *
 * <p><strong>Warum sie hier liegt und nicht in einem Feature.</strong> Zwei
 * Features brauchen dieselbe Kopie: die Startseite legt die gepflegten Texte
 * darueber ({@code features/home/hooks/useSiteContentOverrides.ts}), und die
 * Pflegemaske der Administrationsseite zeigt die mitgelieferte Fassung als
 * Vorschlag im leeren Feld ({@code
 * features/administration/AdminSiteContentPage.tsx}). Ein zweiter
 * {@code structuredClone} daneben waere eine zweite Wahrheit ueber denselben
 * Bestand; die Ablage in einem der beiden Feature-Ordner zoege dessen ganzen
 * Ast in das Buendel des anderen (Befund des frontend-reviewers).
 *
 * <p>Der Zeitpunkt stimmt: Modulrumpf, also vor dem ersten Effekt und damit
 * vor jeder moeglichen Pflege.
 */
const bundledDefaults = structuredClone(resources) as Record<
  string,
  Record<string, unknown>
>

/**
 * Der Namensraum, unter dem die Anwendung ihre Texte fuehrt
 * ({@code i18n/index.ts}).
 */
export const TRANSLATION_NAMESPACE = "translation"

/** Die Sprachen, die die Anwendung fuehrt: „de" und „en" (i18n/index.ts). */
export const bundledLanguages: readonly string[] = Object.keys(bundledDefaults)

/** Liest einen Wert aus einem verschachtelten Objekt ueber „a.b.c". */
function valueAtPath(tree: unknown, key: string): string | undefined {
  let current: unknown = tree
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === "string" ? current : undefined
}

/**
 * Die <strong>mitgelieferte</strong> Fassung einer Stelle in einer Sprache,
 * oder {@code undefined}, wenn die Sprachdatei sie nicht fuehrt.
 *
 * <p><strong>Warum das nicht {@code t()} leistet.</strong> Die Pflegemaske
 * zeigt die ausgelieferte Fassung als Vorschlag im leeren Feld, und genau
 * dort waere {@code t()} zweimal falsch. Erstens liegt nach einem Besuch der
 * Startseite bereits der gepflegte Text im Ressourcenspeicher: der Vorschlag
 * zeigte dann den Servertext und behauptete damit, das Leeren des Feldes
 * fuehre zu ihm zurueck. Zweitens interpoliert {@code t()}, und ohne
 * uebergebenen Wert faellt <code>{{year}}</code> ersatzlos aus dem Text; die
 * Maske zeigte einen Vorschlag, den sie selbst als fehlerhaft zurueckwiese.
 * Gebraucht wird der rohe Text der Sprachdatei, und den haelt die Kopie aus
 * dem Modulrumpf.
 *
 * <p>Dieselbe Kopie holt auch die Ruecknahme einer Pflege ihre Vorgabe
 * zurueck.
 */
export function bundledSiteText(
  key: string,
  language: string
): string | undefined {
  return valueAtPath(bundledDefaults[language]?.[TRANSLATION_NAMESPACE], key)
}
