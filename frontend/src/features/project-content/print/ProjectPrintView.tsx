import { useEffect, useSyncExternalStore } from "react"
import { createPortal, flushSync } from "react-dom"

import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import { ProjectPrintHeader } from "@/features/project-content/print/ProjectPrintHeader"
import {
  isPrintActive,
  setPrintActive,
  subscribeToPrintActivation,
} from "@/features/project-content/print/printActivation"
import type { FileState } from "@/features/project-content/renderer/MediaSlot"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"

/**
 * Der Druckbereich eines Projekts (KAN-41): Kopfbereich und Blockinhalt,
 * und sonst nichts.
 *
 * <p><strong>Warum ein Portal unmittelbar an {@code body}.</strong> Im
 * Ausdruck soll von der Anwendung nichts uebrig bleiben: keine Navigation,
 * keine Fusszeile, keine Seitenleiste, keine Werkzeugleiste, keine
 * Blockbedienung, keine Reaktionsschaltflaeche. Das laesst sich auf zwei
 * Weisen erreichen. Entweder jede dieser Stellen bekommt eine Markierung
 * und eine Regel, die sie im Druck ausblendet; dann sind es ein Dutzend
 * Dateien, und die naechste neue Leiste wird vergessen. Oder es gibt genau
 * einen Bereich, der gedruckt wird, und alles daneben verschwindet
 * pauschal. Genau das tut {@code project-content.css}: im Ausdruck steht
 * jedes Kind von {@code body}, das nicht dieser Bereich ist, auf
 * {@code display: none}. Dafuer muss der Bereich ein unmittelbares Kind von
 * {@code body} sein, und dorthin bringt ihn das Portal.
 *
 * <p><strong>Es entsteht keine zweite Renderlogik.</strong> Der Inhalt
 * laeuft durch denselben {@code ProjectContent} wie Detailseite, Vorschau
 * und Review-Modus. Der Ausdruck ist dieselbe Ansicht mit anderen Regeln;
 * andernfalls fiele bei jedem neuen Blocktyp die Druckansicht auseinander.
 *
 * <p><strong>Verborgen wird er ueber {@code display: none} in
 * {@code project-content.css}</strong> und nicht ueber das Attribut
 * {@code hidden}. Beides nimmt ihn aus dem Baum der Hilfsmittel, aber das
 * Attribut haengt am Standard-Stylesheet des Browsers, und manche fuehren
 * es dort als {@code !important}; dann liesse sich der Bereich im Druck
 * nicht wieder einblenden, und das Blatt bliebe leer. Eine eigene Regel
 * kennt dieses Risiko nicht.
 *
 * <p><strong>Gefuellt wird er erst, wenn gedruckt wird.</strong> Er traegt
 * denselben Beitrag ein zweites Mal; stuende er dauernd im DOM, verdoppelte
 * die oeffentliche Detailseite ihren Baum. Zwei Wege fuellen ihn, und beide
 * werden gebraucht: die Schaltflaeche ueber {@code usePrintProject}, und
 * {@code beforeprint} fuer alle, die stattdessen Strg+P druecken. Ohne den
 * zweiten Weg bekaeme genau diese Person ein leeres Blatt, denn die Regel
 * oben blendet ja alles andere aus.
 *
 * <p>Beide fuellen in {@code flushSync}: {@code window.print()} haelt den
 * Ablauf an, und ein Rendern, das React erst danach einplant, kaeme zu
 * spaet.
 *
 * <p><strong>Die Bilder darin sind gewollt traege.</strong> Ein verborgener
 * Bereich laedt nichts nach, und das ist der Punkt: die oeffentliche
 * Detailseite soll nicht jedes Bild ein zweites Mal holen. Vor dem Druck
 * schaltet {@code usePrintProject} sie auf {@code eager} um und wartet auf
 * sie. Wer Strg+P drueckt, umgeht dieses Warten; darauf, dass der Browser
 * traege Bilder vor dem Drucken selbst nachlaedt, ist Verlass genug
 * (benannte Grenze im Ticket).
 */
export function ProjectPrintView({
  project,
  blocks,
  coverUrl,
  resolveFileUrl,
  fileState,
  now,
}: {
  project: ProjectDetailResponse
  blocks: readonly BlockResponse[]
  coverUrl: string | null
  /** Wie bei {@code ProjectContent}: eigene Aufloesung der Dateiadresse. */
  resolveFileUrl?: (fileId: string) => string
  /** Wie bei {@code ProjectContent}: der Zustand einer abgerufenen Datei. */
  fileState?: (fileId: string) => FileState
  /** Der Zeitpunkt des Ausdrucks; siehe {@code ProjectPrintHeader}. */
  now?: Date
}) {
  const active = useSyncExternalStore(subscribeToPrintActivation, isPrintActive)

  useEffect(() => {
    const fill = () => flushSync(() => setPrintActive(true))
    const empty = () => setPrintActive(false)
    window.addEventListener("beforeprint", fill)
    window.addEventListener("afterprint", empty)
    return () => {
      window.removeEventListener("beforeprint", fill)
      window.removeEventListener("afterprint", empty)
      /* Die Seite geht, der Zustand bleibt sonst stehen und der naechste
         Bereich stuende sofort gefuellt da. */
      setPrintActive(false)
    }
  }, [])

  return createPortal(
    <div data-print="area">
      {active && (
        <>
          <ProjectPrintHeader project={project} coverUrl={coverUrl} now={now} />
          <ProjectContent
            blocks={blocks}
            resolveFileUrl={resolveFileUrl}
            fileState={fileState}
            forPrint
          />
        </>
      )}
    </div>,
    document.body
  )
}
