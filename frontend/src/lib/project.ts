/**
 * Projektbezogene Typen aus dem API-Contract, die mehr als eine Komponente
 * braucht.
 *
 * Sie standen zuerst in ProjectCard.tsx, von wo ProjectTableRow und Top10Card
 * sie importierten: eine Tabellenzeile und eine Rangkachel haengen dann am
 * Modul der Projektkachel, obwohl keine von beiden eine Kachel ist. Hier
 * liegen sie an einer Stelle, die keine Darstellung mitbringt.
 *
 * Ab KAN-30 kommen diese Typen aus der generierten schema.d.ts und diese
 * Datei entfaellt. Bis dahin ist sie die einzige Adresse dafuer; ein zweites
 * Vorkommen derselben Form in einer Komponente ist ein Befund.
 */

/**
 * Projektart nach API-Contract 2.6. Der Wert laeuft unveraendert durch den
 * Code, uebersetzt wird nur die Anzeige ueber project.type.<WERT>.
 */
export type ProjectType = "REGULAR" | "PAPER" | "THESIS"

/** Stammdatenbezug, wie ihn ReferenceResponse liefert (§3.6 bis §3.9). */
export interface ProjectReference {
  name: string
  abbreviation?: string | null
}
