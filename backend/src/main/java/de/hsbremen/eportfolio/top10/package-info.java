/**
 * Feature Top10: die kuratierte Auswahl der Startseite samt Nominierungs- und
 * Entscheidungsprotokoll (§3.11, §3.11.1).
 *
 * <p>Zwei Entitaeten mit zwei Aufgaben: {@code Top10Entry} ist die angezeigte
 * Liste, {@code Top10Nomination} das Protokoll der Vorschlaege. Entsprechend
 * gibt es zwei Dienste, {@code Top10Service} und {@code Top10NominationService},
 * die sich an genau einer Stelle beruehren: beim Annehmen eines Vorschlags.
 *
 * <p>Die Auswahl ist bewusst nicht errechnet, sondern kuratiert. Sie folgt
 * keiner Rangliste aus Reaktionszahlen, sondern einer redaktionellen
 * Entscheidung, die die Administration trifft und die §3.11 deshalb mit
 * Aufnahmezeitpunkt und Entscheidungsprotokoll festhaelt.
 */
package de.hsbremen.eportfolio.top10;
