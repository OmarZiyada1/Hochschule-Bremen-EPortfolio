/**
 * Ob der Druckbereich gerade gefuellt sein muss (KAN-41).
 *
 * <p><strong>Warum der Bereich nicht dauernd gefuellt ist.</strong> Er
 * traegt denselben Beitrag ein zweites Mal. Stuende er immer im DOM, dann
 * verdoppelte die oeffentliche Detailseite ihren Baum samt aller
 * {@code video}- und {@code audio}-Elemente, die auch verborgen ihre
 * Metadaten holen. Gefuellt wird er deshalb erst, wenn wirklich gedruckt
 * wird, und danach wieder geleert.
 *
 * <p><strong>Warum ein Modulzustand und kein React-Zustand.</strong> Es
 * gibt zwei Ausloeser, und sie liegen weit auseinander: die Schaltflaeche
 * (in der Kopfzeile des Editors oder am Titelbild der Detailseite) und das
 * Ereignis {@code beforeprint}, wenn jemand Strg+P drueckt. Beide muessen
 * denselben Bereich fuellen, und der haengt als Portal an {@code body}. Ein
 * Zustand, den sich die Seiten durchreichen, liefe durch jede Ebene
 * dazwischen; hier steht er an einer Stelle, und der Bereich liest ihn ueber
 * {@code useSyncExternalStore}.
 *
 * <p>Der Zustand ist bewusst global und nicht je Bereich: es gibt je Seite
 * genau einen Druckbereich, und gedruckt wird immer die ganze Seite.
 */

let active = false
const listeners = new Set<() => void>()

export function subscribeToPrintActivation(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isPrintActive(): boolean {
  return active
}

/**
 * Schaltet den Druckbereich an oder aus.
 *
 * <p>Der Aufrufer sorgt dafuer, dass die Aenderung rechtzeitig im DOM
 * ankommt: {@code window.print()} haelt den Ablauf an, ein Rendern, das
 * React erst danach einplant, kaeme zu spaet. Beide Ausloeser rufen deshalb
 * in {@code flushSync}.
 */
export function setPrintActive(next: boolean): void {
  if (active === next) {
    return
  }
  active = next
  for (const listener of [...listeners]) {
    listener()
  }
}
