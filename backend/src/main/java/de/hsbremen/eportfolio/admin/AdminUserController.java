package de.hsbremen.eportfolio.admin;

import de.hsbremen.eportfolio.admin.dto.AdminUserCreateRequest;
import de.hsbremen.eportfolio.admin.dto.AdminUserResponse;
import de.hsbremen.eportfolio.admin.dto.AdminUserUpdateRequest;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die fuenf Zeilen der Nutzerverwaltung aus API-Contract §6.1 (KAN-25): Liste,
 * Einzelabruf, Anlage, Aenderung und Deaktivierung.
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette</strong>, wie beim
 * {@code Top10AdminController}: {@code SecurityConfig} fuehrt
 * {@code /api/admin/**} mit {@code hasRole("ADMIN")}. Der Dienst prueft
 * {@code mayManageUsers} trotzdem noch einmal, weil die Hausregel
 * Berechtigungen zweistufig fuehrt und ein Pfadmuster keine Rechtematrix ist
 * (§5).
 *
 * <p><strong>Kein {@code version} in den Bodies</strong>, anders als bei den
 * schreibenden Projekt-Endpoints (§6.4). {@code User} traegt kein
 * {@code @Version}, und §6.4 nennt das Optimistic Locking ausdruecklich nur fuer
 * das Projekt: dort arbeiten mehrere gleichberechtigte Personen am selben
 * Dokument, hier schreibt allein die Administration, und ein PATCH aendert
 * genau die Felder, die er nennt.
 */
@RestController
@RequestMapping("/api/admin/users")
@Tag(name = "Nutzerverwaltung", description = "Konten anlegen, aendern und sperren (§6.1). "
		+ "Ausschliesslich fuer ADMIN (§5). Der einzige Ort, an dem hsbEmail ausgegeben "
		+ "wird (§3.1).")
public class AdminUserController {

	private final AdminUserService userService;

	public AdminUserController(AdminUserService userService) {
		this.userService = userService;
	}

	// ------------------------------------------------------------------
	// GET /api/admin/users
	// ------------------------------------------------------------------

	@Operation(summary = "Konten lesen",
			description = "Alle Konten im Seitenformat aus §6.6, auch deaktivierte und solche "
					+ "mit offener Registrierung. Ohne \"sort\" alphabetisch nach Nachname und "
					+ "Vorname. Sortierbar sind lastName, firstName, email, hsbEmail, role, "
					+ "status, createdAt und updatedAt; jedes andere Feld ergibt 400.")
	@ApiResponse(responseCode = "200", description = "Eine Seite der Kontoliste.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: unbekanntes Sortierfeld, "
			+ "oder \"role\"/\"status\" ist kein Wert aus §2.1 bzw. §2.9.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@GetMapping
	public PageResponse<AdminUserResponse> list(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "Filter: Rolle (§2.1).")
			@RequestParam(name = "role", required = false) Role role,

			@Parameter(description = "Filter: Kontostatus (§2.9).")
			@RequestParam(name = "status", required = false) UserStatus status,

			@Parameter(description = "Suchbegriff fuer Vorname, Nachname, private E-Mail und "
					+ "HSB-E-Mail, unabhaengig von Gross- und Kleinschreibung.")
			@RequestParam(name = "q", required = false) String q,

			@ParameterObject
			@PageableDefault(size = 20, sort = {"lastName", "firstName"},
					direction = Sort.Direction.ASC)
			Pageable pageable) {

		return userService.list(user, role, status, q, pageable);
	}

	// ------------------------------------------------------------------
	// GET /api/admin/users/{id}
	// ------------------------------------------------------------------

	@Operation(summary = "Konto lesen",
			description = "Ein einzelnes Konto mit denselben Feldern wie in der Liste, "
					+ "einschliesslich hsbEmail (§3.1).")
	@ApiResponse(responseCode = "200", description = "Das Konto.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Konto.")
	@GetMapping("/{id}")
	public AdminUserResponse detail(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Kontos.")
			@PathVariable("id") UUID id) {

		return userService.detail(user, id);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/users
	// ------------------------------------------------------------------

	@Operation(summary = "Konto anlegen",
			description = "Legt ein sofort nutzbares Konto samt Portfolio an (§3.2.1). Der "
					+ "Server setzt status = ACTIVE, beide Verifizierungsflags auf true und "
					+ "passwordChangeRequired = true: das Initialpasswort kennt eine zweite "
					+ "Person und muss bei der ersten Anmeldung geaendert werden (§6.7). Die "
					+ "Rolle aus dem Body gilt unveraendert, auch ADMIN; die Domain der "
					+ "hsbEmail wird auf Zugehoerigkeit zur Hochschule geprueft (§3.1.1).")
	@ApiResponse(responseCode = "201", description = "Das angelegte Konto.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: Pflichtfeld fehlt, "
			+ "Passwort zu kurz oder zu lang, oder die Domain der hsbEmail steht in keiner der "
			+ "konfigurierten Listen.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "409", description = "RESOURCE_IN_USE: email oder hsbEmail ist "
			+ "bereits vergeben. Die Meldung nennt das betroffene Feld.")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public AdminUserResponse create(
			@AuthenticationPrincipal AuthenticatedUser user,

			@RequestBody @Valid AdminUserCreateRequest request) {

		return userService.create(user, request);
	}

	// ------------------------------------------------------------------
	// PATCH /api/admin/users/{id}
	// ------------------------------------------------------------------

	@Operation(summary = "Konto aendern",
			description = "Aendert Vorname, Nachname, Rolle oder Kontostatus. Alle vier Felder "
					+ "sind optional; was fehlt, bleibt stehen. Ueber \"role\" laeuft die "
					+ "Hochstufung einer studentischen Person zur Redaktion (Tutor-Fall, "
					+ "§3.1.1). Am eigenen Konto sind Rolle und Status gesperrt, weil beides "
					+ "nach §6.5 sofort wirkt und die Aenderung sich dann nicht mehr "
					+ "zuruecknehmen liesse.")
	@ApiResponse(responseCode = "200", description = "Das geaenderte Konto.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: uebermittelter Name ist "
			+ "leer, status ist REGISTRATION_PENDING, oder es wurde versucht, die eigene Rolle "
			+ "oder den eigenen Status zu aendern.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Konto.")
	@PatchMapping("/{id}")
	public AdminUserResponse update(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Kontos.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid AdminUserUpdateRequest request) {

		return userService.update(user, id, request);
	}

	// ------------------------------------------------------------------
	// DELETE /api/admin/users/{id}
	// ------------------------------------------------------------------

	@Operation(summary = "Konto deaktivieren",
			description = "Setzt status = DEACTIVATED und loescht keine Zeile (§6.1). Ein "
					+ "echtes Loeschen muesste fremde Projekte, Kommentare und Reaktionen "
					+ "mitreissen oder die Fremdschluessel verletzen. Wirkt sofort, auch bei "
					+ "gueltigem Token (§6.5). Ein zweiter Aufruf ergibt wieder 204.")
	@ApiResponse(responseCode = "204", description = "Das Konto ist deaktiviert.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: das eigene Konto laesst "
			+ "sich nicht deaktivieren.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Konto.")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deactivate(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Kontos.")
			@PathVariable("id") UUID id) {

		userService.deactivate(user, id);
	}
}
