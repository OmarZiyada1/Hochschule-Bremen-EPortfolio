package de.hsbremen.eportfolio.editlock;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.editlock.dto.EditLockResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Bearbeitungssperre eines Projekts (§6.9).
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen, Statuscode
 * setzen. Rechte, Statusregeln und der Ablauf der Sperre liegen im
 * {@link EditLockService} und in der {@link EditLockRegistry}.
 *
 * <p><strong>Beide Pfade sind angemeldeten Personen vorbehalten</strong>, ohne
 * dass {@code config.SecurityConfig} dafuer eine Zeile braucht: die
 * PUBLIC-Liste dort gibt unterhalb von {@code /api/projects} nur {@code GET}
 * frei, und {@code POST} sowie {@code DELETE} auf einen laengeren Pfad fallen
 * damit unter {@code anyRequest().authenticated()}. Ohne Token gibt es 401
 * {@code NOT_AUTHENTICATED}. Dieselbe Ueberlegung wie bei
 * {@code DELETE /api/projects/*&#47;members/me} aus KAN-83.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/edit-lock")
@Tag(name = "Bearbeitungssperre", description = "An einem Projektinhalt schreibt jeweils eine "
		+ "Person (§6.9). Der Editor bewirbt sich beim Oeffnen um die Sperre und haelt sie mit "
		+ "einem Herzschlag; bleibt der aus, faellt sie von selbst frei. Durchgesetzt wird sie "
		+ "an den schreibenden Endpoints aus §6.1, die dann mit 409 "
		+ "PROJECT_LOCKED_BY_OTHER antworten.")
public class EditLockController {

	private final EditLockService editLockService;

	public EditLockController(EditLockService editLockService) {
		this.editLockService = editLockService;
	}

	@Operation(summary = "Sperre beanspruchen und Herzschlag setzen",
			description = "Tut beides in einem Aufruf und lehnt nie ab. Ist der Beitrag frei "
					+ "oder die bestehende Sperre abgelaufen, uebernimmt die aufrufende Person; "
					+ "haelt sie bereits, erneuert sie allein die Frist und behaelt ihren "
					+ "Beginn; haelt jemand anders, kommt dessen Name mit heldBySelf=false "
					+ "zurueck und der Editor bleibt zu. Der Aufruf aendert das Projekt nicht "
					+ "und erhoeht seine version nicht.")
	@ApiResponse(responseCode = "200", description = "Wer nach diesem Aufruf haelt.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht Teil der "
			+ "Projektseite. Die Sperre haelt nur, wer auch schreiben darf (§6.9).")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE: das Projekt "
			+ "steht in einem Status, in dem sein Inhalt nicht mehr geaendert wird (§4.1).")
	@PostMapping
	public EditLockResponse acquire(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return editLockService.acquire(user, projectId);
	}

	@Operation(summary = "Eigene Sperre freigeben",
			description = "Gibt allein die Sperre der aufrufenden Person frei und bricht keine "
					+ "fremde, auch nicht als Administration (§6.9). Idempotent: ein zweiter "
					+ "Aufruf und ein Aufruf ohne gehaltene Sperre antworten ebenfalls mit 204. "
					+ "Der Aufruf ist eine Beschleunigung und kein Verlass; bleibt er aus, "
					+ "faellt die Sperre nach ihrer Frist von selbst frei.")
	@ApiResponse(responseCode = "204", description = "Freigegeben, oder es gab nichts "
			+ "freizugeben.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht Teil der "
			+ "Projektseite.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE: das Projekt "
			+ "steht in einem Status, in dem sein Inhalt nicht mehr geaendert wird (§4.1). Die "
			+ "Sperre laeuft dann nach ihrer Frist ab.")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void release(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		editLockService.release(user, projectId);
	}
}
