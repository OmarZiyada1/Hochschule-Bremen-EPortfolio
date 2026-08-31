import type { ReactNode } from "react"

/**
 * Die Huelle jeder Textseite: Textspalte, Kopfbereich, Abschnitte (KAN-95).
 *
 * <p><strong>Warum es sie gibt.</strong> Die Barrierefreiheitserklaerung
 * (KAN-42) und die Hilfeseite (KAN-93) trugen dieselbe Huelle und denselben
 * Kopfbereich woertlich zweimal. Der Skill {@code frontend-design},
 * Abschnitt 2, sagt dazu: wird ein Baustein von der zweiten Seite gebraucht,
 * wandert er nach oben, statt kopiert zu werden. Mit der Hilfeseite war die
 * zweite Seite da, und die dritte soll ohne dritte Kopie entstehen.
 *
 * <p><strong>Die Huelle ist kein {@code main} und keine Fusszeile.</strong>
 * Beides stellt der Anwendungsrahmen; diese Komponente setzt allein die
 * Textspalte und den Kopf. Sie bringt auch keine Ueberschrift der Ebene 2
 * mit: die Abschnitte kommen als {@code children} und bleiben damit dort,
 * wo ihr Inhalt steht.
 *
 * <p><strong>{@code notes} nimmt mehrere Absaetze, nicht genau einen.</strong>
 * Die Barrierefreiheitserklaerung hat einen kleinen Absatz unter der
 * Einleitung (den Hinweis, keine foermliche Erklaerung zu sein), die
 * Hilfeseite zwei (Rollenhinweis und Bildhinweis). Ein einzelnes
 * {@code note} haette die Hilfeseite gleich wieder aus dem Baustein
 * getrieben.
 *
 * <p><strong>Fertiger Text, keine i18n-Schluessel.</strong> Uebersetzt wird
 * an der Verwendungsstelle. Ein Baustein, der Schluessel entgegennimmt und
 * selbst {@code t} aufruft, versteckt die Schluessel vor der Suche und
 * zwingt jede kuenftige Seite in genau dieses Namensschema.
 */
export function TextPage({
  title,
  intro,
  notes,
  children,
}: {
  /** Seitenueberschrift, die einzige Ebene 1 der Seite. */
  title: string
  /** Einleitungssatz unter der Ueberschrift. */
  intro: string
  /** Kleine Absaetze unter der Einleitung, in dieser Reihenfolge. */
  notes?: readonly string[]
  /** Die Abschnitte der Seite, in der Regel {@code section}-Elemente. */
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="type-title text-primary">{title}</h1>
        <p className="type-body-lg text-muted-foreground">{intro}</p>
        {notes?.map((note) => (
          <p key={note} className="type-body-sm text-muted-foreground">
            {note}
          </p>
        ))}
      </header>
      {children}
    </div>
  )
}
