import { useCallback, useState } from "react"
import { flushSync } from "react-dom"

import { setPrintActive } from "@/features/project-content/print/printActivation"
import { preloadMath } from "@/features/project-content/renderer/renderBlockNode"

/**
 * Wie lange auf ein Bild gewartet wird, bevor der Druck trotzdem laeuft.
 *
 * <p>Ohne Obergrenze haengt der Druckdialog an einer einzigen Datei, die
 * der Server gerade nicht liefert. Fuenf Sekunden sind grosszuegig fuer
 * Bilder, die in aller Regel schon im Zwischenspeicher des Browsers liegen,
 * und kurz genug, dass niemand glaubt, die Schaltflaeche habe nicht
 * reagiert.
 */
const IMAGE_TIMEOUT_MS = 5000

/**
 * Der Ausdruck eines Projekts (KAN-41): clientseitig, ohne Endpoint und
 * ohne zusaetzliches Paket.
 *
 * <p>Gedruckt wird der Bereich, den {@code ProjectPrintView} als
 * {@code [data-print="area"]} an {@code body} haengt; welche Regeln dabei
 * gelten, steht in {@code styles/project-content.css}. Diese Funktion
 * besorgt allein, dass zum Zeitpunkt von {@code window.print()} auch alles
 * da ist, was gedruckt werden soll.
 *
 * <p><strong>Zwei Dinge fehlen sonst.</strong> Der Formelsatz kommt erst
 * mit der ersten Formel nach ({@code LazyMathBlock}); ein Druck unmittelbar
 * nach dem Laden der Seite ergaebe eine leere Stelle, wo eine Formel steht.
 * Und die Bilder des Druckbereichs sind traege und liegen in einem
 * verborgenen Element, laden also von sich aus nie. Beides wird hier
 * abgewartet.
 *
 * <p><strong>Geraeumt wird der Bereich nicht hier, sondern bei
 * {@code afterprint}</strong> ({@code ProjectPrintView}). Der Grund ist
 * Chrome: dort kehrt {@code window.print()} zurueck, bevor die Vorschau den
 * Seiteninhalt abgreift. Wer unmittelbar danach aufraeumt, bekommt ein
 * leeres Blatt, obwohl im Augenblick des Aufrufs alles im DOM stand.
 *
 * <p><strong>Der Bereich wird ueber das Dokument gesucht</strong> und nicht
 * ueber einen Ref durchgereicht. Es gibt je Seite genau einen Druckbereich,
 * und der Weg dorthin fuehrte sonst als Ref durch jede Seite, die eine
 * Schaltflaeche traegt, bis in die Kopfzeile des Editors hinein.
 *
 * <p><strong>Benannte Grenze:</strong> wer statt der Schaltflaeche
 * Strg+P drueckt, umgeht dieses Warten. Der Browser laedt traege Bilder vor
 * dem Drucken in aller Regel selbst nach; auf den Formelsatz wartet er
 * nicht, und der ist zu diesem Zeitpunkt geladen, sobald der Beitrag eine
 * Formel zeigt. Die Seitenumbruche sind ohnehin browserabhaengig (Ticket
 * KAN-41).
 */
export function usePrintProject(): {
  /** Startet den Ausdruck. Loest auf, wenn der Druckdialog zurueck ist. */
  print: () => Promise<void>
  /** Solange wahr, wie vorbereitet oder gedruckt wird. */
  printing: boolean
} {
  const [printing, setPrinting] = useState(false)

  const print = useCallback(async () => {
    setPrinting(true)
    try {
      /* Erst den Bereich fuellen, und zwar synchron im Ereignis: alles
         Weitere setzt voraus, dass er im DOM steht. */
      flushSync(() => setPrintActive(true))
      /*
       * Ein gescheitertes Nachladen haelt den Druck nicht auf: ein Blatt
       * ohne Formel ist immer noch besser als gar keines, und an der Stelle
       * bleibt dann sichtbar eine Luecke.
       */
      await preloadMath().catch(() => undefined)
      await loadPrintImages()
      try {
        window.print()
      } catch {
        /*
         * Verweigert der Browser den Druck, bleibt der Ausdruck aus, und
         * mehr laesst sich dazu nicht sagen: es gibt keinen Fehlercode und
         * keine Handlung, die die lesende Person daran anschliessen
         * koennte. Geraeumt wird der Bereich dann aber sofort, denn auf
         * {@code afterprint} ist in diesem Fall nicht zu warten.
         */
        setPrintActive(false)
      }
    } finally {
      setPrinting(false)
    }
  }, [])

  return { print, printing }
}

/**
 * Holt die Bilder des Druckbereichs, bevor gedruckt wird.
 *
 * <p>Ein {@code img} mit {@code loading="lazy"} in einem verborgenen
 * Element laedt nie: es kommt nie in die Naehe des sichtbaren Bereichs. Der
 * Wechsel auf {@code eager} stoesst den Abruf an, wie es die
 * HTML-Spezifikation fuer genau diesen Wechsel vorsieht. Ein gescheiterter
 * Abruf haelt den Druck nicht auf: an dieser Stelle steht dann die Meldung
 * aus {@code MediaSlot}, und die gehoert genauso aufs Papier.
 */
async function loadPrintImages(): Promise<void> {
  const area = document.querySelector<HTMLElement>('[data-print="area"]')
  if (area === null) {
    return
  }
  const images = [...area.querySelectorAll("img")]
  if (images.length === 0) {
    return
  }

  const loaded = Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.loading = "eager"
          if (image.complete) {
            resolve()
            return
          }
          image.addEventListener("load", () => resolve(), { once: true })
          image.addEventListener("error", () => resolve(), { once: true })
        })
    )
  )

  await Promise.race([
    loaded,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, IMAGE_TIMEOUT_MS)
    }),
  ])
}
