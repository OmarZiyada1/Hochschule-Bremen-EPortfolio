package de.hsbremen.eportfolio.admin.dto;

import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

/**
 * Die Kennzahlen von {@code GET /api/admin/dashboard} (§6.1).
 *
 * <p><strong>Jede Karte enthaelt alle Werte ihres Enums, auch die mit 0.</strong>
 * Eine Datenbank liefert bei {@code group by} nur Zeilen, zu denen es Datensaetze
 * gibt; der Dienst fuellt die fehlenden auf. Ohne das muesste das Frontend die
 * Liste der Status, Rollen und Blocktypen selbst kennen, um ein vollstaendiges
 * Diagramm zu zeichnen, und eine Kategorie ohne Datensaetze verschwaende
 * stillschweigend statt als Null dazustehen. Damit haette der Contract seine
 * Enums an zwei Stellen: hier und noch einmal im Client.
 *
 * <p>Die Reihenfolge der Schluessel ist die Deklarationsreihenfolge des Enums
 * ({@code EnumMap}), nicht die alphabetische. Bei {@link ProjectStatus} ist das
 * zugleich die Reihenfolge des Zustandsautomaten aus §4.1, also genau die, in
 * der eine Balkenreihe zu lesen ist.
 *
 * <p><strong>Eine der sieben Kennzahlen ist keine Karte.</strong>
 * {@code projectsByFaculty} gruppiert nicht ueber ein Enum, sondern ueber eine
 * Stammdatenzeile (§3.8), und traegt deshalb Name und Kuerzel mit; Begruendung
 * an {@link FacultyProjectCountResponse}. Das Auffuellen gilt dort genauso: auch
 * eine Fakultaet ohne Projekte steht in der Liste.
 *
 * @param projectsByStatus Projekte je Status (§2.2), ueber alle Projekte und
 *                         ohne Sichtbarkeitsschranke: §5 gibt ADMIN jedes
 *                         Projekt in jedem Status frei
 * @param projectsByFaculty Projekte je Fakultaet (§3.8), sortiert nach dem
 *                          Kuerzel und mit jeder Fakultaet, auch der ohne
 *                          Projekte (Contract v76). Projekte ohne Fakultaet
 *                          gehen nicht ein, weil {@code Project.facultyId} bis
 *                          zum Einreichen null ist (§3.3); die Summe dieser
 *                          Liste ist deshalb kleiner oder gleich der Summe von
 *                          {@code projectsByStatus} und nicht die Gesamtzahl
 * @param usersTotal       Zahl aller Konten, einschliesslich der deaktivierten
 *                         und der noch nicht abgeschlossenen Registrierungen.
 *                         Steht bewusst neben den beiden Aufschluesselungen und
 *                         nicht als deren Summe im Client, damit die Karte
 *                         „Konten insgesamt" ohne Rechnung anzeigbar ist
 * @param usersByRole      Konten je Rolle (§2.1)
 * @param usersByStatus    Konten je Kontostatus (§2.9)
 * @param openNominations  Top-10-Vorschlaege im Stand {@code PENDING} (§2.8),
 *                         also die offene Arbeit der Administration. Eine
 *                         einzelne Zahl und keine Aufschluesselung: entschiedene
 *                         Nominierungen stehen im Protokoll unter
 *                         {@code GET /api/admin/top10-nominations}
 * @param blocksByType     Inhaltsbloecke je Typ (§2.5) ueber alle Projekte.
 *                         Moeglich, weil {@code Block.type} eine eigene Spalte
 *                         ist und nicht nur im {@code jsonb} des Inhalts steckt
 */
@Schema(name = "DashboardResponse",
		description = "Kennzahlen der Administrationsseite (§6.1). Jede Aufschluesselung ist "
				+ "vollstaendig: die Enum-Karten tragen alle Werte ihres Enums, "
				+ "projectsByFaculty jede Fakultaet, beides auch mit dem Wert 0.")
public record DashboardResponse(

		@Schema(description = "Projekte je Status (§2.2).",
				example = "{\"DRAFT\":12,\"SUBMITTED\":3,\"APPROVED\":1,\"PUBLISHED\":47,\"REVISION\":2}")
		Map<ProjectStatus, Long> projectsByStatus,

		@Schema(description = "Projekte je Fakultaet (§3.8), sortiert nach Kuerzel. Enthaelt "
				+ "jede Fakultaet, auch die ohne Projekte. Projekte ohne Fakultaet gehen "
				+ "nicht ein; die Summe ist daher nicht die Gesamtzahl der Projekte.")
		List<FacultyProjectCountResponse> projectsByFaculty,

		@Schema(description = "Zahl aller Konten, einschliesslich deaktivierter und noch "
				+ "nicht abgeschlossener Registrierungen.", example = "128")
		long usersTotal,

		@Schema(description = "Konten je Rolle (§2.1).",
				example = "{\"STUDENT\":120,\"EDITOR\":6,\"ADMIN\":2}")
		Map<Role, Long> usersByRole,

		@Schema(description = "Konten je Kontostatus (§2.9).",
				example = "{\"REGISTRATION_PENDING\":4,\"ACTIVE\":121,\"DEACTIVATED\":3}")
		Map<UserStatus, Long> usersByStatus,

		@Schema(description = "Top-10-Vorschlaege, ueber die noch nicht entschieden wurde "
				+ "(Stand PENDING, §2.8).", example = "5")
		long openNominations,

		@Schema(description = "Inhaltsbloecke je Blocktyp (§2.5), ueber alle Projekte.")
		Map<BlockType, Long> blocksByType) {
}
