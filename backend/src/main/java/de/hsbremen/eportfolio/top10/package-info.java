/**
 * Feature Top10: die kuratierte Auswahl der Startseite samt Nominierungs-,
 * Entscheidungs- und Aenderungsprotokoll (§3.11, §3.11.1, §3.17).
 *
 * <p>Drei Entitaeten mit drei Aufgaben: {@code Top10Entry} ist die angezeigte
 * Liste, {@code Top10Nomination} das Protokoll der Vorschlaege,
 * {@code Top10AuditEntry} das Protokoll der Aenderungen an der Liste selbst
 * (KAN-45). Entsprechend gibt es drei Dienste. {@code Top10Service} und
 * {@code Top10NominationService} beruehren sich an genau einer Stelle, beim
 * Annehmen eines Vorschlags; {@code Top10AuditService} wird von beiden gerufen
 * und ruft selbst niemanden.
 *
 * <p><strong>Die beiden Protokolle nicht verwechseln.</strong>
 * {@code Top10Nomination} haelt fest, was vorgeschlagen und wie darueber
 * entschieden wurde. {@code Top10AuditEntry} haelt fest, welcher Platz wann
 * durch welches Projekt belegt war. Ein Projekt kann ohne Nominierung in die
 * Liste kommen (ueber {@code PUT /admin/top10}) und sie ohne Entscheidung wieder
 * verlassen (wenn es {@code PUBLISHED} verlaesst oder geloescht wird); nur das
 * zweite Protokoll sieht beides.
 *
 * <p>Die Auswahl ist bewusst nicht errechnet, sondern kuratiert. Sie folgt
 * keiner Rangliste aus Reaktionszahlen, sondern einer redaktionellen
 * Entscheidung, die die Administration trifft und die §3.11 deshalb mit
 * Aufnahmezeitpunkt und Entscheidungsprotokoll festhaelt.
 */
package de.hsbremen.eportfolio.top10;
