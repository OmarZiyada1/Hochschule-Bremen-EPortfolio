package de.hsbremen.eportfolio.comment;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.comment.dto.CommentCreateRequest;
import de.hsbremen.eportfolio.comment.dto.CommentResponse;
import de.hsbremen.eportfolio.comment.dto.CommentStatusRequest;
import de.hsbremen.eportfolio.comment.dto.CommentTextRequest;
import de.hsbremen.eportfolio.common.enums.CommentType;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die fuenf Kommentar-Endpoints aus API-Contract §6.1 (KAN-20): die
 * Rueckmeldung zu einem Projekt in ihren drei Auspraegungen aus §2.3, also
 * flache Antwort, interne Notiz und Aenderungswunsch mit Erledigungsstand.
 *
 * <p><strong>Ein Dienst fuer alle fuenf</strong>, wie beim
 * {@code BlockService}: sie beantworten dieselbe Frage („welche Rueckmeldungen
 * haengen an diesem Projekt") und teilen sich Ladevorgang, Fehlerpolitik und
 * Antwortform. Die Rechtefrage steht wie ueberall im
 * {@link ProjectPermissionService}; dieser Dienst entscheidet nichts, was §5
 * schon entschieden hat.
 *
 * <p><strong>Die Sichtbarkeitsfilterung liegt serverseitig und ist nicht
 * verhandelbar.</strong> Eine {@code NOTE} darf in keiner Antwort an
 * Studierende erscheinen, auch nicht ausgeblendet im JSON (§2.3, §6.1). Sie
 * wird deshalb schon in der Abfrage ausgeschlossen, siehe
 * {@link #visibleTypes}. Eine Filterung erst im Frontend waere ueber einen
 * direkten API-Aufruf auslesbar, die Vertraulichkeit der internen Abstimmung
 * damit nur scheinbar gegeben.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im
 * {@code ProjectWorkflowService}, nach §6.3.1: laden (fehlt → 404) →
 * Berechtigung (nein → 401 ohne Anmeldung, sonst 403) → fachliche Validierung
 * (nein → 400) → schreiben. Recht vor Inhalt, damit ein 400 nicht Unbeteiligten
 * verraet, welchen Typ ein fremder Kommentar hat.
 *
 * <p><strong>Der Projektstatus spielt hier keine Rolle.</strong> Die Sperre aus
 * §4.1 gilt dem Inhalt eines Projekts, nicht der Rede darueber. Kommentiert
 * wird gerade dann, wenn der Inhalt gesperrt ist: in {@code SUBMITTED} findet
 * die Begutachtung statt. Ein Kommentar in einem gesperrten Status ist deshalb
 * kein {@code PROJECT_STATUS_NOT_EDITABLE}, sondern der Normalfall.
 */
@Service
public class CommentService {

	/**
	 * Was jemand sehen darf, der keine interne Notiz sehen darf (§2.3):
	 * {@code REPLY} und {@code CHANGE_REQUEST}, beide „sichtbar fuer alle mit
	 * Projektzugriff".
	 */
	private static final Set<CommentType> WITHOUT_NOTE =
			EnumSet.of(CommentType.REPLY, CommentType.CHANGE_REQUEST);

	private final CommentRepository commentRepository;

	private final ProjectRepository projectRepository;

	private final UserRepository userRepository;

	private final ProjectPermissionService permissions;

	public CommentService(CommentRepository commentRepository,
			ProjectRepository projectRepository,
			UserRepository userRepository,
			ProjectPermissionService permissions) {
		this.commentRepository = commentRepository;
		this.projectRepository = projectRepository;
		this.userRepository = userRepository;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// GET /api/projects/{id}/comments
	// ------------------------------------------------------------------

	/**
	 * Die Kommentare eines Projekts, sortiert nach {@code createdAt} aufsteigend
	 * und serverseitig nach Sichtbarkeit gefiltert (§6.1).
	 *
	 * <p><strong>Aufsteigend sortiert</strong>, weil eine Rueckmeldung ein
	 * Gespraech ist: der Verlauf ist von oben nach unten zu lesen, und ein
	 * Aenderungswunsch steht vor der Antwort darauf.
	 *
	 * <p><strong>Wer die Liste ueberhaupt bekommt</strong>, entscheidet die
	 * Lesbarkeit des Projekts: {@code mayReadProject}. Bei einem
	 * veroeffentlichten Projekt ist das auch ohne Anmeldung der Fall, die
	 * Kommentare gehoeren dann zur oeffentlichen Darstellung (§2.3, §5). Ohne
	 * Leserecht folgt 401 bzw. 403 nach §6.3.1, wie bei
	 * {@code BlockService.list}: die Liste soll nicht zur Hintertuer werden,
	 * durch die sich Rueckschluesse auf einen fremden Entwurf ziehen lassen.
	 *
	 * <p><strong>Ohne Paginierung</strong>, anders als die Projektliste: §6.1
	 * nennt fuer diese Zeile weder {@code PageResponse} noch Parameter, und die
	 * Kommentare eines Projekts sind wie seine Bloecke eine Liste, die die
	 * Oberflaeche ohnehin vollstaendig anzeigt. Ein Seitenformat wuerde den
	 * Verlauf zerschneiden, ohne etwas zu sparen.
	 *
	 * @param user      angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param projectId ID aus dem Pfad
	 */
	@Transactional(readOnly = true)
	public List<CommentResponse> list(AuthenticatedUser user, UUID projectId) {
		Project project = loadProject(projectId);

		if (!permissions.mayReadProject(user, project)) {
			throw noReadAccess(user);
		}

		return commentRepository
				.findByProjectIdAndTypeInOrderByCreatedAtAsc(projectId, visibleTypes(user))
				.stream()
				.map(CommentResponse::from)
				.toList();
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/comments
	// ------------------------------------------------------------------

	/**
	 * Legt einen Kommentar an (§6.1), <strong>201</strong>.
	 *
	 * <p>Welcher {@code type} zulaessig ist, haengt an der Rolle und ist in §5
	 * je Typ eine eigene Zeile; die Pruefung steht in {@link #requireMayCreate}.
	 * Ein {@code CHANGE_REQUEST} startet in {@code OPEN}, dafuer sorgt die Fabrik
	 * {@link Comment#of} (§2.4).
	 *
	 * @param user      angemeldete Person; ohne Anmeldung kommt die Anfrage hier
	 *                  nicht an, weil {@code SecurityConfig} nur {@code GET} auf
	 *                  diesen Pfad freigibt (401)
	 * @param projectId ID aus dem Pfad
	 * @param request   Typ und Text
	 * @throws ResourceNotFoundException wenn es die Projekt-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Rolle diesen Typ nicht anlegen
	 *                                   darf (403)
	 */
	@Transactional
	public CommentResponse create(AuthenticatedUser user, UUID projectId,
			CommentCreateRequest request) {

		Project project = loadProject(projectId);
		requireMayCreate(user, project, request.type());

		Comment comment = Comment.of(project, currentUser(user), request.type(),
				request.text().trim());

		return CommentResponse.from(commentRepository.saveAndFlush(comment));
	}

	// ------------------------------------------------------------------
	// PATCH /api/comments/{id}
	// ------------------------------------------------------------------

	/**
	 * Aendert den Text eines Kommentars (§6.1).
	 *
	 * <p><strong>Nur die Verfasser:in</strong>, ausdruecklich auch nicht die
	 * Administration; Begruendung an
	 * {@link ProjectPermissionService#mayEditComment}.
	 *
	 * @throws ResourceNotFoundException wenn es die Kommentar-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person den Kommentar nicht
	 *                                   verfasst hat (403)
	 */
	@Transactional
	public CommentResponse updateText(AuthenticatedUser user, UUID commentId,
			CommentTextRequest request) {

		Comment comment = loadComment(commentId);

		if (!permissions.mayEditComment(user, authorId(comment))) {
			throw new AccessDeniedException(
					"Den Text eines Kommentars aendert nur, wer ihn verfasst hat (§6.1).");
		}

		comment.setText(request.text().trim());
		return CommentResponse.from(commentRepository.saveAndFlush(comment));
	}

	// ------------------------------------------------------------------
	// PATCH /api/comments/{id}/status
	// ------------------------------------------------------------------

	/**
	 * Schaltet den Erledigungsstand eines Aenderungswunsches um (§2.4, §6.1).
	 *
	 * <p>Erlaubt ist das der Projektseite sowie Redaktion und Administration
	 * ({@code maySetChangeRequestStatus}). Die Belege liegen an zwei
	 * verschiedenen Stellen und werden leicht verwechselt: Fussnote ² der Matrix
	 * begruendet allein das (✓) in der STUDENT-Spalte, also dass die Projektseite
	 * einen an sie gerichteten Aenderungswunsch umschalten darf. Dass auch
	 * Redaktion und Administration es duerfen, steht in derselben Zeile als
	 * unmarkierter Haken in ihren beiden Spalten.
	 *
	 * <p><strong>Zur Spannung mit §6.1 und §2.4:</strong> die Endpoint-Zeile
	 * nennt als Rolle nur „Projektseite", §2.4 sagt „nicht die Redaktion". Beides
	 * beschreibt die Zustaendigkeit und nicht eine Sperre: wer die Aenderung
	 * umsetzt, haakt sie ab, damit keine Warteschleife entsteht. Die Haken in §5
	 * bleiben davon unberuehrt, und praktisch braucht es sie: ein zu frueh
	 * gesetztes {@code RESOLVED} muss die Redaktion wieder oeffnen koennen.
	 * Entschieden in der Klaerungsrunde zu KAN-20; §6.1 und §2.4 werden mit v19
	 * entsprechend praezisiert.
	 *
	 * <p>Beide Richtungen sind moeglich, Begruendung in
	 * {@code CommentStatusRequest}.
	 *
	 * <p><strong>Bei einem anderen Typ folgt 400</strong> und nicht etwa ein
	 * stilles Nichts: {@code REPLY} und {@code NOTE} tragen nach §3.5 keinen
	 * Status, ein solcher Aufruf ist also ein Fehler im Client und keine
	 * zulaessige Anfrage ohne Wirkung. Der Fehlercode ist
	 * {@code VALIDATION_FAILED}: §6.2 fuehrt keinen eigenen Code fuer diesen
	 * Fall, und einen neuen einzufuehren waere ein Contract-Nachtrag fuer eine
	 * Unterscheidung, die die Oberflaeche nicht braucht. Sie bietet den
	 * Umschalter ohnehin nur an einem {@code CHANGE_REQUEST} an.
	 *
	 * <p>Die Reihenfolge ist Recht vor Typ: sonst erfuehre eine unbeteiligte
	 * Person ueber den Statuscode, ob ein fremder Kommentar ein
	 * Aenderungswunsch ist.
	 *
	 * @throws ResourceNotFoundException wenn es die Kommentar-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person den Stand nicht setzen
	 *                                   darf (403)
	 * @throws ValidationException       wenn der Kommentar kein
	 *                                   {@code CHANGE_REQUEST} ist (400)
	 */
	@Transactional
	public CommentResponse updateStatus(AuthenticatedUser user, UUID commentId,
			CommentStatusRequest request) {

		Comment comment = loadComment(commentId);

		if (!permissions.maySetChangeRequestStatus(user, comment.getProject())) {
			throw new AccessDeniedException(
					"Den Erledigungsstand setzen die Projektseite sowie Redaktion und "
							+ "Administration (§2.4, §5).");
		}
		if (comment.getType() != CommentType.CHANGE_REQUEST) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"Einen Erledigungsstand tragen nur Kommentare vom Typ CHANGE_REQUEST (§2.4).");
		}

		comment.setStatus(request.status());
		return CommentResponse.from(commentRepository.saveAndFlush(comment));
	}

	// ------------------------------------------------------------------
	// DELETE /api/comments/{id}
	// ------------------------------------------------------------------

	/**
	 * Loescht einen Kommentar (§6.1), <strong>204</strong>.
	 *
	 * <p>Erlaubt sind die Verfasser:in und die Administration, aber nicht die
	 * Redaktion; Begruendung an
	 * {@link ProjectPermissionService#mayDeleteComment}.
	 *
	 * <p><strong>Ohne Ruecksicht auf den Kommentartyp.</strong> Auch ein
	 * {@code CHANGE_REQUEST} laesst sich zuruecknehmen; sein Verfasser ist die
	 * Redaktion, und ein versehentlich abgeschickter Arbeitsauftrag soll nicht
	 * bis in alle Ewigkeit stehen bleiben. Was tatsaechlich passiert ist, haelt
	 * ohnehin die Statushistorie fest (§3.12), und die haengt nicht am Kommentar.
	 *
	 * @throws ResourceNotFoundException wenn es die Kommentar-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person weder Verfasser:in noch
	 *                                   Admin ist (403)
	 */
	@Transactional
	public void delete(AuthenticatedUser user, UUID commentId) {
		Comment comment = loadComment(commentId);

		if (!permissions.mayDeleteComment(user, authorId(comment))) {
			throw new AccessDeniedException(
					"Einen Kommentar loeschen duerfen seine Verfasser:in und die Administration "
							+ "(§6.1).");
		}

		commentRepository.delete(comment);
	}

	// ------------------------------------------------------------------
	// Pruefungen
	// ------------------------------------------------------------------

	/**
	 * Die Typen, die diese Person in der Liste sehen darf (§2.3).
	 *
	 * <p>{@code NOTE} kommt ausschliesslich fuer Redaktion und Administration
	 * dazu ({@code mayUseNote}); fuer alle anderen bleibt es bei den beiden
	 * Typen, die „fuer alle mit Projektzugriff" sichtbar sind. Die Entscheidung
	 * faellt an einer Stelle und wandert von dort in die Abfrage, damit sie sich
	 * nicht zwischen Lesepfad und Antwortabbildung aufteilen kann.
	 *
	 * <p>Auch der volle Satz laeuft durch dieselbe eingegrenzte Abfrage. Das
	 * kostet nichts und spart die zweite, ungefilterte Methode, die genau dann
	 * gefaehrlich wird, wenn sie jemand aus Versehen auf dem Lesepfad benutzt.
	 */
	private Set<CommentType> visibleTypes(AuthenticatedUser user) {
		return permissions.mayUseNote(user)
				? EnumSet.allOf(CommentType.class)
				: WITHOUT_NOTE;
	}

	/**
	 * Ob diese Person einen Kommentar dieses Typs an diesem Projekt anlegen darf
	 * (§5, drei eigene Zeilen).
	 *
	 * <p>Die drei Zeilen fallen verschieden aus, deshalb drei Fragen: eine
	 * {@code REPLY} darf auch die Projektseite schreiben, {@code NOTE} und
	 * {@code CHANGE_REQUEST} bleiben Redaktion und Administration vorbehalten.
	 * Fuer die beiden letzten spielt das Projekt keine Rolle, weil die Matrix
	 * dort keinen Ressourcenbezug kennt: eine Redakteur:in darf grundsaetzlich
	 * kommentieren, auch an einem Projekt, das ihr nicht zugewiesen ist. Lesen
	 * darf sie es ohnehin ({@code mayReadProject}).
	 */
	private void requireMayCreate(AuthenticatedUser user, Project project, CommentType type) {
		boolean allowed = switch (type) {
			case REPLY -> permissions.mayCreateReplyComment(user, project);
			case NOTE -> permissions.mayUseNote(user);
			case CHANGE_REQUEST -> permissions.mayCreateChangeRequestComment(user);
		};

		if (!allowed) {
			throw new AccessDeniedException("Fuer einen Kommentar vom Typ " + type.name()
					+ " fehlt an diesem Projekt die Berechtigung (§2.3, §5).");
		}
	}

	/**
	 * Die ID der Verfasser:in, wie sie der {@link ProjectPermissionService} fuer
	 * {@code mayEditComment} und {@code mayDeleteComment} erwartet.
	 *
	 * <p>In der Datenbank ist {@code author_id} {@code not null} (§3.5); die
	 * Pruefung steht hier trotzdem, damit aus einer unvollstaendigen Zeile keine
	 * {@code NullPointerException} an einer Rechtepruefung wird.
	 */
	private UUID authorId(Comment comment) {
		return comment.getAuthor() == null ? null : comment.getAuthor().getId();
	}

	// ------------------------------------------------------------------
	// Gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	private Project loadProject(UUID projectId) {
		return projectRepository.findById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));
	}

	private Comment loadComment(UUID commentId) {
		return commentRepository.findById(commentId)
				.orElseThrow(() -> ResourceNotFoundException.forComment(commentId));
	}

	/**
	 * Die angemeldete Person als Entity, wie in
	 * {@code ProjectWorkflowService.currentUser}: {@link AuthenticatedUser}
	 * traegt nur die Felder fuer Autorisierungsentscheidungen, fuer einen
	 * Fremdschluessel braucht es die Zeile.
	 */
	private User currentUser(AuthenticatedUser user) {
		return userRepository.findById(user.getId()).orElseThrow(() -> new AccessDeniedException(
				"Das angemeldete Konto existiert nicht mehr."));
	}

	/**
	 * Die beiden Antworten auf ein fehlendes Leserecht, unterschieden nach
	 * §6.3.1: ohne Anmeldung 401, angemeldet 403. Wortgleich zu
	 * {@code BlockService.noReadAccess}, weil beide dieselbe Frage beantworten:
	 * darf diese Person dieses Projekt sehen.
	 */
	private RuntimeException noReadAccess(AuthenticatedUser user) {
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			return new AuthenticationCredentialsNotFoundException(
					"Dieses Projekt ist nicht oeffentlich. Anmeldung erforderlich.");
		}
		return new AccessDeniedException("Fuer dieses Projekt fehlt die Leseberechtigung.");
	}
}
