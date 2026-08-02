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
 * Ein Projekt in der Detailansicht von {@code GET /api/projekte/{id}} (§6.1).
 *
 * <p>Enthaelt gegenueber {@link ProjektKachelAntwort} zusaetzlich das Modul, die
 * Projektmitglieder, den geordneten Inhalt, {@code version} sowie die
 * Audit-Zeitstempel.
 *
 * <p><strong>Zwei Felder haengen an einer Sichtbarkeitspruefung:</strong>
 * {@code redakteure} und {@code statusHistorie} sind nur fuer die Projektseite,
 * die zugewiesene Redaktion und Admins gefuellt (§5 Fussnote ⁷, §3.12). Fuer
 * alle anderen stehen sie auf {@code null}, und zwar bewusst auf {@code null}
 * und nicht auf die leere Liste: das Frontend soll „darf ich nicht sehen" von
 * „es gibt keine"
 * unterscheiden koennen. Eine leere Liste in beiden Faellen wuerde etwa
 * suggerieren, ein Projekt habe keine Redaktion, obwohl es eine hat.
 *
 * @param id                ID des Projekts
 * @param titel             Titel; Metadatum, kein Inhaltsblock (§3.3)
 * @param kurzbeschreibung  Teaser
 * @param coverBildUrl      Kachelbild
 * @param status            aktueller Status (§2.2)
 * @param projekttyp        (§2.6)
 * @param abschluss         (§2.7)
 * @param semester          z. B. „WS 2025/26"
 * @param kategorie         (§3.6)
 * @param fakultaet         (§3.8)
 * @param studiengang       (§3.7)
 * @param modul             (§3.9)
 * @param autor             Ersteller:in und Eigentuemer:in
 * @param mitglieder        Co-Autor:innen und Mitwirkende (§3.13)
 * @param tags              freie Schlagwoerter, hoechstens fuenf
 * @param blocks            Inhalt, nach {@code reihenfolge} geordnet (§3.4)
 * @param reaktionAnzahl    {@code COUNT} der Reaktionen (§3.10)
 * @param redakteure        zugewiesene Redaktion; {@code null}, wenn die
 *                          anfragende Person sie nicht sehen darf
 * @param statusHistorie    Aktivitaetsverlauf; {@code null}, wenn die anfragende
 *                          Person ihn nicht sehen darf
 * @param version           Stand fuer Optimistic Locking; gehoert bei jedem
 *                          schreibenden Request in den Body (§6.4)
 * @param veroeffentlichtAm gesetzt beim Uebergang nach {@code VEROEFFENTLICHT}
 * @param erstelltAm        Anlagezeitpunkt
 * @param aktualisiertAm    letzte Aenderung
 */
public record ProjektDetailAntwort(
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

		ReferenzAntwort modul,

		PersonAntwort autor,

		@Schema(description = "Co-Autor:innen und Mitwirkende (§3.13). Nicht zu verwechseln "
				+ "mit der zugewiesenen Redaktion.")
		List<MitgliedAntwort> mitglieder,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf. Alphabetisch sortiert, "
				+ "damit die Reihenfolge zwischen zwei Aufrufen stabil bleibt.")
		List<String> tags,

		@Schema(description = "Inhalt des Projekts, nach reihenfolge aufsteigend geordnet. "
				+ "Ein frischer ENTWURF hat keine Bloecke.")
		List<BlockAntwort> blocks,

		@Schema(description = "Zahl der Reaktionen auf dieses Projekt (§3.10).", example = "12")
		long reaktionAnzahl,

		@Schema(description = "Zugewiesene Redakteur:innen (§3.3). Null, wenn die anfragende "
				+ "Person sie nicht sehen darf (§5, Fussnote 7); eine leere Liste bedeutet "
				+ "dagegen, dass keine Redaktion zugewiesen ist.", nullable = true)
		List<PersonAntwort> redakteure,

		@Schema(description = "Aktivitaetsverlauf, aufsteigend nach Zeitpunkt (§3.12). Null, "
				+ "wenn die anfragende Person ihn nicht sehen darf (§5, Fussnote 7).",
				nullable = true)
		List<StatusHistorieAntwort> statusHistorie,

		@Schema(description = "Stand fuer Optimistic Locking. Gehoert unveraendert in den Body "
				+ "jedes schreibenden Requests (§6.4).", example = "3")
		Long version,

		@Schema(description = "Zeitpunkt der Veroeffentlichung. Null, solange das Projekt "
				+ "nicht veroeffentlicht ist.", nullable = true)
		Instant veroeffentlichtAm,

		Instant erstelltAm,

		Instant aktualisiertAm) {

	/**
	 * Baut die Detailantwort.
	 *
	 * <p>Alle Sammlungen kommen von aussen, weil der Lesedienst sie mit
	 * geladenen Bezuegen holt (Mitglieder mit ihrem Konto, Historie mit der
	 * aendernden Person) und weil ueber {@code redakteure} und
	 * {@code statusHistorie} zuvor eine Berechtigungsentscheidung faellt. Ein
	 * Record, das sich diese Daten selbst vom Projekt zieht, koennte sie nicht
	 * treffen.
	 *
	 * @param projekt        Projekt mit geladenen Bezuegen
	 * @param tags           Schlagwoerter, sortiert
	 * @param reaktionAnzahl Zahl der Reaktionen
	 * @param mitglieder     Projektmitglieder (§3.13)
	 * @param blocks         Inhalt, nach {@code reihenfolge} geordnet
	 * @param redakteure     zugewiesene Redaktion oder {@code null}, wenn sie
	 *                       nicht sichtbar ist
	 * @param statusHistorie Verlauf oder {@code null}, wenn er nicht sichtbar ist
	 */
	public static ProjektDetailAntwort aus(
			Projekt projekt,
			List<String> tags,
			long reaktionAnzahl,
			List<MitgliedAntwort> mitglieder,
			List<BlockAntwort> blocks,
			List<PersonAntwort> redakteure,
			List<StatusHistorieAntwort> statusHistorie) {

		return new ProjektDetailAntwort(
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
				ReferenzAntwort.aus(projekt.getModul()),
				PersonAntwort.aus(projekt.getAutor()),
				mitglieder,
				tags,
				blocks,
				reaktionAnzahl,
				redakteure,
				statusHistorie,
				projekt.getVersion(),
				projekt.getVeroeffentlichtAm(),
				projekt.getErstelltAm(),
				projekt.getAktualisiertAm());
	}
}
