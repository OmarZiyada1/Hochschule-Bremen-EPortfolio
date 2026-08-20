package de.hsbremen.eportfolio.masterdata;

import java.util.UUID;

/**
 * Ein Tag samt der Zahl der Projekte, die es tragen; Ergebniszeile von
 * {@link TagRepository#findUsage}.
 *
 * <p>Eigenes Record und keine zwei Abfragen, aus demselben Grund wie bei
 * {@code BlockTypeCount} und {@code ProjectStatusCount}: Name und Zaehlung
 * kommen in einem Zug aus der Datenbank. Die Vorschlagsliste sortiert nach der
 * Zaehlung, sie koennte sie also ohnehin nicht nachtraeglich je Zeile
 * beschaffen.
 *
 * <p>Kein {@code TagResponse}: der Konstruktorausdruck der Abfrage gehoert in
 * die Persistenzschicht, das Antwort-Record in {@code masterdata/dto}. Die
 * Abbildung macht {@code TagResponse.from}.
 *
 * @param id    technischer Schluessel des Tags
 * @param name  Anzeigename in der gespeicherten Schreibweise
 * @param count Zahl der Projekte mit diesem Tag, ueber alle Projektstatus
 */
public record TagUsageCount(UUID id, String name, long count) {
}
