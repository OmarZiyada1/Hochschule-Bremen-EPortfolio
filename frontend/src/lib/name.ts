/**
 * Anzeige von Personennamen. Der Contract liefert Vor- und Nachname
 * getrennt (PersonResponse, §3.1); zusammengesetzt wird an genau einer
 * Stelle, weil Kopfleiste, Projektkachel, Top-10-Kachel und Nutzerzeile
 * sonst je eine eigene Fassung baeuchten.
 */
export interface PersonName {
  firstName: string
  lastName: string
}

/** Vorname und Nachname mit einem Leerzeichen dazwischen. */
export function fullNameOf(person: PersonName): string {
  return `${person.firstName} ${person.lastName}`.trim()
}

/**
 * Initialen fuer die Avatarflaeche.
 *
 * Genommen wird der erste Buchstabe je Namensteil, nicht das erste Zeichen
 * der Zeichenkette: bei zusammengesetzten Namen ergaebe letzteres sonst
 * dasselbe Kuerzel fuer verschiedene Personen. Ein leerer Namensteil
 * liefert nichts statt eines Leerzeichens.
 */
export function initialsOf(person: PersonName): string {
  return [person.firstName, person.lastName]
    .map((part) => part.trim().charAt(0))
    .join("")
    .toUpperCase()
}
