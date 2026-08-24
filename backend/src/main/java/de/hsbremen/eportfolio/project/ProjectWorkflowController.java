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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Workflow-Endpoints aus API-Contract §6.1 (KAN-19, {@code /withdraw} seit
 * v50): der Zustandsautomat aus §4 als Aktionen am Projekt.
 *
 * <p><strong>Warum ein eigener Controller</strong> neben dem
 * {@link ProjectController}, aus demselben Grund wie beim
 * {@link BlockController}: das sind Aktionen mit einer gemeinsamen
 * Geschichte, dem redaktionellen Ablauf, und mit ganz anderen Lesern als die
 * Pflege der Metadaten. In der OpenAPI-Oberflaeche stehen sie damit unter einer
 * eigenen Ueberschrift, statt die Projektbeschreibung um fachfremde Zeilen
 * zu verlaengern.
 *
 * <p><strong>Warum {@code POST} und nicht {@code PATCH} auf das Projekt.</strong>
 * §6.1 legt die Pfade so fest, und das passt zur Sache: „einreichen" ist
 * eine Handlung mit Vorbedingungen, Nebenwirkungen und eigenem Recht, keine
 * Feldaenderung. Ein {@code PATCH {"status": "SUBMITTED"}} liesse dagegen offen,
 * welche der Handlungen gemeint ist, und legte die Regeln aus §4.1 in einen
 * Feldwert.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort ist fuer die
 * Projektpfade ausdruecklich nur {@code GET} freigegeben. Diese
 * {@code POST}-Pfade (einschliesslich {@code /withdraw}, v50) fallen damit unter
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
					+ "studyProgramId, degree, categoryId, semesterId und editorIds. Ohne "
					+ "zugewiesene Redaktion laesst sich seit Contract v59 nicht einreichen, weil "
					+ "das Projekt sonst bei niemandem zur Begutachtung auftaucht. Ab SUBMITTED "
					+ "sind Inhalt und Metadaten gesperrt.")
	@ApiResponse(responseCode = "200", description = "Das eingereichte Projekt, mit neuem Status "
			+ "und dem frischen Eintrag in statusHistory.")
	@ApiResponse(responseCode = "400", description = "PROJECT_INCOMPLETE: mindestens ein "
			+ "Pflichtfeld aus §3.3 fehlt. Die Meldung nennt alle fehlenden Felder.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder die Autor:in "
			+ "noch, seit Contract v73 und nur aus REVISION, die zugewiesene Redaktion oder "
			+ "die Administration (§4.1, §5). Aus DRAFT reicht allein die Autor:in ein.")
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

	/**
	 * Zurueckziehen.
	 *
	 * <p>Das Gegenstueck zum Einreichen (§4.1, seit v50): die Autor:in holt die
	 * eigene Einreichung zurueck, solange die Redaktion nicht entschieden hat.
	 */
	@Operation(summary = "Projekt zurueckziehen",
			description = "SUBMITTED nach DRAFT, ausgeloest von der Autor:in (§4.1, seit v50). "
					+ "Ohne die Pruefungen des Einreichens: Vollstaendigkeit und offene "
					+ "Aenderungswuensche betreffen nur den Weg zur Redaktion. Danach ist das "
					+ "Projekt wieder bearbeitbar und als Entwurf auch loeschbar (§6.1).")
	@ApiResponse(responseCode = "200", description = "Das zurueckgezogene Projekt, mit neuem "
			+ "Status und dem frischen Eintrag in statusHistory.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht die Autor:in. "
			+ "Projektmitglieder duerfen mitschreiben, aber nicht zurueckziehen (§4.1).")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_TRANSITION_INVALID: das "
			+ "Projekt steht nicht in SUBMITTED; nach einer redaktionellen Entscheidung "
			+ "fuehrt der Weg zurueck nur ueber request-revision.")
	@PostMapping("/withdraw")
	public ProjectDetailResponse withdraw(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return workflowService.withdraw(user, projectId);
	}

	/** Genehmigen. */
	@Operation(summary = "Projekt genehmigen",
			description = "SUBMITTED nach APPROVED durch Redaktion oder Admin (§4.1). Genehmigt "
					+ "heisst noch nicht oeffentlich: die fachliche Freigabe und die "
					+ "Veroeffentlichung sind zwei Schritte (§2.2). Das Vier-Augen-Prinzip greift "
					+ "und reicht seit Contract v61 ueber die gesamte Projektseite: wer an einem "
					+ "Projekt mitgeschrieben hat, genehmigt es nicht, auch nicht als zugewiesene "
					+ "Redaktion.")
	@ApiResponse(responseCode = "200", description = "Das genehmigte Projekt.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder zugewiesene Redaktion "
			+ "noch Admin, oder Teil der Projektseite dieses Projekts, also Autor:in oder "
			+ "Projektmitglied (Vier-Augen-Prinzip, §4.1, §5 Fussnote 1).")
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
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder zugewiesene Redaktion "
			+ "noch Admin, oder Teil der Projektseite dieses Projekts, also Autor:in oder "
			+ "Projektmitglied (Vier-Augen-Prinzip, §4.1, §5 Fussnote 1).")
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
			+ "zurueckzugeben. RESOURCE_IN_USE (seit Contract v72): das veroeffentlichte "
			+ "Projekt steht in der kuratierten Top-10; die Administration nimmt es zuerst "
			+ "aus der Liste, ueber PUT /api/admin/top10 oder ueber das Zurueckziehen der "
			+ "Nominierung.")
	@PostMapping("/request-revision")
	public ProjectDetailResponse requestRevision(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId,

			@Valid @RequestBody RevisionRequest request) {

		return workflowService.requestRevision(user, projectId, request);
	}

	// ------------------------------------------------------------------
	// DELETE /api/projects/{projectId}/editors/me
	// ------------------------------------------------------------------

	@Operation(summary = "Eigene Redaktionszuweisung abgeben",
			description = "Nimmt die anfragende Person aus der zustaendigen Redaktion des "
					+ "Projekts (§6.1, §4.1, seit Contract v68). Moeglich nur fuer die "
					+ "zugewiesene Person selbst und nur in SUBMITTED oder REVISION. War es "
					+ "die letzte Zuweisung, faellt das Projekt nach DRAFT zurueck und die "
					+ "Statushistorie fuehrt den Uebergang; sonst aendert sich allein die "
					+ "Zuweisung. Kommentare bleiben unberuehrt.")
	@ApiResponse(responseCode = "200", description = "Die Zuweisung ist aufgehoben. Die Antwort "
			+ "traegt die neue version, den ggf. geaenderten Status und die frische "
			+ "statusHistory.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die anfragende Person ist "
			+ "diesem Projekt nicht als Redaktion zugewiesen. Fremde Zuweisungen aendert die "
			+ "Administration ueber PUT /api/projects/{id}/editors.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE: das Projekt "
			+ "steht weder in SUBMITTED noch in REVISION. Im DRAFT pflegt die Autor:in die "
			+ "Zuweisung selbst, ab APPROVED ist die redaktionelle Arbeit getan.")
	@DeleteMapping("/editors/me")
	public ProjectDetailResponse resignAsEditor(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return workflowService.resignAsEditor(user, projectId);
	}
}
