/**
 * Der Suchbegriff der Stammdatenseiten in der Adresse (KAN-39), als reine
 * Funktionen, damit er ohne Rendern pruefbar ist (Skill frontend-modul,
 * Abschnitt 3).
 *
 * <p><strong>Warum in der Adresse und nicht in {@code useState}.</strong>
 * Gefiltert wird hier clientseitig, der Endpoint kennt keinen
 * Suchparameter (§6.1); trotzdem beschreibt der Begriff einen Ausschnitt der
 * Liste. Ohne ihn in der Adresse ist ein Ergebnis weder teilbar noch
 * uebersteht es den Zurueck-Knopf, und {@code SearchInput} sagt in seinem
 * eigenen Kopf, dass der Suchbegriff dorthin gehoert.
 *
 * <p>Geschrieben wird mit {@code replace}, damit nicht jeder Buchstabe ein
 * Historieneintrag wird. Ein leerer Begriff entfernt den Parameter, statt
 * {@code ?q=} zu hinterlassen: der Grundzustand einer Seite hat keine
 * Parameter.
 */
export function readMasterDataSearch(params: URLSearchParams): string {
  return params.get("q") ?? ""
}

export function writeMasterDataSearch(
  params: URLSearchParams,
  value: string
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (value === "") {
    next.delete("q")
  } else {
    next.set("q", value)
  }
  return next
}
