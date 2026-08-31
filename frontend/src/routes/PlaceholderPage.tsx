import { useTranslation } from "react-i18next"

/**
 * Erkennbarer Platzhalter fuer eine Route, deren Seite erst mit ihrem
 * eigenen Ticket entsteht (Ticket KAN-7, Technische Hinweise): Ueberschrift
 * plus Hinweis auf das zustaendige Ticket. Mehr bewusst nicht; erfundene
 * Inhalte, die nach echten Daten aussehen, verbietet Frontend-Regel 10.
 *
 * Die statischen Fussbereich-Seiten Impressum und Datenschutz haben kein
 * Ticket; dort steht der allgemeine Hinweis. Die dritte, Barrierefreiheit,
 * ist seit KAN-42 eine eigene Seite und laeuft nicht mehr ueber diese
 * Huelle.
 *
 * <p><strong>Diese Huelle bleibt eigen und nutzt nicht {@code TextPage}</strong>
 * (entschieden in KAN-95). Der Baustein traegt Textseiten: Kopfbereich mit
 * Einleitung, kleine Hinweise, Abschnitte darunter. Hier gibt es nichts
 * davon, sondern eine Ueberschrift und einen Satz, der sagt, dass die Seite
 * noch fehlt. Der Umzug haette ausserdem das Aussehen von {@code /imprint}
 * und {@code /privacy} veraendert, und zwar Abstaende und
 * Ueberschriftengroesse ({@code gap-4 py-16} und {@code type-h1} gegen
 * {@code gap-8 py-12} und {@code type-title}); genau das schliesst KAN-95
 * aus. Bekommen die beiden Seiten eines Tages echten Text, ziehen sie mit
 * diesem Ticket auf {@link TextPage} um und diese Huelle entfaellt.
 */
export function PlaceholderPage({
  titleKey,
  ticket,
}: {
  /** i18n-Schluessel der Seitenueberschrift, z. B. placeholder.title.imprint */
  titleKey: string
  /** Ticket, das die Seite baut (KAN-…); fehlt es, ist die Seite statisch. */
  ticket?: string
}) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16">
      <h1 className="type-h1">{t(titleKey)}</h1>
      <p className="type-body text-muted-foreground">
        {ticket
          ? t("placeholder.hint", { ticket })
          : t("placeholder.hintStatic")}
      </p>
    </div>
  )
}
