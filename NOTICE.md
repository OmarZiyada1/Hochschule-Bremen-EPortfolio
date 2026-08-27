# Hinweise zu fremden Werken

Diese Datei führt Werke Dritter auf, die im E-Portfolio Hochschule Bremen
verwendet werden und eine Namensnennung verlangen. Bibliotheken stehen hier
nicht: ihre Lizenzen liegen in `node_modules` bzw. im Maven-Abhängigkeitsbaum
und werden dort geführt.

## Symbole

| Werk                | Urheber:in | Quelle                                                   | Lizenz                                             | Fundstelle im Code                     |
| ------------------- | ---------- | -------------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| „Clapping", gefüllt | Smashicons | [Flaticon](https://www.flaticon.com/free-icons/clapping) | Flaticon Free License (Namensnennung erforderlich) | `frontend/src/assets/clap-filled.png`  |
| „Clapping", Kontur  | Smashicons | [Flaticon](https://www.flaticon.com/free-icons/clapping) | Flaticon Free License (Namensnennung erforderlich) | `frontend/src/assets/clap-outline.png` |

Vorgeschriebener Nennungstext der Lizenz:

> Clapping icons created by Smashicons - Flaticon

Lizenznehmer laut Zertifikat: Omar Ziyada, heruntergeladen am 27.08.2026,
Lizenztyp „Free for commercial use WITH ATTRIBUTION". Lizenzgeber ist die
Freepik Company, S.L., Málaga.

Beide Dateien sind unverändert übernommen: nichts ist nachgezeichnet, nichts
umgefärbt. Verwendet werden sie als CSS-Maske
(`frontend/src/components/common/ClapIcon.tsx`), das heißt die Zeichnung
liefert nur die Form, die Farbe kommt aus der Tokenschicht.

**Wo die Nennung sichtbar wird.** Nicht im Symbol selbst: eine
Bildunterschrift mitten in der Reaktionsschaltfläche wäre als Namensnennung
unbrauchbar, weil sie bei 20 Pixel Kantenlänge niemand liest und ein
Screenreader sie als Teil des Namens der Schaltfläche vorläse. Ihr Ort ist das
Impressum, sobald dessen Seite entsteht: heute liegt unter `/imprint` nur ein
`PlaceholderPage`, die Seite hat kein eigenes Ticket. Bis dahin steht die
Nennung hier, und dieser Absatz ist der Text, der dann dorthin wandert.

Die Alternative wäre eine erworbene Einzellizenz (Flaticon Premium), die ohne
Namensnennung auskommt. Dann fällt der Abschnitt hier ersatzlos weg.
