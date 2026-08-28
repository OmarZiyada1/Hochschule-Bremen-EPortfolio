/**
 * Der Punkt vor einem Eintrag des Inhaltsverzeichnisses (§2.5, KAN-83).
 *
 * <p><strong>Warum die Klassen an einer Stelle stehen.</strong> Das
 * Verzeichnis erscheint zweimal: im Lesepfad ({@code TableOfContents}) und auf
 * der Schreibflaeche ({@code TableOfContentsNodeView}). Beide sollen gleich
 * aussehen, denn der Editor zeigt, was danach im Beitrag steht; zwei
 * Abschriften liefen beim naechsten Feinschliff auseinander.
 *
 * <p><strong>Die Farbe ist Zugabe und nie die Aussage</strong> (SC 1.4.1). Die
 * Gliederung steht in der Einrueckung und im Text; der Punkt ist fuer
 * Hilfsmittel {@code aria-hidden} und traegt nichts, was sonst nirgends
 * stuende. Er hilft dort, wo die Einrueckung allein versagt: bei einem
 * umbrechenden Eintrag steht die zweite Zeile buendig unter der ersten und
 * saehe wie eine eigene Ebene aus.
 *
 * <p><strong>Zwei Toene, nicht sechs.</strong> Die oberste Ebene traegt den
 * vollen Akzent, jede tiefere denselben Ton gedaempft. Sechs Abstufungen waeren
 * auf einem 6px grossen Punkt nicht unterscheidbar, und die genaue Ebene sagt
 * ohnehin die Einrueckung.
 *
 * @param level Ueberschriftenebene des Eintrags, 1 bis 6 (§2.5)
 */
export function tocDotClass(level: number): string {
  const tone =
    level <= 1
      ? "bg-primary"
      : level === 2
        ? "bg-primary/55"
        : "bg-muted-foreground/40"

  /*
   * shrink-0 haelt den Punkt rund: in einem Flex-Kind neben langem Text
   * quetscht ihn der Umbruch sonst zu einem Oval, und genau das ist der
   * Fehler, den der Zaehler in der Filterleiste schon einmal hatte.
   *
   * mt-0.5 hebt ihn gegen die Grundlinie an: items-baseline setzt einen
   * leeren span auf seine Unterkante, er saesse sonst unter der Zeile.
   *
   * Die beiden group-Modifikatoren greifen nur im Lesepfad, wo der Verweis
   * die Gruppe traegt; auf der Schreibflaeche gibt es kein Ziel und damit
   * keinen Verweis, und sie laufen dort folgenlos ins Leere.
   */
  return [
    "mt-0.5 size-1.5 shrink-0 rounded-full transition-colors",
    tone,
    "group-hover/toc:bg-primary group-focus-visible/toc:bg-primary",
  ].join(" ")
}
