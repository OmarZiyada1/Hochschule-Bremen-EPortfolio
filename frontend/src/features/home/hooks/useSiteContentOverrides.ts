import { useQuery } from "@tanstack/react-query"
import type { i18n as I18nInstance } from "i18next"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { siteContentQueries } from "@/api/queries/siteContent"
import type { SiteContentEntryResponse } from "@/api/types"
import {
  bundledLanguages,
  bundledSiteText,
  TRANSLATION_NAMESPACE,
} from "@/i18n/bundled"

/**
 * Legt die von der Administration gepflegten Texte ueber die mitgelieferten
 * Sprachdateien (Contract §2.16, §3.21, §6.1).
 *
 * <p><strong>Die Rueckfalllogik steht hier und sonst nirgends.</strong>
 * HomePage.tsx ruft weiterhin nur {@code t("home.hero.subtitle")} auf und
 * weiss nichts von diesem Endpoint. Der Weg dorthin fuehrt ueber
 * {@code i18n.addResourceBundle}: gepflegte Werte werden je Sprache in den
 * Ressourcenspeicher gelegt, ungepflegte gar nicht erst. Damit bleibt die
 * Vorgabe von selbst stehen, wo nichts gepflegt ist, und die Interpolation
 * von <code>{{year}}</code>, <code>{{works}}</code> und
 * <code>{{faculties}}</code> macht weiter i18next.
 *
 * <p><strong>Warum nicht ein eigener Aufloeser statt i18next?</strong> Ein
 * Hook, der wie {@code t()} aufgerufen wird, muesste die Interpolation, die
 * Sprachwahl und die Rueckfallkette der Bibliothek nachbauen, und HomePage
 * muesste jeden seiner fuenfzehn Aufrufe tauschen. Der Weg ueber den
 * Ressourcenspeicher traegt: der Speicher meldet jede Ergaenzung als
 * Ereignis „added", und react-i18next rendert darauf neu, seit
 * {@code react.bindI18nStore} es nennt (i18n/index.ts). Das war die
 * Bedingung, unter der dieser Weg ueberhaupt in Frage kam, und sie ist
 * erfuellt.
 *
 * <p><strong>Je Schluessel und je Sprache.</strong> Wer nur Deutsch pflegt,
 * sieht in der englischen Ansicht die englische Vorgabe und nicht deutschen
 * Text. Deshalb werden beide Sprachen bei jeder Antwort gesetzt und nicht
 * nur die gerade gewaehlte: der Sprachumschalter wechselt ohne Neuladen und
 * findet den anderen Stand dann bereits vor.
 *
 * <p>Die mitgelieferten Fassungen selbst liegen in {@code i18n/bundled.ts}:
 * die Pflegemaske der Administrationsseite braucht dieselbe Kopie, und zwei
 * Kopien waeren zwei Wahrheiten ueber denselben Bestand.
 */

/**
 * Die Schluessel, die zuletzt gepflegt in den Speicher gelegt wurden.
 *
 * <p><strong>Nur so laesst sich eine Pflege zurueckziehen.</strong>
 * {@code addResourceBundle} ergaenzt und entfernt nie; ein Schluessel, der in
 * der naechsten Antwort fehlt, bliebe sonst mit seinem alten Wert stehen.
 * Gemerkt wird deshalb, was gesetzt wurde, und beim naechsten Mal wird genau
 * dafuer wieder die Vorgabe geschrieben.
 */
let overriddenKeys: readonly string[] = []

/** Schreibt einen Wert in ein verschachteltes Objekt ueber „a.b.c". */
function setValueAtPath(
  tree: Record<string, unknown>,
  key: string,
  value: string
): void {
  const segments = key.split(".")
  const last = segments[segments.length - 1]
  let current = tree
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment]
    if (typeof next !== "object" || next === null) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }
  current[last] = value
}

/**
 * Die gepflegte Fassung einer Stelle in einer Sprache, oder {@code null},
 * wenn es keine gibt.
 *
 * <p>Reiner Leerraum zaehlt als ungepflegt, wie auf der Serverseite: dort
 * loescht ein solcher Wert die Zeile, hier faellt die Stelle auf die Vorgabe
 * zurueck. Beides ist dieselbe Aussage von zwei Seiten.
 */
function maintainedValue(
  entry: SiteContentEntryResponse,
  language: string
): string | null {
  const value = language === "de" ? entry.valueDe : entry.valueEn
  if (value === null || value === undefined || value.trim() === "") {
    return null
  }
  return value
}

/**
 * Legt den Stand der Antwort auf alle Sprachen, gepflegte Werte als Text und
 * ungepflegte als Vorgabe.
 *
 * <p>Ausgelagert aus dem Effekt, damit sie auch der Testhaken aufrufen kann.
 */
function applySiteContentOverrides(
  i18n: I18nInstance,
  entries: readonly SiteContentEntryResponse[]
): void {
  /* Zurueckgenommene Pflegen brauchen ihre Vorgabe zurueck, deshalb stehen
     auch die zuletzt gesetzten Schluessel wieder in der Runde. */
  const keys = new Set([...overriddenKeys, ...entries.map((e) => e.key)])
  if (keys.size === 0) {
    return
  }

  for (const language of bundledLanguages) {
    const bundle: Record<string, unknown> = {}
    for (const key of keys) {
      const entry = entries.find((candidate) => candidate.key === key)
      const maintained =
        entry === undefined ? null : maintainedValue(entry, language)
      const value = maintained ?? bundledSiteText(key, language)
      /* Ein Schluessel ohne Vorgabe und ohne Pflege ist in dieser Sprache
         nichts, was sich schreiben liesse: nichts zu tun. */
      if (value !== undefined) {
        setValueAtPath(bundle, key, value)
      }
    }
    /* deep = true, damit der uebrige Bestand des Namensraums stehen bleibt;
       overwrite = true, damit eine zweite Antwort die erste ersetzt. */
    i18n.addResourceBundle(language, TRANSLATION_NAMESPACE, bundle, true, true)
  }

  overriddenKeys = entries
    .filter((entry) =>
      bundledLanguages.some(
        (language) => maintainedValue(entry, language) !== null
      )
    )
    .map((entry) => entry.key)
}

/**
 * Zieht die gepflegten Texte und legt sie ueber die Vorgaben.
 *
 * <p><strong>Er haengt allein in HomePage.tsx</strong> und nicht im
 * Wurzel-Layout. Im Wurzel-Layout zoege jede Ansicht diesen Request mit,
 * auch die, die keinen einzigen der fuenfzehn Schluessel zeigt, und im
 * Testlauf faellt jeder Request ohne angemeldeten Handler als Fehler auf
 * (tests/setup.ts). Der Hook laedt dort, wo sein Ergebnis gebraucht wird.
 *
 * <p><strong>Kein Ladezustand und keine Fehlerflaeche.</strong> Die
 * Startseite rendert ihre mitgelieferten Texte sofort; was gepflegt ist,
 * tauscht danach still aus. Ein Fehler oder ein Haenger des Endpoints laesst
 * die Seite deshalb vollstaendig stehen, und genau darum wird der Fehler
 * hier bewusst nicht weitergereicht: eine Fehlerflaeche ueber einer Seite,
 * die vollstaendig lesbar ist, waere eine Falschmeldung. Sichtbar bleiben
 * die Fehler der Ressourcen, ohne die die Seite unvollstaendig ist, also
 * Top-10 und Kennzahlen.
 *
 * <p>Der gepflegte Text ist reiner Text und geht durch {@code t()} als
 * Kind-Knoten in React. Er wird nirgends ueber
 * {@code dangerouslySetInnerHTML} gerendert, weder hier noch auf der Seite.
 */
export function useSiteContentOverrides(): void {
  const { i18n } = useTranslation()
  const { data } = useQuery(siteContentQueries.list())

  useEffect(() => {
    if (data === undefined) {
      return
    }
    applySiteContentOverrides(i18n, data.entries)
  }, [data, i18n])
}

/**
 * Setzt den Speicher auf die mitgelieferten Fassungen zurueck.
 *
 * <p>Nur fuer Tests: i18next ist ein Modul-Singleton, ein gepflegter Text
 * aus einem Testfall staende sonst noch im naechsten. In der Anwendung gibt
 * es dafuer keinen Anlass, dort lebt der Speicher so lange wie die Seite.
 *
 * <p>Eine leere Antwort ist genau der Ruecksetzer: sie schreibt fuer jeden
 * zuletzt gesetzten Schluessel wieder die Vorgabe und laesst die Liste der
 * gesetzten Schluessel leer zurueck.
 */
export function resetSiteContentOverridesForTests(i18n: I18nInstance): void {
  applySiteContentOverrides(i18n, [])
}
