package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.project.dto.ProjectBulkStatusRequest;
import de.hsbremen.eportfolio.project.dto.ProjectBulkStatusResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Projektzeile des Admin-Bereichs aus API-Contract §6.1 (KAN-46):
 * {@code POST /api/admin/projects/status}.
 *
 * <p><strong>Warum im Paket {@code project} und nicht in {@code admin}.</strong>
 * {@code docs/ARCHITEKTUR.md} §12 haelt fest, dass der Schnitt quer zum
 * Pfadpraefix liegt: die Endpoints unter {@code /api/admin} liegen in dem Paket,
 * dessen Entities sie bearbeiten. So halten es {@code MasterDataAdminController}
 * und {@code Top10AdminController} schon; das Paket {@code admin} traegt allein,
 * was in kein Feature passt (Dashboard und Nutzerverwaltung). Dieser Endpoint
 * bewegt Projekte durch den Zustandsautomaten und gehoert damit neben den
 * {@link ProjectWorkflowController}.
 *
 * <p><strong>Getrennt vom {@link ProjectWorkflowController}</strong>, obwohl
 * beide denselben Dienst nutzen: dort ist die handelnde Person die Redaktion und
 * die Ressource ein einzelnes Projekt, hier ist es die Verwaltung und eine
 * Auswahl. Auch die Rechteebene ist eine andere, siehe unten. In der
 * OpenAPI-Oberflaeche stehen sie deshalb unter zwei Ueberschriften.
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette:</strong>
 * {@code SecurityConfig} fuehrt {@code /api/admin/**} mit
 * {@code hasRole("ADMIN")}, eine eigene Zeile braucht dieser Pfad also nicht.
 * Die Ressourcenebene prueft der {@link ProjectWorkflowService} je Projekt ueber
 * {@code ProjectPermissionService.mayTrigger} (§5), wie beim Einzel-Endpoint.
 */
@RestController
@RequestMapping("/api/admin/projects")
@Tag(name = "Projektverwaltung", description = "Sammel-Statuswechsel der Administrationsseite "
		+ "(§6.1). Ausschliesslich fuer ADMIN (§5). Die Regeln aus §4.1 gelten unveraendert je "
		+ "Projekt; berichtet wird deshalb je Zeile und nicht als Ganzes.")
public class ProjectAdminController {

	private final ProjectAdminService adminService;

	public ProjectAdminController(ProjectAdminService adminService) {
		this.adminService = adminService;
	}

	/**
	 * Sammel-Statuswechsel.
	 *
	 * <p>Der Controller bleibt duenn wie ueberall: Body binden, Dienst rufen.
	 * Die Uebersetzung von {@code action} in den Uebergang aus §4.1 und die
	 * Fehlerbehandlung je Projekt liegen im {@link ProjectAdminService}.
	 */
	@Operation(summary = "Status mehrerer Projekte aendern",
			description = "Fuehrt fuer jedes Projekt der Auswahl denselben Uebergang aus, "
					+ "entweder publish oder request-revision. Jedes Projekt wird einzeln "
					+ "geprueft und in einer eigenen Transaktion verarbeitet: ein Projekt, das "
					+ "nach §4.1 gerade nicht uebergehen darf, blockiert die uebrigen nicht, "
					+ "sondern traegt seinen Fehlercode in seiner Zeile. Aufgerufen wird je "
					+ "Projekt derselbe Dienst wie beim Einzel-Endpoint, samt Rechtepruefung, "
					+ "Statushistorie (§3.12) und, bei request-revision, dem "
					+ "CHANGE_REQUEST-Kommentar.")
	@ApiResponse(responseCode = "200", description = "Ein Ergebnis je angefragter ID, in der "
			+ "Reihenfolge des Bodys. Auch dann, wenn keine einzige Zeile erfolgreich war: die "
			+ "Anfrage selbst war in Ordnung.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: projectIds ist leer, "
			+ "action ist unbekannt, oder reason passt nicht zur Aktion (Pflicht bei "
			+ "request-revision, unzulaessig bei publish).")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@PostMapping("/status")
	public ProjectBulkStatusResponse changeStatus(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid ProjectBulkStatusRequest request) {

		return adminService.changeStatus(user, request);
	}
}
