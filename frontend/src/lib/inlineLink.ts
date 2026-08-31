/**
 * Der Textlink im Fliesstext, an einer Stelle (KAN-95).
 *
 * <p><strong>Eine Klassenkette und keine Komponente.</strong> Der Link steht
 * mal als {@code Link} von react-router (Ziel innerhalb der Anwendung), mal
 * als gewoehnlicher Anker (Sprungmarke innerhalb der Seite), und die
 * Sprungmarken der Hilfeseite tragen zusaetzlich {@code type-body-sm}. Eine
 * Huelle muesste diese beiden Wege und einen Durchgriff fuer weitere Klassen
 * mitbringen und waere damit eine dritte Linkkomponente neben den zwei
 * vorhandenen. Die Kette laesst sich stattdessen ueber {@code cn} an jedes
 * Element haengen, das schon das richtige ist.
 *
 * <p><strong>{@code rounded-selection} gehoert dazu und ist kein Zierat.</strong>
 * Der Fokusring folgt der Ecke; ohne den Radius sitzt er als Rechteck um
 * einen Text, der im Absatz umbrechen kann (SC 2.4.11).
 *
 * <p>Die Unterstreichung ist nicht verhandelbar: ein Link, der sich allein
 * durch seine Farbe vom Fliesstext abhebt, ist fuer alle verloren, die
 * Farben nicht unterscheiden koennen (SC 1.4.1).
 */
export const inlineLinkClass =
  "rounded-selection text-primary underline underline-offset-4 hover:text-primary-hover"
