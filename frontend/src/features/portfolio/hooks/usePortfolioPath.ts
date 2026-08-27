import { useCallback } from "react"

import { useAuth } from "@/api/auth/AuthContext"

/**
 * Der Weg zum Portfolio einer Person: bei der eigenen ID nach
 * `/my-portfolio`, sonst nach `/portfolios/{id}` (KAN-83).
 *
 * <p><strong>Das Problem.</strong> Unter einem Projekt steht der Name der
 * Autor:in als Link, und er fuehrte auch dann in die oeffentliche Fremdsicht,
 * wenn die angemeldete Person auf ihren eigenen Namen klickte. Dort fehlen
 * die eigenen Entwuerfe, die Kachelaktionen und der Weg in die Profildaten;
 * wer den eigenen Namen anklickt, will aber in den eigenen Bereich.
 *
 * <p><strong>Ein Hook und keine Modulfunktion.</strong> Die Entscheidung
 * braucht die angemeldete Person, also `useAuth`, und eine Funktion neben
 * einer Komponente in derselben Datei faellt ueber den Lint
 * `react-refresh/only-export-components`. Denselben Schnitt begruenden
 * bereits `lib/people.ts` und `routes/useBreadcrumb.ts`.
 *
 * <p><strong>Die Fremdsicht auf sich selbst bleibt erreichbar.</strong>
 * `/portfolios/{eigene-id}` leitet nicht um: die Seite ist als Vorschau „so
 * sehen mich andere" ein eigener Wert, und ein Lesezeichen darauf soll
 * weiterhin zeigen, was es verspricht. Umgebogen wird der Weg dorthin, nicht
 * die Adresse selbst.
 *
 * <p><strong>Nur im Projektkontext.</strong> Die Verwaltungstabellen der
 * Administration bleiben unberuehrt: wer dort die eigene Zeile anklickt, will
 * die Zeile pruefen und nicht in sein Portfolio springen.
 *
 * <p>Die Funktion nimmt eine ID und gibt einen Pfad; den Fall „gar keine ID"
 * entscheidet die aufrufende Stelle, denn nur sie weiss, was dann dastehen
 * soll. Ein {@code undefined} hier haette an jeder Verwendung ein
 * {@code ?? ""} nach sich gezogen, und das ist ein Link auf die eigene
 * Adresse, also eine Schaltflaeche ohne Wirkung.
 */
export function usePortfolioPath(): (userId: string) => string {
  const { user } = useAuth()
  const ownId = user?.id

  return useCallback(
    (userId: string) =>
      userId === ownId ? "/my-portfolio" : `/portfolios/${userId}`,
    [ownId]
  )
}
