package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.project.dto.ProjectDetailResponse;
import de.hsbremen.eportfolio.project.dto.RevisionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die vier Workflow-Endpoints aus API-Contract §6.1 (KAN-19): der
 * Zustandsautomat aus §4 als Aktionen am Projekt.
 *
 * <p><strong>Warum ein eigener Controller</strong> neben dem
 * {@link ProjectController}, aus demselben Grund wie beim
 * {@link BlockController}: das sind vier Aktionen mit einer gemeinsamen
 * Geschichte, dem redaktionellen Ablauf, und mit ganz anderen Lesern als die
 * Pflege der Metadaten. In der OpenAPI-Oberflaeche stehen sie damit unter einer
 * eigenen Ueberschrift, statt die Projektbeschreibung um vier fachfremde Zeilen
 * zu verlaengern.
 *
 * <p><strong>Warum {@code POST} und nicht {@code PATCH} auf das Projekt.</strong>
 * §6.1 legt die vier Pfade so fest, und das passt zur Sache: „einreichen" ist
 * eine Handlung mit Vorbedingungen, Nebenwirkungen und eigenem Recht, keine
 * Feldaenderung. Ein {@code PATCH {"status": "SUBMITTED"}} liesse dagegen offen,
 * welche der vier Handlungen gemeint ist, und legte die Regeln aus §4.1 in einen
 * Feldwert.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort ist fuer die
 * Projektpfade ausdruecklich nur {@code GET} freigegeben. Diese vier
 * {@code POST}-Pfade fallen damit unter
 * {@code anyRequest().authenticated()} und ergeben ohne Token 401
 * {@code NOT_AUTHENTICATED}; eine eigene Zeile brauchen sie nicht.
 * {@code @AuthenticationPrincipal} ist hier also nie {@code null}. Bewusst steht
 * dort auch kein {@code hasRole("EDITOR")} fuer {@code /approve} und
 * {@code /publish}: der 403 kaeme dann vor dem Laden des Projekts, und eine
 * unbekannte ID ergaebe 403 statt 404 (§6.3.1). Wer was darf, haengt ohnehin an
 * der Ressource und entscheidet der {@link ProjectPermissionService}.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen. Rechte,
 * Uebergangstabelle, Pflichtfelder und Historie liegen im
 * {@link ProjectWorkflowService}.
 */
@RestController
@RequestMapping("/api/projects/{projectId}")
@Tag(name = "Workflow", description = "Statusuebergaenge eines Projekts nach dem "
		+ "Zustandsautomaten aus §4: einreichen, genehmigen, veroeffentlichen, zur Ueberarbeitung "
		+ "zurueckgeben. Jeder Uebergang wird in der Statushistorie protokolliert (§3.12); ein "
		+ "Uebergang, der nicht in der Tabelle aus §4.1 steht, ergibt 409.")
public class ProjectWorkflowController {

	private final ProjectWorkflowService workflowService;

	public ProjectWorkflowController(ProjectWorkflowService workflowService) {
		this.workflowService = workflowService;
	}

	/**
	 * Einreichen.
	 *
	 * <p>Der einzige der vier Uebergaenge, den die Autor:in selbst ausloest, und
	 * der einzige mit einer Vollstaendigkeitspruefung (§3.3).
	 */
	@Operation(summary = "Projekt einreichen",
			description = "DRAFT oder REVISION nach SUBMITTED, ausgeloest von der Autor:in (§4.1). "
					+ "Geprueft werden dabei die Pflichtfelder aus §3.3: projectType, facultyId, "
					+ "studyProgramId, degree, categoryId und semester. Ab SUBMITTED sind Inhalt "
					+ "und Metadaten gesperrt.")
	@ApiResponse(responseCode = "200", description = "Das eingereichte Projekt, mit neuem Status "
			+ "und dem frischen Eintrag in statusHistory.")
	@ApiResponse(responseCode = "400", description = "PROJECT_INCOMPLETE: mindestens ein "
			+ "Pflichtfeld aus §3.3 fehlt. Die Meldung nennt alle fehlenden Felder.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht die Autor:in. "
			+ "Projektmitglieder duerfen mitschreiben, aber nicht einreichen (§4.1).")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_TRANSITION_INVALID: das "
			+ "Projekt steht nicht in DRAFT oder REVISION, ist also zum Beispiel schon "
			+ "eingereicht.")
	@PostMapping("/submit")
	public ProjectDetailResponse submit(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return workflowService.submit(user, projectId);
	}

	/** Genehmigen. */
	@Operation(summary = "Projekt genehmigen",
			description = "SUBMITTED nach APPROVED durch Redaktion oder Admin (§4.1). Genehmigt "
					+ "heisst noch nicht oeffentlich: die fachliche Freigabe und die "
					+ "Veroeffentlichung sind zwei Schritte (§2.2). Das Vier-Augen-Prinzip greift, "
					+ "eine Redakteur:in genehmigt ihr eigenes Projekt also nicht.")
	@ApiResponse(responseCode = "200", description = "Das genehmigte Projekt.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder Redaktion noch Admin, "
			+ "oder Redakteur:in des eigenen Projekts (Vier-Augen-Prinzip, §4.1).")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_TRANSITION_INVALID: das "
			+ "Projekt steht nicht in SUBMITTED.")
	@PostMapping("/approve")
	public ProjectDetailResponse approve(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return workflowService.approve(user, projectId);
	}

	/** Veroeffentlichen. */
	@Operation(summary = "Projekt veroeffentlichen",
			description = "APPROVED nach PUBLISHED durch Redaktion oder Admin (§4.1). Setzt "
					+ "publishedAt, und zwar nur beim ersten Mal: nach einer Ueberarbeitung bleibt "
					+ "das Datum der ersten Veroeffentlichung stehen. Ab hier ist das Projekt auch "
					+ "ohne Anmeldung sichtbar (§5).")
	@ApiResponse(responseCode = "200", description = "Das veroeffentlichte Projekt, mit "
			+ "publishedAt.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder Redaktion noch Admin, "
			+ "oder Redakteur:in des eigenen Projekts (Vier-Augen-Prinzip, §4.1).")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_TRANSITION_INVALID: das "
			+ "Projekt steht nicht in APPROVED, ist also noch nicht genehmigt.")
	@PostMapping("/publish")
	public ProjectDetailResponse publish(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return workflowService.publish(user, projectId);
	}

	/**
	 * Zur Ueberarbeitung zurueckgeben.
	 *
	 * <p>Der einzige der vier Uebergaenge mit einem Body, und der einzige, der
	 * neben dem Historieneintrag noch etwas anlegt: den Aenderungswunsch als
	 * Kommentar (§4.1).
	 */
	@Operation(summary = "Projekt zur Ueberarbeitung zurueckgeben",
			description = "SUBMITTED, APPROVED oder PUBLISHED nach REVISION durch Redaktion oder "
					+ "Admin (§4.1). Aus PUBLISHED heraus ist das das Zurueckziehen eines "
					+ "oeffentlichen Projekts. Die Begruendung aus dem Body wird ein "
					+ "CHANGE_REQUEST-Kommentar im Status OPEN und steht bewusst nicht in der "
					+ "Statushistorie: die Historie sagt, was passiert ist, der Kommentar, was zu "
					+ "tun ist. Danach ist das Projekt wieder bearbeitbar.")
	@ApiResponse(responseCode = "200", description = "Das zurueckgegebene Projekt.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: reason fehlt oder ist "
			+ "leer.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder Redaktion noch Admin. "
			+ "Das Vier-Augen-Prinzip greift hier nicht: eine Ruecknahme ist keine Freigabe.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_TRANSITION_INVALID: das "
			+ "Projekt steht in DRAFT oder bereits in REVISION, es gibt also nichts "
			+ "zurueckzugeben.")
	@PostMapping("/request-revision")
	public ProjectDetailResponse requestRevision(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId,

			@Valid @RequestBody RevisionRequest request) {

		return workflowService.requestRevision(user, projectId, request);
	}
}
