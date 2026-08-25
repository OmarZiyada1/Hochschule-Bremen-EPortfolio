package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.top10.dto.Top10AcceptRequest;
import de.hsbremen.eportfolio.top10.dto.Top10AuditEntryResponse;
import de.hsbremen.eportfolio.top10.dto.Top10EntryResponse;
import de.hsbremen.eportfolio.top10.dto.Top10NominationResponse;
import de.hsbremen.eportfolio.top10.dto.Top10OrderRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die fuenf Top-10-Zeilen des Admin-Bereichs aus API-Contract §6.1:
 * Nominierungen lesen, annehmen oder ablehnen und die Reihenfolge setzen
 * (KAN-24), dazu das Aenderungsprotokoll der Kuratierung (KAN-45).
 *
 * <p><strong>Zwei Protokolle, nicht zu verwechseln.</strong>
 * {@code GET /top10-nominations} liefert das Protokoll der <em>Vorschlaege</em>
 * (§3.11), {@code GET /top10-audit} das der <em>Aenderungen an der Liste</em>
 * (§3.17). Das erste beantwortet „welche Projekte waren im Gespraech und wie
 * wurde entschieden", das zweite „wer hat wann welches Projekt aufgenommen,
 * entfernt oder umsortiert". Nur das zweite ist paginiert, weil nur es
 * unbegrenzt waechst.
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette.</strong>
 * {@code SecurityConfig} fuehrt {@code /api/admin/**} mit
 * {@code hasRole("ADMIN")}; ohne Token endet ein Aufruf mit 401, mit fremdem
 * Token mit 403. Die Dienste pruefen {@code mayCurateTop10} trotzdem noch
 * einmal, weil die Hausregel Berechtigungen zweistufig fuehrt und ein Pfadmuster
 * allein keine Rechtematrix ist (§5).
 *
 * <p><strong>Kein {@code version} in den Bodies</strong>, anders als bei den
 * schreibenden Projekt-Endpoints (§6.4). Die Top-10 ist keine Ressource mit
 * mehreren gleichberechtigten Bearbeiter:innen: sie wird ausschliesslich von der
 * Administration und ausschliesslich ueber diese Endpoints geschrieben. Gegen
 * den doppelten Klick auf „Annehmen" schuetzt der Stand der Nominierung selbst
 * (409 {@code NOMINATION_ALREADY_DECIDED}), gegen zwei gleichzeitige
 * Umsortierungen die vollstaendige Ersetzung: die zweite gewinnt und ist
 * vollstaendig, statt beide Listen zu vermischen.
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Top-10-Verwaltung", description = "Kuratierung der Startseiten-Auswahl (§3.11). "
		+ "Ausschliesslich fuer ADMIN (§5).")
public class Top10AdminController {

	private final Top10Service top10Service;

	private final Top10NominationService nominationService;

	private final Top10AuditService auditService;

	public Top10AdminController(Top10Service top10Service,
			Top10NominationService nominationService,
			Top10AuditService auditService) {
		this.top10Service = top10Service;
		this.nominationService = nominationService;
		this.auditService = auditService;
	}

	// ------------------------------------------------------------------
	// GET /api/admin/top10-nominations
	// ------------------------------------------------------------------

	@Operation(summary = "Nominierungen lesen",
			description = "Das Nominierungsprotokoll, neueste zuerst. Enthaelt offene und "
					+ "bereits entschiedene Vorschlaege (§3.11); mit dem Parameter \"status\" "
					+ "auf einen Stand eingegrenzt. Ohne Paginierung, weil §6.1 fuer diese "
					+ "Zeile keine vorsieht.")
	@ApiResponse(responseCode = "200", description = "Liste der Nominierungen.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: \"status\" ist kein "
			+ "Wert aus §2.8.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@GetMapping("/top10-nominations")
	public List<Top10NominationResponse> nominations(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "Optionaler Filter auf den Stand der Nominierung (§2.8). "
					+ "Ohne Angabe kommen alle.")
			@RequestParam(name = "status", required = false) NominationStatus status) {

		return nominationService.nominations(user, status);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/top10-nominations/{id}/accept
	// ------------------------------------------------------------------

	@Operation(summary = "Nominierung annehmen",
			description = "Setzt status, decidedBy und decidedAt und legt den Top-10-Eintrag auf "
					+ "dem Platz aus dem Body an (§3.11). Der Platzvorschlag der nominierenden "
					+ "Person ist unverbindlich und wird nicht uebernommen. Ein belegter Platz "
					+ "wird nicht geraeumt: dafuer gibt es PUT /api/admin/top10.")
	@ApiResponse(responseCode = "200", description = "Die Nominierung steht auf ACCEPTED, das "
			+ "Projekt auf dem gewuenschten Platz.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: position fehlt oder "
			+ "liegt nicht zwischen 1 und 10.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keine Nominierung.")
	@ApiResponse(responseCode = "409", description = "NOMINATION_ALREADY_DECIDED, wenn bereits "
			+ "entschieden wurde; PROJECT_NOT_PUBLISHED, wenn das Projekt inzwischen "
			+ "zurueckgezogen ist; RESOURCE_IN_USE, wenn der Platz belegt ist oder das Projekt "
			+ "schon in der Liste steht.")
	@PostMapping("/top10-nominations/{nominationId}/accept")
	public Top10NominationResponse accept(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Nominierung.")
			@PathVariable("nominationId") UUID nominationId,

			@RequestBody @Valid Top10AcceptRequest request) {

		return nominationService.accept(user, nominationId, request);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/top10-nominations/{id}/reject
	// ------------------------------------------------------------------

	@Operation(summary = "Nominierung ablehnen",
			description = "Setzt status, decidedBy und decidedAt, ohne die Liste anzufassen "
					+ "(§3.11). Ohne Body: §6.1 sieht fuer diese Zeile keinen vor. Der Vorschlag "
					+ "bleibt als abgelehnter Eintrag im Protokoll stehen; dasselbe Projekt darf "
					+ "danach erneut nominiert werden.")
	@ApiResponse(responseCode = "200", description = "Die Nominierung steht auf REJECTED.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keine Nominierung.")
	@ApiResponse(responseCode = "409", description = "NOMINATION_ALREADY_DECIDED: ueber diesen "
			+ "Vorschlag ist bereits entschieden worden.")
	@PostMapping("/top10-nominations/{nominationId}/reject")
	public Top10NominationResponse reject(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Nominierung.")
			@PathVariable("nominationId") UUID nominationId) {

		return nominationService.reject(user, nominationId);
	}

	// ------------------------------------------------------------------
	// PUT /api/admin/top10
	// ------------------------------------------------------------------

	@Operation(summary = "Top-10 setzen",
			description = "Ersetzt Bestand und Reihenfolge vollstaendig: der Index in "
					+ "projectIds ist der Platz, das erste Element steht auf Platz 1 (§3.11.1). "
					+ "Was nicht genannt ist, faellt aus der Liste; eine leere Liste leert sie. "
					+ "Ein null-Eintrag laesst den Platz frei (seit Contract v78): [A, null, C] "
					+ "setzt A auf 1 und C auf 3. Nachlaufende null-Eintraege schneidet der Server "
					+ "ab. Zulaessig sind hoechstens zehn Eintraege, freie Plaetze zaehlen mit; die "
					+ "genannten Projekte muessen verschieden und veroeffentlicht sein. "
					+ "Offene Nominierungen der aufgenommenen Projekte gelten damit als "
					+ "angenommen. Antwort ist die neue Liste wie bei GET /api/top10.")
	@ApiResponse(responseCode = "200", description = "Die neue Top-10, geordnet nach Platz.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: mehr als zehn Eintraege, "
			+ "ein Projekt mehrfach genannt, eine unbekannte ID oder ein nicht "
			+ "veroeffentlichtes Projekt. Ein null-Eintrag ist keiner dieser Faelle: er "
			+ "benennt kein Projekt und darf beliebig oft vorkommen.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@PutMapping("/top10")
	public List<Top10EntryResponse> setOrder(
			@AuthenticationPrincipal AuthenticatedUser user,

			@RequestBody @Valid Top10OrderRequest request) {

		return top10Service.setOrder(user, request);
	}

	// ------------------------------------------------------------------
	// GET /api/admin/top10-audit
	// ------------------------------------------------------------------

	@Operation(summary = "Aenderungsprotokoll lesen",
			description = "Wer wann welches Projekt aufgenommen, entfernt oder umsortiert hat "
					+ "(§3.17), im Seitenformat aus §6.6 und ohne \"sort\" nach timestamp "
					+ "absteigend. Sortierbar ist ausschliesslich timestamp; jedes andere Feld "
					+ "ergibt 400. Eine Umsortierung schreibt eine Zeile je bewegtem Projekt, "
					+ "ein unveraenderter Platz keine. Protokolliert werden auch die beiden "
					+ "Wege, auf denen ein Platz ohne Entscheidung der Administration frei "
					+ "wird: das Projekt verlaesst PUBLISHED oder es wird geloescht. Das "
					+ "Protokoll ist unveraenderlich, es gibt weder einen Schreib- noch einen "
					+ "Loeschweg.")
	@ApiResponse(responseCode = "200", description = "Eine Seite des Protokolls.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: unbekanntes Sortierfeld, "
			+ "\"from\" liegt nach \"to\", oder ein Parameter hat nicht das erwartete Format "
			+ "(Zeitpunkt bzw. UUID).")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@GetMapping("/top10-audit")
	public PageResponse<Top10AuditEntryResponse> audit(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "Filter: fruehester beruecksichtigter Zeitpunkt, Grenze "
					+ "eingeschlossen. ISO-8601 UTC (§1), z. B. 2026-08-01T00:00:00Z.",
					example = "2026-08-01T00:00:00Z")
			@RequestParam(name = "from", required = false) Instant from,

			@Parameter(description = "Filter: spaetester beruecksichtigter Zeitpunkt, Grenze "
					+ "eingeschlossen.", example = "2026-08-31T21:59:59Z")
			@RequestParam(name = "to", required = false) Instant to,

			@Parameter(description = "Filter: Konto der handelnden Person. Beim automatischen "
					+ "Entzug eines Platzes ist das nicht zwingend ein Admin (§3.17).")
			@RequestParam(name = "admin", required = false) UUID admin,

			@ParameterObject
			@PageableDefault(size = 20, sort = "timestamp", direction = Sort.Direction.DESC)
			Pageable pageable) {

		return auditService.list(user, from, to, admin, pageable);
	}
}
