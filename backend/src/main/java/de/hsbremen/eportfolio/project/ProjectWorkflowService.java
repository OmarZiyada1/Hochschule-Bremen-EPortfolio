package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.comment.Comment;
import de.hsbremen.eportfolio.comment.CommentRepository;
import de.hsbremen.eportfolio.common.enums.CommentStatus;
import de.hsbremen.eportfolio.common.enums.CommentType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.dto.ProjectDetailResponse;
import de.hsbremen.eportfolio.project.dto.RevisionRequest;
import de.hsbremen.eportfolio.top10.Top10Service;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der redaktionelle Kern: die Workflow-Endpoints aus API-Contract §6.1,
 * also der Zustandsautomat aus §4 als {@code POST /api/projects/{id}/submit},
 * {@code /withdraw}, {@code /approve}, {@code /publish} und
 * {@code /request-revision}.
 *
 * <p><strong>Warum ein eigener Dienst</strong> neben {@link ProjectWriteService}:
 * dort geht es um die Felder eines Projekts, hier um seinen Zustand. Die
 * Methoden teilen sich nichts mit dem Anlegen und Aendern ausser der Entity,
 * dafuer alles untereinander: dieselbe Pruefreihenfolge, denselben
 * Historieneintrag, dieselbe Antwortform. Zusammengelegt waeren es zwei Themen in
 * einer Klasse, deren gemeinsamer Nenner nur der Name „Projekt" ist.
 *
 * <p><strong>Die Uebergangstabelle steht nicht hier</strong>, sondern in
 * {@link ProjectTransition}, und die Rechtefrage in
 * {@link ProjectPermissionService#mayTrigger}. Dieser Dienst setzt die beiden
 * Antworten zusammen und uebersetzt sie in Statuscodes; er entscheidet selbst
 * nichts, was der Contract schon entschieden hat.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im
 * {@link ProjectWriteService}, nach §6.3.1: laden (fehlt → 404) → Berechtigung
 * (nein → 403) → Uebergang laut §4.1 (nein → 409) → offene Aenderungswuensche
 * beim Einreichen (409, KAN-59) → fachliche Vollstaendigkeit (nein → 400) →
 * schreiben. Dass das Recht vor dem Status geprueft wird, ist Absicht: sonst
 * verraet ein 409 einer unbeteiligten Person den Status eines fremden
 * Entwurfs. Und der Zustandskonflikt steht vor der Formvollstaendigkeit, damit
 * niemand erst Felder nachtraegt und dann am Konflikt scheitert.
 *
 * <p><strong>Kein {@code version}-Feld</strong> in den Bodies. Begruendung in
 * {@link RevisionRequest}: ein Uebergang schreibt nur {@code status} und
 * {@code publishedAt}, kann also niemandes Arbeit ueberschreiben, und gegen den
 * doppelten Aufruf schuetzt der Vorzustand aus §4.1 selbst.
 */
@Service
@Transactional
public class ProjectWorkflowService {

	/**
	 * Die Pflichtfelder aus §3.3, die beim Einreichen vorliegen muessen, in der
	 * Reihenfolge, in der sie im Contract stehen.
	 *
	 * <p>Die Namen sind die des Request-Bodys von {@code PUT /api/projects/{id}}
	 * ({@code facultyId} und nicht {@code faculty}), weil die Meldung dem Client
	 * sagen soll, welches Feld er nachzureichen hat, und nicht, wie die Spalte in
	 * der Datenbank heisst.
	 *
	 * <p>{@code moduleId} steht bewusst nicht dabei: §3.3 fuehrt es als optionalen
	 * Bezug und nennt es in der Aufzaehlung der Pflichtfelder nicht. Ein Beitrag
	 * muss zu einem Studiengang gehoeren, aber nicht zu einer einzelnen
	 * Lehrveranstaltung.
	 */
	private static final List<RequiredField> REQUIRED_FOR_SUBMIT = List.of(
			new RequiredField("projectType", project -> project.getProjectType() != null),
			new RequiredField("facultyId", project -> project.getFaculty() != null),
			new RequiredField("studyProgramId", project -> project.getStudyProgram() != null),
			new RequiredField("degree", project -> project.getDegree() != null),
			new RequiredField("categoryId", project -> project.getCategory() != null),
			new RequiredField("semesterId", project -> project.getSemester() != null));

	private final ProjectRepository projectRepository;

	private final ProjectStatusHistoryRepository statusHistoryRepository;

	private final CommentRepository commentRepository;

	private final UserRepository userRepository;

	private final ProjectPermissionService permissions;

	private final ProjectReadService readService;

	private final Top10Service top10Service;

	public ProjectWorkflowService(ProjectRepository projectRepository,
			ProjectStatusHistoryRepository statusHistoryRepository,
			CommentRepository commentRepository,
			UserRepository userRepository,
			ProjectPermissionService permissions,
			ProjectReadService readService,
			Top10Service top10Service) {
		this.projectRepository = projectRepository;
		this.statusHistoryRepository = statusHistoryRepository;
		this.commentRepository = commentRepository;
		this.userRepository = userRepository;
		this.permissions = permissions;
		this.readService = readService;
		this.top10Service = top10Service;
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/submit
	// ------------------------------------------------------------------

	/**
	 * Einreichen: {@code DRAFT} oder {@code REVISION} nach {@code SUBMITTED}
	 * durch die Autor:in (§4.1).
	 *
	 * <p>Hier und nur hier greift die Vollstaendigkeitspruefung aus §3.3. Ein
	 * Entwurf darf unfertig sein; wer ihn zur Begutachtung gibt, gibt ihn mit
	 * seinen Rahmendaten.
	 *
	 * <p><strong>Und hier und nur hier greift der Review-Kreislauf aus §2.4</strong>
	 * (KAN-59): solange am Projekt Aenderungswuensche im Status {@code OPEN}
	 * haengen, wird nicht eingereicht. Bis dahin war das reine Konvention der
	 * Oberflaeche; jetzt erzwingt es der Server, denn nur er kann es garantieren.
	 *
	 * @param user      angemeldete Person; ohne Anmeldung kommt die Anfrage hier
	 *                  nicht an, weil {@code SecurityConfig} nur {@code GET} auf
	 *                  die Projektpfade freigibt (401)
	 * @param projectId ID aus dem Pfad
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person nicht die Autor:in ist
	 *                                   (403)
	 * @throws ConflictException         wenn der Status den Uebergang nicht
	 *                                   zulaesst oder Aenderungswuensche offen
	 *                                   sind (409)
	 * @throws ValidationException       wenn Pflichtfelder aus §3.3 fehlen (400)
	 */
	public ProjectDetailResponse submit(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		requireAllowed(user, project, ProjectTransition.SUBMIT);
		requireNoOpenChangeRequests(project);
		requireCompleteForSubmit(project);

		return perform(user, project, ProjectTransition.SUBMIT);
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/withdraw
	// ------------------------------------------------------------------

	/**
	 * Zurueckziehen: {@code SUBMITTED} nach {@code DRAFT} durch die Autor:in
	 * (§4.1, seit v50).
	 *
	 * <p>Das Gegenstueck zum Einreichen, ohne dessen Pruefungen: die
	 * Vollstaendigkeit aus §3.3 und die offenen Aenderungswuensche aus §2.4
	 * betreffen den Weg <em>zur</em> Redaktion, nicht den zurueck. Es entsteht
	 * auch kein {@code CHANGE_REQUEST}-Kommentar: die Autor:in holt die eigene
	 * Arbeit zurueck und schuldet sich selbst keine Begruendung. Uebrig bleibt
	 * der Historieneintrag aus {@link #perform} (§3.12).
	 *
	 * <p>Erst mit diesem Uebergang wird auch das Loeschen wieder moeglich: die
	 * Rechtematrix erlaubt es der Autor:in nur im {@code DRAFT} (§6.1).
	 */
	public ProjectDetailResponse withdraw(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		requireAllowed(user, project, ProjectTransition.WITHDRAW);

		return perform(user, project, ProjectTransition.WITHDRAW);
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/approve
	// ------------------------------------------------------------------

	/**
	 * Genehmigen: {@code SUBMITTED} nach {@code APPROVED} durch die Redaktion
	 * oder die Administration (§4.1).
	 *
	 * <p>Das Vier-Augen-Prinzip steckt in der Rechtepruefung: eine Redakteur:in
	 * genehmigt ihr eigenes Projekt nicht (§4.1, §7 offener Punkt 1), abschaltbar
	 * ueber {@code app.permission.four-eyes-principle}. Fuer ADMIN greift die
	 * Sperre nicht (offener Punkt 7).
	 *
	 * <p>Genehmigt heisst noch nicht oeffentlich: {@code APPROVED} und
	 * {@code PUBLISHED} sind getrennt, damit die fachliche Freigabe und die
	 * Veroeffentlichungsentscheidung zeitlich auseinanderfallen koennen (§2.2).
	 */
	public ProjectDetailResponse approve(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		requireAllowed(user, project, ProjectTransition.APPROVE);

		return perform(user, project, ProjectTransition.APPROVE);
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/publish
	// ------------------------------------------------------------------

	/**
	 * Veroeffentlichen: {@code APPROVED} nach {@code PUBLISHED} durch die
	 * Redaktion oder die Administration, setzt {@code publishedAt} (§3.3, §4.1).
	 *
	 * <p><strong>{@code publishedAt} wird nur beim ersten Mal gesetzt.</strong>
	 * Wird ein veroeffentlichtes Projekt zur Ueberarbeitung zurueckgezogen und
	 * spaeter erneut veroeffentlicht, bleibt das erste Datum stehen.
	 * „Veroeffentlicht am" ist damit der Zeitpunkt, seit dem diese Arbeit
	 * oeffentlich ist, und nicht der ihrer letzten Korrektur: sonst schoebe eine
	 * nachtraegliche Kleinigkeit ein altes Projekt in der nach {@code publishedAt}
	 * sortierten Galerie wieder nach vorn, und das erste Erscheinungsdatum liesse
	 * sich nur noch aus der Statushistorie rekonstruieren. Wann welche Fassung
	 * oeffentlich wurde, beantwortet ohnehin die Historie (§3.12).
	 */
	public ProjectDetailResponse publish(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		requireAllowed(user, project, ProjectTransition.PUBLISH);

		if (project.getPublishedAt() == null) {
			project.setPublishedAt(Instant.now());
		}
		return perform(user, project, ProjectTransition.PUBLISH);
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/request-revision
	// ------------------------------------------------------------------

	/**
	 * Zur Ueberarbeitung zurueckgeben: {@code SUBMITTED}, {@code APPROVED} oder
	 * {@code PUBLISHED} nach {@code REVISION} durch die Redaktion oder die
	 * Administration (§4.1).
	 *
	 * <p><strong>Die Begruendung wird ein Kommentar</strong> vom Typ
	 * {@code CHANGE_REQUEST} im Status {@code OPEN} (§2.3, §2.4) und steht nicht
	 * in der Statushistorie: die Historie beantwortet „was ist wann passiert", der
	 * Kommentar „was ist zu tun", und nur Letzterer braucht einen
	 * Erledigungsstatus. Umgeschaltet wird der von der Projektseite selbst, nicht
	 * von der Redaktion (§2.4, kommt mit KAN-20).
	 *
	 * <p>{@code publishedAt} bleibt bei einer Ruecknahme aus {@code PUBLISHED}
	 * stehen, siehe {@link #publish}. Aus der Oeffentlichkeit verschwindet das
	 * Projekt trotzdem sofort, denn sichtbar ist es ueber
	 * {@code status = PUBLISHED} und nicht ueber das Datum (§5).
	 *
	 * <p><strong>Stand das Projekt in der Top-10, raeumt es dabei seinen
	 * Platz</strong> (§3.11.1, KAN-24). Die Startseite zeigt die Auswahl ohne
	 * Anmeldung; ein zurueckgezogener Beitrag darf dort nicht stehen bleiben. Der
	 * frei gewordene Platz bleibt frei, die uebrigen ruecken nicht nach. Umgesetzt
	 * in {@link #perform}, weil die Bedingung am Zielstatus haengt und nicht an
	 * diesem einen Uebergang.
	 *
	 * @param request Begruendung, Pflichtfeld (§6.1)
	 */
	public ProjectDetailResponse requestRevision(AuthenticatedUser user, UUID projectId,
			RevisionRequest request) {

		Project project = load(projectId);
		requireAllowed(user, project, ProjectTransition.REQUEST_REVISION);

		writeChangeRequest(user, project, request.reason().trim());
		return perform(user, project, ProjectTransition.REQUEST_REVISION);
	}

	// ------------------------------------------------------------------
	// Pruefungen
	// ------------------------------------------------------------------

	/**
	 * Die zwei Gruende, aus denen ein Uebergang scheitern kann, in zwei
	 * verschiedenen Antworten: fehlendes Recht ergibt <strong>403</strong>
	 * {@code NO_PERMISSION}, ein nach §4.1 nicht vorgesehener Uebergang
	 * <strong>409</strong> {@code PROJECT_STATUS_TRANSITION_INVALID}.
	 *
	 * <p>Recht vor Status, wie in {@code ProjectWriteService.requireEditable}: ein
	 * 409 fuer Unbeteiligte wuerde den Status eines fremden Entwurfs preisgeben,
	 * und er waere auch die falsche Auskunft, weil diese Person selbst im
	 * passenden Status nicht weiterkaeme.
	 */
	private void requireAllowed(AuthenticatedUser user, Project project,
			ProjectTransition transition) {

		if (!permissions.mayTrigger(user, project, transition)) {
			throw new AccessDeniedException(
					"Fuer diesen Statusuebergang fehlt die Berechtigung (§5, §4.1).");
		}
		if (!transition.isAllowedFrom(project.getStatus())) {
			throw ConflictException.statusTransitionInvalid(
					project.getStatus().name(),
					transition.name(),
					transition.allowedSources().stream()
							.map(ProjectStatus::name)
							.collect(Collectors.joining(", ")));
		}
	}

	/**
	 * Der Review-Kreislauf aus §2.4 beim Einreichen: haengen am Projekt noch
	 * Kommentare vom Typ {@code CHANGE_REQUEST} im Status {@code OPEN}, folgt
	 * <strong>409</strong> {@code CHANGE_REQUESTS_OPEN} mit der Anzahl der
	 * offenen Punkte in der Meldung.
	 *
	 * <p>{@code NOTE} und {@code REPLY} blockieren nie: sie tragen keinen
	 * Erledigungsstatus ({@code Comment.of} setzt {@code status} nur bei
	 * {@code CHANGE_REQUEST}). Beim Erst-Einreichen aus {@code DRAFT} laeuft
	 * die Abfrage ins Leere, denn Aenderungswuensche entstehen erst mit der
	 * ersten Ruecknahme; die Pruefung unterscheidet die beiden Wege trotzdem
	 * nicht, weil die Bedingung am Bestand haengt und nicht am Ausgangsstatus.
	 *
	 * <p><strong>Vor der Pflichtfeldpruefung</strong>, nicht danach: der
	 * Zustandskonflikt soll zuerst gemeldet werden, damit niemand erst Felder
	 * nachtraegt und dann am Konflikt scheitert (§6.3.1, Ticket KAN-59).
	 */
	private void requireNoOpenChangeRequests(Project project) {
		long open = commentRepository.countByProjectIdAndTypeAndStatus(project.getId(),
				CommentType.CHANGE_REQUEST, CommentStatus.OPEN);
		if (open > 0) {
			throw ConflictException.changeRequestsOpen(open);
		}
	}

	/**
	 * Die Pflichtfelder aus §3.3 beim Einreichen. Fehlt etwas, folgt
	 * <strong>400</strong> {@code PROJECT_INCOMPLETE} mit der Liste der fehlenden
	 * Felder.
	 *
	 * <p>Es wird die <em>gesamte</em> Liste gemeldet und nicht das erste
	 * fehlende Feld. Sonst muesste die Person am Formular sechs Mal einreichen,
	 * um zu erfahren, was ihr noch fehlt.
	 *
	 * <p><strong>Der Inhalt wird nicht geprueft.</strong> Ein Projekt ohne
	 * Bloecke laesst sich einreichen: §3.3 fuehrt die Pflichtfelder
	 * abschliessend auf und nennt den Inhalt nicht. Ob ein Beitrag genug hergibt,
	 * ist eine redaktionelle Beurteilung und keine Formalie; genau dafuer gibt es
	 * die Ruecknahme mit Begruendung.
	 */
	private void requireCompleteForSubmit(Project project) {
		List<String> missing = new ArrayList<>();
		for (RequiredField field : REQUIRED_FOR_SUBMIT) {
			if (!field.isPresent(project)) {
				missing.add(field.name());
			}
		}
		if (!missing.isEmpty()) {
			throw new ValidationException(ErrorCodes.PROJECT_INCOMPLETE,
					"Zum Einreichen fehlen noch folgende Angaben: " + String.join(", ", missing)
							+ " (§3.3).");
		}
	}

	// ------------------------------------------------------------------
	// Schreiben
	// ------------------------------------------------------------------

	/**
	 * Fuehrt den Uebergang aus: neuer Status, Eintrag in der Statushistorie,
	 * Antwort wie bei {@code GET /projects/{id}}.
	 *
	 * <p><strong>Die Antwort kommt vom Lesedienst</strong>, wie bei allen
	 * schreibenden Projekt-Endpoints (§6.1, KAN-17). So entspricht sie exakt der
	 * eines anschliessenden {@code GET}, einschliesslich der Sichtbarkeitsregel
	 * fuer {@code editors} und {@code statusHistory} (§5, Fussnote ⁷). Fuer die
	 * Redaktion ist das mehr als Bequemlichkeit: sie sieht den frisch
	 * geschriebenen Historieneintrag ohne einen zweiten Aufruf.
	 *
	 * <p>{@code version} und {@code updatedAt} bewegen sich hier ohne
	 * {@code touch()}: anders als beim Autosave der Bloecke aendert ein Uebergang
	 * die Zeile in {@code project} selbst, Hibernate schreibt also ein
	 * {@code UPDATE} und das Auditing greift.
	 *
	 * <p><strong>Der Top-10-Entzug haengt hier und nicht an
	 * {@link #requestRevision}</strong>, obwohl §4.1 heute nur einen einzigen
	 * Uebergang aus {@code PUBLISHED} heraus kennt. Die Bedingung lautet „das
	 * Projekt ist nicht mehr veroeffentlicht" und nicht „es wurde zurueckgegeben";
	 * an dieser Stelle gilt sie fuer jeden kuenftigen Uebergang mit, ohne dass
	 * jemand daran denken muss.
	 *
	 * <p><strong>Die handelnde Person wird einmal geladen und zweimal
	 * verwendet</strong>, fuer die Statushistorie (§3.12) und fuer das
	 * Top-10-Protokoll (§3.17, seit KAN-45). Im Protokoll der Top-10 steht damit
	 * eine Redakteur:in, denn den Entzug loest die Ruecknahme aus und nicht die
	 * Administration; das Feld dort heisst deshalb ausdruecklich „wer die
	 * Aenderung veranlasst hat".
	 */
	private ProjectDetailResponse perform(AuthenticatedUser user, Project project,
			ProjectTransition transition) {

		ProjectStatus from = project.getStatus();
		project.setStatus(transition.target());
		projectRepository.saveAndFlush(project);

		User actor = currentUser(user);
		recordTransition(project, from, transition.target(), actor);
		top10Service.removeOnLeavingPublished(project, actor);

		return readService.detail(user, project.getId());
	}

	/**
	 * Ein Eintrag je Uebergang (§3.12, §4.1). Er traegt nur, was passiert ist:
	 * Vorher, Nachher, Person und Zeitpunkt, keinen Text.
	 */
	private void recordTransition(Project project, ProjectStatus from, ProjectStatus to,
			User changedBy) {

		ProjectStatusHistory entry = new ProjectStatusHistory();
		entry.setProject(project);
		entry.setFromStatus(from);
		entry.setToStatus(to);
		entry.setChangedBy(changedBy);
		entry.setTimestamp(Instant.now());
		statusHistoryRepository.saveAndFlush(entry);
	}

	/**
	 * Legt die Begruendung als {@code CHANGE_REQUEST}-Kommentar im Status
	 * {@code OPEN} an (§2.3, §2.4, §4.1).
	 *
	 * <p>Autor:in des Kommentars ist die zurueckgebende Person und nicht das
	 * System: der Arbeitsauftrag kommt von einem Menschen, und die Projektseite
	 * soll sehen, mit wem sie ihn bespricht.
	 *
	 * <p>Je Ruecknahme entsteht genau ein Kommentar. Aeltere Aenderungswuensche
	 * bleiben unberuehrt, auch offene: ob ein frueherer Punkt erledigt ist,
	 * entscheidet die Projektseite ueber {@code PATCH /comments/{id}/status}
	 * (§2.4) und nicht ein neuer Durchlauf.
	 */
	private void writeChangeRequest(AuthenticatedUser user, Project project, String reason) {
		commentRepository.saveAndFlush(
				Comment.changeRequest(project, currentUser(user), reason));
	}

	// ------------------------------------------------------------------
	// Gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	private Project load(UUID projectId) {
		return projectRepository.findWithReferencesById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));
	}

	/**
	 * Die angemeldete Person als Entity, wie in
	 * {@code ProjectWriteService.loadCurrentUser}: {@link AuthenticatedUser}
	 * traegt nur die Felder fuer Autorisierungsentscheidungen, fuer einen
	 * Fremdschluessel braucht es die Zeile.
	 */
	private User currentUser(AuthenticatedUser user) {
		return userRepository.findById(user.getId()).orElseThrow(() -> new AccessDeniedException(
				"Das angemeldete Konto existiert nicht mehr."));
	}

	/**
	 * Ein Pflichtfeld aus §3.3 mit dem Namen, unter dem der Client es kennt, und
	 * der Pruefung, ob es gesetzt ist.
	 *
	 * <p>Ein eigener Typ statt sechs Bedingungen hintereinander, damit die Liste
	 * der Pflichtfelder als Liste lesbar bleibt und nicht als Kette von
	 * {@code if}-Bloecken, in der leicht ein Feldname und seine Pruefung
	 * auseinanderfallen.
	 */
	private record RequiredField(String name, Predicate<Project> present) {

		boolean isPresent(Project project) {
			return present.test(project);
		}
	}
}
