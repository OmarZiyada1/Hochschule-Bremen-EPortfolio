import { useTranslation } from "react-i18next"

/**
 * Erkennbarer Platzhalter fuer eine Route, deren Seite erst mit ihrem
 * eigenen Ticket entsteht (Ticket KAN-7, Technische Hinweise): Ueberschrift
 * plus Hinweis auf das zustaendige Ticket. Mehr bewusst nicht; erfundene
 * Inhalte, die nach echten Daten aussehen, verbietet Frontend-Regel 10.
 *
 * Die statischen Fussbereich-Seiten (Impressum, Datenschutz,
 * Barrierefreiheit) haben kein Ticket; dort steht der allgemeine Hinweis.
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
