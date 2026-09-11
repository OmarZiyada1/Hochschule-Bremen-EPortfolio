import { inlineLinkClass } from "@/lib/inlineLink"
import type { OperatorDetails } from "@/features/legal/operatorDetails"

/**
 * Der Anschriftenblock des Betreibers (KAN-100).
 *
 * <p><strong>Warum als eigener Baustein und nicht zweimal geschrieben.</strong>
 * Impressum und Datenschutzerklaerung nennen dieselbe Person mit derselben
 * Anschrift, nur unter anderer Ueberschrift: dort „Betreiber", hier
 * „Verantwortlicher" im Sinne der DSGVO. Zwei Kopien liefen auseinander,
 * sobald jemand eine davon anfasst, und ausgerechnet bei diesen beiden
 * Seiten ist ein Auseinanderlaufen keine Schoenheitsfrage. Der Skill
 * {@code frontend-design}, Abschnitt 2, verlangt den Weg nach oben, sobald
 * die zweite Seite denselben Baustein braucht; sie braucht ihn hier von
 * Anfang an.
 *
 * <p><strong>{@code address} und nicht {@code p}.</strong> Das Element ist
 * genau dafuer da, die Kontaktangaben des Dokuments zu tragen; ein
 * Screenreader kann es als solches ansagen. Browser stellen es kursiv dar,
 * was hier nichts bedeutet und deshalb mit {@code not-italic} zuruecksteht.
 *
 * <p>Die Beschriftung des Postfachs kommt als Prop und nicht aus einem
 * festen Schluessel: beide Seiten fuehren sie in ihrem eigenen Abschnitt
 * der Sprachdatei, damit eine Seite ihren Wortlaut aendern kann, ohne die
 * andere mitzuziehen.
 */
export function OperatorAddress({
  details,
  emailLabel,
}: {
  /** Die vollstaendigen Angaben aus der Bauumgebung. */
  details: OperatorDetails
  /** Beschriftung vor der Mailadresse, etwa „E-Mail:". */
  emailLabel: string
}) {
  return (
    <address className="type-body flex flex-col gap-1 not-italic">
      <span className="font-semibold">{details.operator}</span>
      <span>{details.street}</span>
      <span>{details.city}</span>
      <span className="mt-2 flex flex-wrap gap-x-2">
        <span className="font-semibold">{emailLabel}</span>
        <a href={`mailto:${details.email}`} className={inlineLinkClass}>
          {details.email}
        </a>
      </span>
    </address>
  )
}
