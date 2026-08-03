package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.project.dto.BlocksResponse;
import de.hsbremen.eportfolio.project.dto.BlocksUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die beiden Block-Endpoints aus API-Contract §6.1 (KAN-18): der Inhalt eines
 * Projekts, lesend und als Autosave-Pfad des Editors.
 *
 * <p><strong>Warum ein eigener Controller neben dem
 * {@link ProjectController}.</strong> Die Bloecke sind eine eigene Ressource mit
 * eigener Antwortform und eigenem Lebenszyklus: der Editor ruft sie im
 * Sekundentakt, waehrend die Metadaten unberuehrt bleiben (§6.1). Sie im
 * Projekt-Controller unterzubringen hiesse, zwei Ressourcen an einer Klasse
 * haengen zu lassen, deren Beschreibungen nichts miteinander zu tun haben.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort steht
 * {@code /api/projects/*&#47;blocks} bereits als PUBLIC-GET, die Regel stand
 * schon vor diesem Controller. Freigegeben ist ausdruecklich nur {@code GET};
 * das {@code PUT} faellt unter {@code anyRequest().authenticated()} und ergibt
 * ohne Token 401. Was ein Aufrufer beim {@code GET} tatsaechlich zu sehen
 * bekommt, entscheidet der {@link ProjectPermissionService} und nicht die
 * Filterkette.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen. Rechte,
 * Statusregeln, Versionspruefung und Blockvalidierung liegen im
 * {@link BlockService}.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/blocks")
@Tag(name = "Bloecke", description = "Inhalt eines Projekts als geordnete Blockliste (§2.5, "
		+ "§3.4). Lesen folgt der Sichtbarkeit des Projekts; Schreiben ist der Autosave-Pfad des "
		+ "Editors und ersetzt die Liste vollstaendig.")
public class BlockController {

	private final BlockService blockService;

	public BlockController(BlockService blockService) {
		this.blockService = blockService;
	}

	/**
	 * Blockliste eines Projekts.
	 *
	 * <p>Die Fehlerfaelle folgen §6.3.1 und sind bewusst unterscheidbar: 404,
	 * wenn es die ID nicht gibt, 401 ohne Anmeldung, 403 bei fehlendem
	 * Leserecht.
	 */
	@Operation(summary = "Inhalt eines Projekts lesen",
			description = "Liefert die Bloecke geordnet nach orderIndex, dazu die aktuelle version "
					+ "des Projekts fuer den naechsten schreibenden Request (§6.4). Sichtbar ist "
					+ "der Inhalt genau dann, wenn auch das Projekt sichtbar ist (§5).")
	@ApiResponse(responseCode = "200", description = "version und Blockliste.")
	@ApiResponse(responseCode = "401", description = "Das Projekt ist nicht oeffentlich und es "
			+ "wurde kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Leserecht auf dieses "
			+ "Projekt.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@GetMapping
	public BlocksResponse list(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return blockService.list(user, projectId);
	}

	/**
	 * Gesamten Inhalt ersetzen: der Autosave-Pfad.
	 *
	 * <p>Ausdruecklich nicht die Metadaten: die laufen ueber
	 * {@code PUT /api/projects/{id}}. Die Trennung besteht, weil der Editor
	 * zeitversetzt automatisch speichert und dabei sonst bei jedem Tastenanschlag
	 * die Metadaten mitschreiben wuerde (§6.1).
	 */
	@Operation(summary = "Inhalt eines Projekts speichern",
			description = "Ersetzt die Blockliste vollstaendig, in einer Transaktion. Bloecke mit "
					+ "id werden aktualisiert, Bloecke ohne id neu angelegt, nicht mehr enthaltene "
					+ "geloescht. Erlaubt sind Autor:in und Projektmitglieder, und nur in den "
					+ "Status DRAFT und REVISION (§4.1). Die Antwort enthaelt die "
					+ "server-vergebenen IDs und die neue version.")
	@ApiResponse(responseCode = "200", description = "Neue version und gespeicherte Blockliste.")
	@ApiResponse(responseCode = "400", description = "BLOCK_TYPE_UNKNOWN bei unbekanntem type; "
			+ "BLOCK_CONTENT_INVALID, wenn content nicht zum type passt oder ein Pflichtfeld "
			+ "fehlt; EMBED_PROVIDER_NOT_ALLOWED bei gesperrter Quelle (§2.5); "
			+ "VALIDATION_FAILED, wenn version oder blocks fehlen, orderIndex nicht lueckenlos ab "
			+ "0 laeuft oder eine id zu keinem Block dieses Projekts gehoert.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht Teil der "
			+ "Projektseite.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE, wenn der Status "
			+ "die Bearbeitung sperrt (§4.1); PROJECT_VERSION_CONFLICT, wenn die mitgeschickte "
			+ "version veraltet ist (§6.4). Bei einem Versionskonflikt wird nicht automatisch "
			+ "wiederholt, sondern neu geladen.")
	@PutMapping
	public BlocksResponse replace(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId,

			@Valid @RequestBody BlocksUpdateRequest request) {

		return blockService.replace(user, projectId, request);
	}
}
