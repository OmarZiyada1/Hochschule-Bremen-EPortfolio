package de.hsbremen.eportfolio.comment;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.comment.dto.CommentCreateRequest;
import de.hsbremen.eportfolio.comment.dto.CommentResponse;
import de.hsbremen.eportfolio.comment.dto.CommentStatusRequest;
import de.hsbremen.eportfolio.comment.dto.CommentTextRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die fuenf Kommentar-Endpoints aus API-Contract §6.1 (KAN-20).
 *
 * <p><strong>Zwei Pfadfamilien in einem Controller.</strong> Liste und Anlegen
 * haengen unter {@code /api/projects/{id}/comments}, weil ein Kommentar ohne
 * sein Projekt nicht existiert; die drei Aenderungen am einzelnen Kommentar
 * laufen unter {@code /api/comments/{id}}, weil dessen ID ihn bereits
 * eindeutig bestimmt und der Projektpfad davor nur eine zweite, redundante
 * Angabe waere, die auseinanderfallen kann. §6.1 legt beide Formen so fest.
 * Dass sie in einer Klasse stehen, ist Absicht: es ist eine Ressource, und die
 * fuenf Zeilen teilen sich Rechte, Fehlerpolitik und Antwortform.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort steht
 * {@code GET /api/projects/*&#47;comments} als PUBLIC-GET, hinzugefuegt mit
 * diesem Ticket. Grund ist §2.3: {@code REPLY} und {@code CHANGE_REQUEST} sind
 * „sichtbar fuer alle mit Projektzugriff", und bei einem veroeffentlichten
 * Projekt ist das auch ohne Anmeldung der Fall. Freigegeben ist ausdruecklich
 * nur {@code GET}; {@code POST}, {@code PATCH} und {@code DELETE} fallen unter
 * {@code anyRequest().authenticated()} und ergeben ohne Token 401. Was ein
 * Aufrufer beim {@code GET} tatsaechlich zu sehen bekommt, entscheidet der
 * {@link CommentService} anhand der Rechtematrix und nicht die Filterkette:
 * eine {@code NOTE} ist dort fuer niemanden ausser Redaktion und
 * Administration dabei.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen, Statuscode
 * setzen. Sichtbarkeit, Rechte und die Typregeln liegen im
 * {@link CommentService}.
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Kommentare", description = "Rueckmeldungen zu einem Projekt in den drei Formen aus "
		+ "§2.3: REPLY als flache Antwort, NOTE als interne Notiz der Redaktion und "
		+ "CHANGE_REQUEST als Aenderungswunsch mit Erledigungsstand. Die Liste ist serverseitig "
		+ "nach Sichtbarkeit gefiltert; eine NOTE erreicht Studierende in keiner Antwort.")
public class CommentController {

	private final CommentService commentService;

	public CommentController(CommentService commentService) {
		this.commentService = commentService;
	}

	/**
	 * Kommentarliste eines Projekts.
	 *
	 * <p>Ohne Token ist {@code @AuthenticationPrincipal} {@code null}, und genau
	 * das ist der PUBLIC-Fall aus §2.1. Die Fehlerfaelle folgen §6.3.1: 404, wenn
	 * es die Projekt-ID nicht gibt, 401 ohne Anmeldung, 403 bei fehlendem
	 * Leserecht.
	 */
	@Operation(summary = "Kommentare eines Projekts lesen",
			description = "Liefert die sichtbaren Kommentare, sortiert nach createdAt aufsteigend. "
					+ "Sichtbar ist die Liste genau dann, wenn auch das Projekt sichtbar ist (§5); "
					+ "interne Notizen (NOTE) sind ausschliesslich fuer EDITOR und ADMIN dabei und "
					+ "werden fuer alle anderen bereits in der Abfrage ausgeschlossen (§2.3). Ohne "
					+ "Paginierung: die Oberflaeche zeigt den Verlauf vollstaendig.")
	@ApiResponse(responseCode = "200", description = "Die sichtbaren Kommentare in "
			+ "chronologischer Reihenfolge.")
	@ApiResponse(responseCode = "401", description = "Das Projekt ist nicht oeffentlich und es "
			+ "wurde kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Leserecht auf dieses "
			+ "Projekt.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@GetMapping("/projects/{projectId}/comments")
	public List<CommentResponse> list(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId) {

		return commentService.list(user, projectId);
	}

	/** Kommentar anlegen. */
	@Operation(summary = "Kommentar anlegen",
			description = "Legt einen Kommentar an diesem Projekt an. Welcher type zulaessig ist, "
					+ "haengt an der Rolle (§5): REPLY duerfen die Projektseite, Redaktion und "
					+ "Administration, NOTE und CHANGE_REQUEST nur Redaktion und Administration. "
					+ "Ein CHANGE_REQUEST startet immer im Status OPEN (§2.4). Der Projektstatus "
					+ "sperrt das Kommentieren nicht: die Sperre aus §4.1 gilt dem Inhalt, nicht "
					+ "der Rueckmeldung dazu. Seit Contract v71 ist ein CHANGE_REQUEST zugleich "
					+ "ein Statusausloeser (§4.1): steht das Projekt in SUBMITTED, APPROVED oder "
					+ "PUBLISHED und darf die anfragende Person den Uebergang ausloesen, geht es "
					+ "damit nach REVISION, mit Historieneintrag (§3.12). Steht ein "
					+ "veroeffentlichtes Projekt in der kuratierten Top-10, unterbleibt der "
					+ "Uebergang seit Contract v72 (§4.1): erst aus der Liste nehmen, dann "
					+ "zurueckgeben. In den uebrigen Staenden und ohne dieses Recht entsteht "
					+ "ebenfalls nur der Kommentar; keiner dieser Faelle ist ein Fehler. Die "
					+ "Antwort bleibt in jedem Fall der Kommentar und nennt den Status nicht.")
	@ApiResponse(responseCode = "201", description = "Der angelegte Kommentar.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: type oder text fehlt, text "
			+ "ist zu lang, oder type ist keiner der Werte aus §2.3.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber diese Rolle darf an diesem "
			+ "Projekt keinen Kommentar dieses Typs anlegen.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@PostMapping("/projects/{projectId}/comments")
	@ResponseStatus(HttpStatus.CREATED)
	public CommentResponse create(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId,

			@Valid @RequestBody CommentCreateRequest request) {

		return commentService.create(user, projectId, request);
	}

	/** Kommentartext aendern. */
	@Operation(summary = "Kommentartext aendern",
			description = "Aendert den Text eines Kommentars. Erlaubt ist das ausschliesslich der "
					+ "Verfasser:in, auch nicht der Administration: wer eine unangemessene "
					+ "Rueckmeldung aus der Welt schaffen muss, loescht sie, statt in fremdem Namen "
					+ "etwas anderes zu sagen. Der type bleibt unveraenderlich, weil er ueber die "
					+ "Sichtbarkeit entscheidet (§2.3).")
	@ApiResponse(responseCode = "200", description = "Der geaenderte Kommentar.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: text fehlt, ist leer oder "
			+ "zu lang.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht die Verfasser:in "
			+ "dieses Kommentars.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keinen Kommentar.")
	@PatchMapping("/comments/{commentId}")
	public CommentResponse updateText(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Kommentars.")
			@PathVariable("commentId") UUID commentId,

			@Valid @RequestBody CommentTextRequest request) {

		return commentService.updateText(user, commentId, request);
	}

	/** Erledigungsstand eines Aenderungswunsches umschalten. */
	@Operation(summary = "Erledigungsstand eines Aenderungswunsches setzen",
			description = "Schaltet einen CHANGE_REQUEST zwischen OPEN und RESOLVED um, in beide "
					+ "Richtungen. Zustaendig ist die Projektseite, also Autor:in und "
					+ "Projektmitglieder (§2.4 und Fussnote ² der Matrix): wer die Aenderung "
					+ "umsetzt, weiss am besten, wann sie umgesetzt ist. Gesperrt sind Redaktion "
					+ "und Administration deshalb nicht, sie tragen in derselben Zeile von §5 "
					+ "einen vollen Haken.")
	@ApiResponse(responseCode = "200", description = "Der Kommentar mit neuem status.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: status fehlt, oder der "
			+ "Kommentar ist kein CHANGE_REQUEST und traegt damit gar keinen Erledigungsstand "
			+ "(§3.5).")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder Teil der Projektseite "
			+ "noch Redaktion oder Administration.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keinen Kommentar.")
	@PatchMapping("/comments/{commentId}/status")
	public CommentResponse updateStatus(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Kommentars.")
			@PathVariable("commentId") UUID commentId,

			@Valid @RequestBody CommentStatusRequest request) {

		return commentService.updateStatus(user, commentId, request);
	}

	/** Kommentar loeschen. */
	@Operation(summary = "Kommentar loeschen",
			description = "Loescht den Kommentar. Erlaubt sind die Verfasser:in und die "
					+ "Administration (§6.1). Die betreuende Redaktion gehoert nicht dazu: sie darf "
					+ "ein Projekt zurueckgeben, aber nicht die Rueckfrage der Autor:in daran "
					+ "verschwinden lassen.")
	@ApiResponse(responseCode = "204", description = "Geloescht.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder Verfasser:in noch "
			+ "Administration.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keinen Kommentar.")
	@DeleteMapping("/comments/{commentId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Kommentars.")
			@PathVariable("commentId") UUID commentId) {

		commentService.delete(user, commentId);
	}
}
