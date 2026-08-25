import type { Degree, ProjectType } from "@/api/types"

/**
 * Auswahlzustand der Filter-Seitenleiste (KAN-64). Eine Eigenschaft je
 * Filtergruppe des Templates "Projekte (Oeffentlich)"; die Schluessel sind
 * zugleich die URL- und API-Parameternamen aus Contract §6.1. Der Filter
 * module aus §6.1 fehlt bewusst: die Seitenleiste hat keine Modul-Gruppe.
 */
export interface ProjectFilterSelection {
  faculty: string[]
  studyProgram: string[]
  degree: Degree[]
  semester: string[]
  type: ProjectType[]
  category: string[]
}

/** Die Gruppen in der Reihenfolge des Templates. */
export const FILTER_KEYS = [
  "faculty",
  "studyProgram",
  "degree",
  "semester",
  "type",
  "category",
] as const satisfies readonly (keyof ProjectFilterSelection)[]

/*
 * Record ueber den Enum-Typ statt Array-Literal (Skill frontend-shadcn,
 * Abschnitt 6): ein neuer Contract-Wert bricht den Typecheck, statt still
 * aus der Filtergruppe zu fehlen. Der Zahlwert ist die Anzeige-Reihenfolge
 * nach Template.
 */
const DEGREE_ORDER: Record<Degree, number> = {
  BACHELOR: 1,
  MASTER: 2,
  MBA: 3,
}

const PROJECT_TYPE_ORDER: Record<ProjectType, number> = {
  PAPER: 1,
  REGULAR: 2,
  THESIS: 3,
}

function orderedValues<V extends string>(order: Record<V, number>): V[] {
  return (Object.keys(order) as V[]).sort((a, b) => order[a] - order[b])
}

/** Optionen der Gruppe Abschluss (§2.7), Anzeige ueber project.degree.*. */
export const FILTER_DEGREES: readonly Degree[] = orderedValues(DEGREE_ORDER)

/** Optionen der Gruppe Projekttyp (§2.6), Anzeige ueber project.type.*. */
export const FILTER_PROJECT_TYPES: readonly ProjectType[] =
  orderedValues(PROJECT_TYPE_ORDER)

export function isDegree(value: string): value is Degree {
  return (FILTER_DEGREES as readonly string[]).includes(value)
}

export function isProjectType(value: string): value is ProjectType {
  return (FILTER_PROJECT_TYPES as readonly string[]).includes(value)
}

/**
 * Liest die Auswahl aus den wiederholten URL-Parametern (?faculty=a&faculty=b),
 * derselben Form, in der sie zum Server geht (§6.1, v43).
 *
 * Die Enum-Gruppen behalten nur bekannte Werte: die Checkboxen erzeugen
 * ausschliesslich gueltige, und ein von Hand geschriebener Fantasiewert
 * wuerde am Server als 400 enden, obwohl ihn keine Checkbox darstellt.
 * Die ID-Gruppen bleiben ungeprueft, denn eine unbekannte ID ist laut
 * Contract ein gueltiger Filter mit leerem Ergebnis, kein Fehler.
 */
export function readFilterSelection(
  params: URLSearchParams
): ProjectFilterSelection {
  return {
    faculty: params.getAll("faculty"),
    studyProgram: params.getAll("studyProgram"),
    degree: params.getAll("degree").filter(isDegree),
    semester: params.getAll("semester"),
    type: params.getAll("type").filter(isProjectType),
    category: params.getAll("category"),
  }
}

/** Ein Wert wird an- oder abgewaehlt, die uebrigen bleiben stehen. */
export function toggleValue<V extends string>(
  values: readonly V[],
  value: V
): V[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value]
}

/**
 * Ein leerer Auswahlzustand: alle Gruppen ohne Wert.
 *
 * <p>Als Fabrik und nicht als Konstante, weil die Listen veraenderlich
 * typisiert sind: eine geteilte Konstante liesse sich versehentlich
 * fuellen, und die naechste Zuruecksetzung setzte nicht mehr zurueck.
 */
export function emptyFilterSelection(): ProjectFilterSelection {
  return {
    faculty: [],
    studyProgram: [],
    degree: [],
    semester: [],
    type: [],
    category: [],
  }
}

/**
 * Wie viele Werte insgesamt gesetzt sind, ueber alle Gruppen hinweg
 * (KAN-80).
 *
 * <p>Gezaehlt werden Werte und nicht Gruppen: Wer drei Fakultaeten
 * angehakt hat, hat drei Filter gesetzt und nicht einen. Danach richtet sich
 * die Zahl am Weg zurueck auf null, und dieselbe Zaehlung je Gruppe steht
 * neben dem Gruppennamen.
 */
export function activeFilterCount(selection: ProjectFilterSelection): number {
  return FILTER_KEYS.reduce((sum, key) => sum + selection[key].length, 0)
}
