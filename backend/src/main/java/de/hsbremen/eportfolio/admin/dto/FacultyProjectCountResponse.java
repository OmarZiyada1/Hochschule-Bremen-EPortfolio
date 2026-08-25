package de.hsbremen.eportfolio.admin.dto;

import de.hsbremen.eportfolio.project.dto.ReferenceResponse;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Eine Zeile der Kennzahl {@code projectsByFaculty} von
 * {@code GET /api/admin/dashboard} (§6.1, Contract v76).
 *
 * <p><strong>Warum eine Liste solcher Zeilen und keine Karte.</strong> Die
 * uebrigen vier Aufschluesselungen der Antwort gruppieren ueber ein Enum aus §2,
 * dessen Werte im Contract selbst stehen; ein {@code Map<ProjectStatus, Long>}
 * ist dort vollstaendig lesbar. Die Fakultaet ist dagegen eine Stammdatenzeile
 * (§3.8) mit ID, Namen und Kuerzel. Eine Karte ueber die UUID zwaenge die
 * Oberflaeche, zusaetzlich {@code GET /api/faculties} zu laden und beide
 * Antworten zusammenzufuehren, nur um eine Balkenreihe zu beschriften.
 *
 * <p>{@link ReferenceResponse} und kein eigenes Record fuer die Fakultaet: die
 * Projektantworten fuehren ihre Stammdatenbezuege bereits in genau dieser Form
 * (§3.3), und das Frontend hat dafuer einen Baustein. Ein zweites, fast
 * gleiches Record waere dieselbe Aussage in einer zweiten Gestalt.
 *
 * <p><strong>Drei Zahlen seit Contract v82, und sie sind nicht disjunkt.</strong>
 * {@code count} ist der Bestand, {@code inTop10} und {@code accepted} sind zwei
 * unabhaengige Teilmengen davon. Sie ueberschneiden sich in beide Richtungen:
 * ein angenommener Vorschlag fuehrt in der Regel auf einen Platz, aber ein
 * Projekt kann seinen Platz spaeter wieder verlieren (das Protokoll kennt
 * {@code REMOVED}, §3.17), und die Administration kann ein Projekt ohne jede
 * Nominierung unmittelbar aufnehmen. Fertig verrechnete, disjunkte Segmente
 * hier auszuliefern hiesse, eine Darstellungsentscheidung in den Contract zu
 * schreiben; die Rohzahlen sagen beide Sachverhalte, und die Oberflaeche
 * schneidet daraus ihre Balkenabschnitte.
 *
 * @param faculty  ID, Name und Kuerzel der Fakultaet
 * @param count    Zahl ihrer Projekte ueber alle Status. 0, wenn die Fakultaet
 *                 keine traegt: der Dienst fuellt fehlende Zeilen auf, damit
 *                 eine Fakultaet ohne Projekte als Null dasteht statt
 *                 stillschweigend zu verschwinden
 * @param inTop10  Zahl ihrer Projekte, die gerade einen Top-10-Platz belegen
 *                 (§3.11). Unabhaengig davon, ob das Projekt gerade
 *                 veroeffentlicht ist: der Platz bleibt belegt
 * @param accepted Zahl ihrer Projekte mit mindestens einer angenommenen
 *                 Nominierung (§2.8 {@code ACCEPTED}). Gezaehlt werden
 *                 Projekte, nicht Vorgaenge
 */
@Schema(name = "FacultyProjectCountResponse",
		description = "Projekte einer Fakultaet, Zeile von projectsByFaculty (§6.1).")
public record FacultyProjectCountResponse(

		@Schema(description = "Die Fakultaet mit ID, Name und Kuerzel (§3.8).")
		ReferenceResponse faculty,

		@Schema(description = "Zahl ihrer Projekte ueber alle Status, mindestens 0.",
				example = "26")
		long count,

		@Schema(description = "Zahl ihrer Projekte, die gerade einen Top-10-Platz belegen "
				+ "(§3.11). Teilmenge von count, aber nicht von accepted: die "
				+ "Administration kann ein Projekt auch ohne Nominierung aufnehmen.",
				example = "3")
		long inTop10,

		@Schema(description = "Zahl ihrer Projekte mit mindestens einer angenommenen "
				+ "Nominierung (§2.8). Teilmenge von count, aber nicht von inTop10: ein "
				+ "angenommenes Projekt kann seinen Platz spaeter wieder verlieren.",
				example = "4")
		long accepted) {
}
