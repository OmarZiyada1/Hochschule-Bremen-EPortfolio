import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { SiteContentEntryRequest, SiteContentResponse } from "@/api/types"

/**
 * Pfad, Response-Typ und Query-Key der Startseitentexte an genau einer
 * Stelle (Contract §2.16, §3.21, §6.1). Die Hooks daneben kennen weder
 * Pfade noch {@code api.*} (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Eine Datei fuer beide Seiten der Ressource</strong>, wie bei
 * den Support-Anfragen: gelesen wird PUBLIC ueber {@code /api/site-content},
 * geschrieben ausschliesslich als ADMIN ueber
 * {@code /api/admin/site-content} (§5). Es ist derselbe Bestand, und ihn
 * zweimal zu fuehren hiesse, denselben Typ zweimal zu fuehren.
 */

/**
 * Wie lange eine gelesene Antwort als frisch gilt.
 *
 * <p><strong>Grosszuegig, weil die Texte fast nie wechseln.</strong> Sie sind
 * redaktionelle Fassungen von fuenfzehn Stellen der Startseite und keine
 * Bestandsdaten; zwischen zwei Aenderungen liegen eher Monate als Minuten.
 * Ohne diese Frist fragte jeder Besuch der Startseite denselben Endpoint
 * erneut ab, und der Preis dafuer waere ein Nachladen an genau der Stelle,
 * die die Seite als Erstes zeigt.
 *
 * <p>Der Preis der Frist ist umgekehrt gering: veraltet ist hoechstens ein
 * Satz, nie eine Zahl und nie eine Berechtigung. Die Pflegemaske sieht ihren
 * eigenen Stand ohnehin sofort, weil sie nach dem Speichern invalidiert.
 */
const SITE_CONTENT_STALE_TIME_MS = 15 * 60 * 1000

export const siteContentQueries = {
  /**
   * Alle gepflegten Textstellen, beide Sprachen in einer Antwort (§6.1).
   *
   * <p><strong>Der Key traegt keine Parameter</strong>, weil der Endpoint
   * keine kennt: es gibt kein {@code ?language=}, und es soll auch keines
   * geben. Der Sprachumschalter wechselt ohne Neuladen; ein Request je
   * Sprache machte daraus ein sichtbares Nachladen.
   *
   * <p><strong>Eine leere Liste ist die normale Antwort</strong>, solange
   * niemand etwas gepflegt hat, und kein Fehler. Der Client nimmt dann
   * ueberall seine mitgelieferte Fassung.
   */
  list: () =>
    queryOptions({
      queryKey: siteContentKey(),
      queryFn: () => api.get<SiteContentResponse>(apiPaths.siteContent.list),
      staleTime: SITE_CONTENT_STALE_TIME_MS,
    }),
}

/**
 * Der Query-Key des Astes, fuer das Invalidieren nach einer Pflege.
 *
 * <p>Lesen und Schreiben treffen denselben Bestand: die Antwort des PUT ist
 * der neue Gesamtstand und hat dieselbe Form wie die des GET. Der Key steht
 * deshalb hier und wird nie von Hand nachgebaut.
 */
export function siteContentKey() {
  return ["siteContent"] as const
}

/**
 * {@code PUT /api/admin/site-content} (§6.1, §3.21), Antwort
 * <strong>200</strong> mit dem neuen Gesamtstand in der Form des GET.
 *
 * <p><strong>Ersetzt je Schluessel, nicht die ganze Tabelle.</strong> Ein
 * Schluessel, der nicht im Koerper steht, bleibt unberuehrt; ein Schluessel,
 * der darin steht, ist danach in <em>beiden</em> Sprachen das, was der
 * Eintrag sagt. Ein weggelassenes Sprachfeld heisst also nicht „bleibt wie
 * es war", sondern dasselbe wie ein leeres, und die Pflegemaske schickt
 * deshalb immer beide.
 *
 * <p><strong>Leer loescht.</strong> Ein leerer Wert oder einer aus reinem
 * Leerraum entfernt diese Sprache, und die Stelle faellt auf die
 * Sprachdatei des Frontends zurueck. Ein eigenes DELETE je Schluessel und
 * Sprache waere derselbe Vorgang in zweiter Aussenform und gibt es deshalb
 * nicht.
 *
 * <p>Sichtbar zu behandeln, jeweils ohne zweiten Versuch: 400
 * {@code VALIDATION_FAILED} bei einem unbekannten Schluessel, einem
 * fehlenden oder ueberzaehligen Platzhalter der Form <code>{{…}}</code>,
 * einem Schluessel ueber 128 Zeichen und einem Text ueber 1000 Zeichen. Der
 * Fehler nennt das betroffene Feld im Format {@code feld: Text} (§6.2) und
 * gehoert deshalb an die Zeile, die ihn ausgeloest hat.
 */
export function replaceSiteContent(
  entries: readonly SiteContentEntryRequest[]
): Promise<SiteContentResponse> {
  return api.put<SiteContentResponse>(apiPaths.admin.siteContent, { entries })
}
