import type { CategoryResponse } from "@/api/types"

/**
 * Die alphabetische Gruppierung der Kategorienliste (Frame
 * „Admin · Kategorien", KAN-39) als reine Funktionen, damit sie ohne Rendern
 * pruefbar sind (Skill frontend-modul, Abschnitt 3).
 *
 * <p><strong>Warum die Liste ueberhaupt gruppiert wird.</strong> Der Frame
 * zeichnet 38 Kategorien in acht aufklappbaren Baendern zu je drei
 * Buchstaben. Eine ungegliederte Liste dieser Laenge ist zwar nicht falsch,
 * aber der Entwurf sagt etwas anderes, und die Baender sind zugleich die
 * einzige Sprungmarke, die die Seite hat.
 */

/** Die acht Baender des Frames, jeweils von-bis einschliesslich. */
const RANGES: readonly (readonly [string, string])[] = [
  ["A", "C"],
  ["D", "F"],
  ["G", "I"],
  ["J", "L"],
  ["M", "O"],
  ["P", "R"],
  ["S", "U"],
  ["V", "Z"],
]

/**
 * Kennung des Auffangbandes fuer alles, was nicht mit einem Buchstaben von A
 * bis Z beginnt, etwa eine Ziffer.
 *
 * <p>Der Frame zeigt es nicht, weil keine seiner 38 Kategorien so anfaengt.
 * Die Namen kommen aber aus einem Eingabefeld und nicht aus dem Entwurf:
 * ohne dieses Band verschwaende eine Kategorie „3D-Druck" spurlos aus der
 * Liste, obwohl sie angelegt ist. Es steht nur da, wenn es etwas enthaelt.
 */
export const CATEGORY_GROUP_OTHER = "other"

export interface CategoryGroup {
  /** Stabile Kennung fuer key und aufgeklappten Zustand, etwa „A-C". */
  id: string
  /** Erster Buchstabe des Bandes, oder {@code null} beim Auffangband. */
  from: string | null
  /** Letzter Buchstabe des Bandes, oder {@code null} beim Auffangband. */
  to: string | null
  categories: CategoryResponse[]
}

/**
 * Der Anfangsbuchstabe eines Namens in der Form, in der die Baender ihn
 * lesen: Grossbuchstabe, Umlaute und Akzente auf ihren Grundbuchstaben
 * zurueckgefuehrt.
 *
 * <p>Ohne diese Zurueckfuehrung stuende „Öffentlicher Dienst" im
 * Auffangband statt bei M bis O, wo der Frame es zeigt. Ausserhalb von A bis
 * Z ergibt sie {@code null}.
 */
export function initialOf(name: string): string | null {
  const first = name
    .trim()
    .normalize("NFD")
    /* Der Bereich der kombinierenden diakritischen Zeichen: nach NFD steht
       das Trema von „Ö" als eigenes Zeichen hinter dem O und faellt hier
       weg. Als Escape geschrieben, weil ein rohes kombinierendes Zeichen im
       Quelltext an seinem Nachbarn klebt und nicht zu lesen ist. */
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase()
  return first >= "A" && first <= "Z" ? first : null
}

/**
 * Verteilt die Kategorien auf die Baender und sortiert innerhalb jedes
 * Bandes nach Namen.
 *
 * <p><strong>Leere Baender fallen weg.</strong> Ein Band „J – L (0)" waere
 * eine Ueberschrift ohne Inhalt und liesse die Liste voller aussehen, als
 * sie ist. Sortiert wird mit {@code localeCompare}, damit „Öffentlicher
 * Dienst" auch innerhalb seines Bandes an der erwarteten Stelle steht; die
 * Reihenfolge des Servers ist dieselbe, aber sie ist nicht zugesagt.
 */
export function groupCategories(
  categories: readonly CategoryResponse[]
): CategoryGroup[] {
  const groups: CategoryGroup[] = RANGES.map(([from, to]) => ({
    id: `${from}-${to}`,
    from,
    to,
    categories: [],
  }))
  const other: CategoryGroup = {
    id: CATEGORY_GROUP_OTHER,
    from: null,
    to: null,
    categories: [],
  }

  for (const category of categories) {
    const initial = initialOf(category.name)
    const range =
      initial === null
        ? undefined
        : groups.find(
            (group) =>
              group.from !== null &&
              group.to !== null &&
              initial >= group.from &&
              initial <= group.to
          )
    ;(range ?? other).categories.push(category)
  }

  return [...groups, other]
    .filter((group) => group.categories.length > 0)
    .map((group) => ({
      ...group,
      categories: [...group.categories].sort((a, b) =>
        a.name.localeCompare(b.name, "de")
      ),
    }))
}

/**
 * Filtert die Liste nach dem Suchbegriff des Feldes ueber der Tabelle.
 *
 * <p>Clientseitig und ohne Request: {@code GET /api/categories} liefert die
 * vollstaendige Liste ohne Paginierung (§6.1), und ein Suchparameter ist
 * dort nicht vorgesehen. Gross- und Kleinschreibung bleiben unbeachtet, der
 * Begriff trifft an beliebiger Stelle im Namen.
 */
export function filterCategories(
  categories: readonly CategoryResponse[],
  search: string
): CategoryResponse[] {
  const needle = search.trim().toLocaleLowerCase("de")
  if (needle === "") {
    return [...categories]
  }
  return categories.filter((category) =>
    category.name.toLocaleLowerCase("de").includes(needle)
  )
}
