package de.hsbremen.eportfolio.reaction;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.reaction.dto.ReactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die beiden Reaktions-Endpoints aus API-Contract §6.1 (KAN-21).
 *
 * <p><strong>Ein Pfad, zwei Methoden.</strong> {@code POST} setzt die Reaktion
 * der angemeldeten Person, {@code DELETE} nimmt sie zurueck; beide antworten mit
 * 200 und dem aktuellen Zaehler. Die Reaktion bekommt bewusst keine eigene ID im
 * Pfad: sie ist durch Projekt und angemeldete Person bereits eindeutig bestimmt
 * (§3.10, {@code unique(projectId, userId)}), und eine ID im Pfad waere eine
 * zweite Angabe derselben Sache, die auseinanderfallen kann.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort steht fuer
 * {@code /api/projects/*} nur {@code GET} als PUBLIC-Pfad. {@code POST} und
 * {@code DELETE} auf diesen Pfad fallen damit unter
 * {@code anyRequest().authenticated()} und ergeben ohne Token 401, genau wie
 * §5 es fuer die Zeile „Reaktion geben" verlangt (PUBLIC ✗). Es braucht deshalb
 * keine eigene Regel; eine Rollenregel waere hier ohnehin zu grob, weil das
 * Recht am Projektstatus haengt und nicht an der Rolle.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen. Rechte,
 * Idempotenz und Zaehlung liegen im {@link ReactionService}.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/reaction")
@Tag(name = "Reaktionen", description = "Die Zustimmung zu einem veroeffentlichten Projekt, "
		+ "eine je Person und Projekt (§3.10). Beide Endpoints sind idempotent und liefern den "
		+ "Zaehler zurueck, den die Oberflaeche am Knopf anzeigt.")
public class ReactionController {

	private final ReactionService reactionService;

	public ReactionController(ReactionService reactionService) {
		this.reactionService = reactionService;
	}

	/** Reaktion setzen. */
	@Operation(summary = "Reaktion setzen",
			description = "Setzt die Reaktion der angemeldeten Person auf dieses Projekt und "
					+ "liefert die neue Gesamtzahl. Idempotent: ein wiederholter Aufruf legt keine "
					+ "zweite Zeile an und aendert den Zaehler nicht. Moeglich nur an "
					+ "veroeffentlichten Projekten (§3.10); auf das eigene veroeffentlichte Projekt "
					+ "darf reagiert werden, §5 kennt dafuer kein Vier-Augen-Prinzip. Die Antwort "
					+ "ist 200 und nicht 201, weil keine eigenstaendig adressierbare Ressource "
					+ "entsteht (§6.1).")
	@ApiResponse(responseCode = "200", description = "Die Reaktion ist gesetzt; count ist die "
			+ "Gesamtzahl der Reaktionen dieses Projekts.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: das Projekt ist nicht "
			+ "veroeffentlicht.")
	@ApiResponse(responseCode = "404", description = "PROJECT_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Projekt.")
	@PostMapping
	public ReactionResponse react(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return reactionService.react(user, projectId);
	}

	/** Eigene Reaktion zuruecknehmen. */
	@Operation(summary = "Eigene Reaktion zuruecknehmen",
			description = "Entfernt die Reaktion der angemeldeten Person an diesem Projekt und "
					+ "liefert die neue Gesamtzahl. Betroffen ist ausschliesslich die eigene Zeile; "
					+ "eine fremde Reaktion laesst sich ueber diesen Endpoint gar nicht adressieren. "
					+ "Idempotent: gibt es keine Reaktion, bleibt der Aufruf folgenlos und antwortet "
					+ "trotzdem mit 200. Die Antwort ist 200 und nicht 204, weil der Client den "
					+ "neuen Zaehler braucht (§6.1).")
	@ApiResponse(responseCode = "200", description = "Es liegt keine Reaktion dieser Person mehr "
			+ "vor; count ist die Gesamtzahl der Reaktionen dieses Projekts.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: das Projekt ist nicht "
			+ "veroeffentlicht.")
	@ApiResponse(responseCode = "404", description = "PROJECT_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Projekt.")
	@DeleteMapping
	public ReactionResponse withdraw(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return reactionService.withdraw(user, projectId);
	}
}
