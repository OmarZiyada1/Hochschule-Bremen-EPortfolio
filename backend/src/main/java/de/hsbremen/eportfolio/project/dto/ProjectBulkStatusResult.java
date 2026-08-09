package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Eine Zeile der Ergebnisliste von {@code POST /api/admin/projects/status}
 * (§6.1, KAN-46): was aus <em>diesem</em> Projekt geworden ist.
 *
 * <p><strong>Warum je Zeile berichtet wird und die Anfrage nicht als Ganzes
 * fehlschlaegt.</strong> Die Regeln aus §4.1 gelten weiterhin je Projekt: in
 * einer Auswahl von zwanzig kann ein einzelnes in einem Status stehen, der den
 * Uebergang nicht zulaesst. Ein Alles-oder-nichts-Verhalten blockierte die
 * anderen neunzehn grundlos, ein stilles Ueberspringen verschwiege den Fehler.
 * Die Ergebnisliste ist der einzige Weg, der beides vermeidet.
 *
 * <p><strong>{@code errorCode} ist ein Code aus §6.2</strong>, derselbe, den der
 * Einzel-Endpoint in seinem Envelope geliefert haette. Erreichbar sind hier
 * {@code PROJECT_NOT_FOUND} (die ID gibt es nicht),
 * {@code PROJECT_STATUS_TRANSITION_INVALID} (§4.1 fuehrt den Uebergang aus
 * diesem Status nicht), {@code PROJECT_VERSION_CONFLICT} (§6.4, jemand hat
 * dieselbe Zeile gleichzeitig geaendert) und {@code NO_PERMISSION}. Der letzte
 * ist die Vollstaendigkeit halber dabei und tritt heute nicht auf: den Endpoint
 * erreicht nur ADMIN, und §5 gibt dieser Rolle beide Uebergaenge frei.
 *
 * <p><strong>Kein Meldungstext.</strong> Entschieden wird im Client nach
 * {@code errorCode} und nie nach dem Wortlaut (§6.2); der Anzeigetext kommt aus
 * der i18n-Schicht des Frontends. Ein zweiter, serverseitig formulierter Satz je
 * Zeile waere Text, den niemand anzeigt.
 *
 * <p>Bei Erfolg steht {@code errorCode} auf {@code null} und wird trotzdem
 * mitgeschickt: eine ueber alle Zeilen gleiche Form ist fuer den generierten
 * Frontend-Typ einfacher als ein Feld, das mal da ist und mal nicht.
 *
 * @param projectId die angefragte ID, unveraendert zurueckgegeben, damit der
 *                  Client die Zeile seiner Auswahl zuordnen kann
 * @param success   ob der Uebergang stattgefunden hat
 * @param errorCode Grund des Scheiterns nach §6.2, sonst {@code null}
 */
public record ProjectBulkStatusResult(

		@Schema(description = "ID des Projekts, wie angefragt.")
		UUID projectId,

		@Schema(description = "true, wenn der Uebergang stattgefunden hat.")
		boolean success,

		@Schema(description = "Fehlercode aus §6.2, wenn dieses Projekt den Uebergang nicht "
				+ "durchlaufen hat; sonst null.",
				nullable = true,
				example = "PROJECT_STATUS_TRANSITION_INVALID")
		String errorCode) {

	/** Der Uebergang hat stattgefunden. */
	public static ProjectBulkStatusResult success(UUID projectId) {
		return new ProjectBulkStatusResult(projectId, true, null);
	}

	/** Der Uebergang ist an diesem Projekt gescheitert, mit dem Code aus §6.2. */
	public static ProjectBulkStatusResult failure(UUID projectId, String errorCode) {
		return new ProjectBulkStatusResult(projectId, false, errorCode);
	}
}
