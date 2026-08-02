package de.hsbremen.eportfolio.projekt.dto;

import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import de.hsbremen.eportfolio.projekt.Projekt;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ein Projekt in der Listenansicht von {@code GET /api/projekte} (§6.1).
 *
 * <p>Die Kachel traegt genau das, was Uebersicht und Filterleiste anzeigen.
 * Nicht enthalten sind {@code blocks}, {@code mitglieder}, {@code redakteure},
 * die Statushistorie und {@code version}: das Blockdokument je Treffer zu laden
 * waere fuer eine Liste unverhaeltnismaessig, und die uebrigen Felder
 * unterliegen einer Sichtbarkeitspruefung, die je Projekt zu treffen waere.
 * Wer sie braucht, holt sich {@link ProjektDetailAntwort}.
 *
 * @param id                ID des Projekts
 * @param titel             Titel; Metadatum, kein Inhaltsblock (§3.3)
 * @param kurzbeschreibung  Teaser fuer die Kachel
 * @param coverBildUrl      Kachelbild
 * @param status            aktueller Status (§2.2)
 * @param projekttyp        (§2.6)
 * @param abschluss         (§2.7)
 * @param semester          z. B. „WS 2025/26"
 * @param kategorie         (§3.6)
 * @param fakultaet         (§3.8)
 * @param studiengang       (§3.7)
 * @param autor             Ersteller:in und Eigentuemer:in
 * @param tags              freie Schlagwoerter, hoechstens fuenf
 * @param reaktionAnzahl    {@code COUNT} der Reaktionen (§3.10)
 * @param veroeffentlichtAm gesetzt beim Uebergang nach {@code VEROEFFENTLICHT}
 */
public record ProjektKachelAntwort(
		UUID id,

		String titel,

		@Schema(description = "Teaser fuer Kachel- und Listenansicht. Kann fehlen.", nullable = true)
		String kurzbeschreibung,

		@Schema(description = "Kachelbild. Kann fehlen.", nullable = true)
		String coverBildUrl,

		ProjektStatus status,

		@Schema(description = "Im ENTWURF noch nicht gesetzt; Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		Projekttyp projekttyp,

		@Schema(description = "Im ENTWURF noch nicht gesetzt; Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		Abschluss abschluss,

		@Schema(description = "Semester der Entstehung, z. B. \"WS 2025/26\".",
				example = "WS 2025/26", nullable = true)
		String semester,

		ReferenzAntwort kategorie,

		ReferenzAntwort fakultaet,

		ReferenzAntwort studiengang,

		PersonAntwort autor,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf. Alphabetisch sortiert, "
				+ "damit die Reihenfolge zwischen zwei Aufrufen stabil bleibt.")
		List<String> tags,

		@Schema(description = "Zahl der Reaktionen auf dieses Projekt (§3.10).", example = "12")
		long reaktionAnzahl,

		@Schema(description = "Zeitpunkt der Veroeffentlichung. Null, solange das Projekt "
				+ "nicht veroeffentlicht ist.", nullable = true)
		Instant veroeffentlichtAm) {

	/**
	 * Baut die Kachel.
	 *
	 * <p>{@code tags} und {@code reaktionAnzahl} kommen von aussen und werden
	 * nicht am Projekt nachgeladen: der Lesedienst holt beides fuer die ganze
	 * Seite in je einer Abfrage. Wuerde dieses Record sie selbst vom Projekt
	 * ziehen, entstuenden pro Kachel zwei zusaetzliche Abfragen und damit genau
	 * das N+1-Problem, das der Ticket-Hinweis meint.
	 *
	 * @param projekt        Projekt mit bereits geladenen Bezuegen (Autor,
	 *                       Kategorie, Fakultaet, Studiengang)
	 * @param tags           Schlagwoerter dieses Projekts, sortiert
	 * @param reaktionAnzahl Zahl der Reaktionen
	 */
	public static ProjektKachelAntwort aus(Projekt projekt, List<String> tags, long reaktionAnzahl) {
		return new ProjektKachelAntwort(
				projekt.getId(),
				projekt.getTitel(),
				projekt.getKurzbeschreibung(),
				projekt.getCoverBildUrl(),
				projekt.getStatus(),
				projekt.getProjekttyp(),
				projekt.getAbschluss(),
				projekt.getSemester(),
				ReferenzAntwort.aus(projekt.getKategorie()),
				ReferenzAntwort.aus(projekt.getFakultaet()),
				ReferenzAntwort.aus(projekt.getStudiengang()),
				PersonAntwort.aus(projekt.getAutor()),
				tags,
				reaktionAnzahl,
				projekt.getVeroeffentlichtAm());
	}
}
