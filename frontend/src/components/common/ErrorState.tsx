import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { Alert, AlertTitle } from "@/components/ui/alert"

/**
 * Fehlerzustand einer Ansicht: die dritte der drei Zustandsflaechen neben
 * Skeleton (laedt) und {@link EmptyState} (leer), und damit die eine Stelle,
 * an der eine Fehlermeldung sichtbar wird (KAN-42, Umfang 6).
 *
 * <p>Vorher stand dieselbe Kombination aus {@code Alert variant="destructive"}
 * und {@code AlertTitle} in 44 Dateien einzeln, an 61 Stellen, teils mit der
 * Textableitung daneben und teils mit einem bereits abgeleiteten Text. Sie
 * sahen gleich aus, aber nichts hielt sie zusammen: eine Ergaenzung wie ein
 * Wiederholen-Knopf haette 61 Fundstellen gehabt, und wer eine davon
 * vergisst, hat eine Seite, die anders meldet als der Rest.
 *
 * <p><strong>Zwei Eingaenge, ein Ergebnis.</strong> {@code error} nimmt den
 * Fehler selbst und leitet den Text ueber {@link useApiErrorMessage} ab, also
 * ueber den {@code errorCode} und nie ueber den Meldungstext des Servers
 * (Frontend-Regel 3, Contract 6.2). {@code message} nimmt einen Text, der
 * anderswo bereits entstanden ist: der Wurzelfehler eines Formulars aus
 * {@code react-hook-form}, eine Zeilenmeldung einer Tabelle, das Ergebnis
 * eines Sammelaufrufs. Beides fuehrt zu derselben Flaeche; ohne den zweiten
 * Eingang blieben genau diese Stellen von Hand gebaut und liefen mit der
 * Zeit auseinander.
 *
 * <p>Die Primitive {@code alert} bringt {@code role="alert"} mit, die
 * Meldung erreicht einen Screenreader also ohne eigene Live-Region. Genau
 * deshalb gehoert hier keine Ueberschrift hinein: {@code AlertTitle} rendert
 * bewusst ein {@code div}, und ein zusaetzliches {@code h2} in einer
 * Alert-Rolle waere ein Sprungziel, das die Seitenstruktur nicht traegt
 * (anders als bei {@link EmptyState}, der eine leere Liste ersetzt und
 * deshalb eine echte Ueberschrift setzt).
 *
 * <p>Ein roher Statuscode erscheint nie, und eine Meldung ohne Text auch
 * nicht: {@code message} rendert nur, wenn etwas darin steht.
 */
export function ErrorState({
  error,
  message,
  className,
}: {
  /**
   * Der Fehler aus React Query oder aus einem eigenen Zustand. Bewusst
   * {@code unknown}: React Query typisiert {@code error} je nach Hook
   * unterschiedlich, und die Ableitung faengt jeden Fall ab.
   */
  error?: unknown
  /**
   * Ein bereits abgeleiteter Text. Wird nur beachtet, wenn {@code error}
   * fehlt. {@code null} ist erlaubt, weil die Aufrufer ihre Zeilen- und
   * Formularfehler so fuehren.
   */
  message?: string | null
  className?: string
}) {
  const apiMessage = useApiErrorMessage()
  const text = error === undefined ? message : apiMessage(error)

  if (text === undefined || text === null || text === "") {
    return null
  }

  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{text}</AlertTitle>
    </Alert>
  )
}
