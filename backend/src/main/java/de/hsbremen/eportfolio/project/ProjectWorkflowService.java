package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.comment.Comment;
import de.hsbremen.eportfolio.comment.CommentRepository;
import de.hsbremen.eportfolio.common.enums.CommentStatus;
import de.hsbremen.eportfolio.common.enums.CommentType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
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
	 * der Datenbank heisst. Aus demselben Grund heisst der letzte Eintrag
	 * {@code editorIds} und nicht {@code editors}.
	 *
	 * <p>{@code moduleId} steht bewusst nicht dabei: §3.3 fuehrt es als optionalen
	 * Bezug und nennt es in der Aufzaehlung der Pflichtfelder nicht. Ein Beitrag
	 * muss zu einem Studiengang gehoeren, aber nicht zu einer einzelnen
	 * Lehrveranstaltung.
	 *
	 * <p><strong>Die Redaktionszuweisung gehoert seit Contract v59 dazu</strong>
	 * (KAN-77). Bis v58 war sie freiwillig, ein Projekt ohne zugewiesene
	 * Redaktion liess sich also einreichen. Danach blieb es liegen: §4.1 gibt die
	 * Entscheidung ausschliesslich der zugewiesenen Redaktion und dem Admin, und
	 * „Meine Reviews" ({@code GET /api/projects?editor=me}) fuehrt es bei
	 * niemandem auf. Zurueck in den Ablauf kaeme es nur, wenn ein Admin die
	 * Zuweisung von sich aus nachtraegt, und niemand erfaehrt von dem Vorgang.
	 * Die Zuweisung ist damit dieselbe Art Rahmenangabe wie Fakultaet oder
	 * Semester und wird zum selben Zeitpunkt geprueft.
	 */
	private static final List<RequiredField> REQUIRED_FOR_SUBMIT = List.of(
			new RequiredField("projectType", project -> project.getProjectType() != null),
			new RequiredField("facultyId", project -> project.getFaculty() != null),
			new RequiredField("studyProgramId", project -> project.getStudyProgram() != null),
			new RequiredField("degree", project -> project.getDegree() != null),
			new RequiredField("categoryId", project -> project.getCategory() != null),
			new RequiredField("semesterId", project -> project.getSemester() != null),
			new RequiredField("editorIds", project -> !project.getEditors().isEmpty()));

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
	 * <p>Das Vier-Augen-Prinzip steckt in der Rechtepruefung: wer zur
	 * Projektseite gehoert, genehmigt sie nicht (§4.1, §5 Fussnote 1),
	 * abschaltbar ueber {@code app.permission.four-eyes-principle}. Seit KAN-82
	 * gilt das auch fuer {@code ADMIN}, sobald er selbst zur Projektseite
	 * gehoert; der frueher hier genannte offene Punkt 7 ist damit entschieden.
	 * Die Einzelheiten stehen an {@code mayDecideEditorially} im
	 * {@link ProjectPermissionService}.
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
		requireNotInTop10ForRevision(project);

		writeChangeRequest(user, project, request.reason().trim());
		return perform(user, project, ProjectTransition.REQUEST_REVISION);
	}

	/**
	 * Der zweite Ausloeser desselben Uebergangs (§4.1, seit Contract v71,
	 * KAN-37): ein Kommentar vom Typ {@code CHANGE_REQUEST} bringt das Projekt
	 * nach {@code REVISION}. Aufgerufen aus {@code CommentService.create},
	 * <strong>nachdem</strong> der Kommentar geschrieben ist.
	 *
	 * <p><strong>Warum es diesen Weg gibt.</strong> Bis v70 fuehrten zwei Wege
	 * zu demselben Ziel, die in der Oberflaeche gleich aussahen und verschieden
	 * wirkten: der Knopf setzte den Status, das Kommentarformular nicht. Wer den
	 * Wunsch im Formular schrieb, sah das Projekt eingereicht bleiben und tippte
	 * ihn im Dialog ein zweites Mal.
	 *
	 * <p><strong>Diese Methode schreibt keinen Kommentar.</strong> Anders als
	 * {@link #requestRevision}, das mit {@link #writeChangeRequest} anfaengt,
	 * liegt er hier bereits vor; ein zweiter waere dieselbe Aussage doppelt.
	 *
	 * <p><strong>Sie wirft nicht, sondern laesst es sein.</strong> Zwei Faelle
	 * fuehren dazu, und beide sind nach §4.1 ausdruecklich kein Fehler:
	 * <ul>
	 * <li>Der Status laesst den Uebergang nicht zu, also {@code DRAFT} oder
	 * {@code REVISION}. Kommentieren ist nach §5 in jedem Status erlaubt; ein
	 * 409 haette der Redaktion das Werkzeug in genau dem Stand genommen, in dem
	 * sie es am meisten braucht. Wirkung hat der Wunsch dort trotzdem: solange
	 * er {@code OPEN} ist, sperrt er das Einreichen (§2.4).</li>
	 * <li>Die Person duerfte den Uebergang nicht ausloesen, ist also nicht
	 * zugewiesen (§5 Fussnote 11). Den Kommentar darf sie schreiben, §5 fuehrt
	 * dafuer eine eigene Zeile ohne diese Einschraenkung. Wuerde der Uebergang
	 * hier trotzdem greifen, waere Fussnote 11 durch die Hintertuer ausgehebelt:
	 * es genuegte, statt des Uebergangs einen Kommentar zu schreiben.</li>
	 * </ul>
	 *
	 * <p>Ein 403 waere in beiden Faellen die falsche Antwort, denn der Aufruf,
	 * den die Person gestellt hat, war das Anlegen eines Kommentars, und das
	 * durfte sie.
	 *
	 * @param user    angemeldete Person, bereits als berechtigt zum Kommentieren
	 *                geprueft
	 * @param project das Projekt des Kommentars, in dieser Transaktion geladen
	 */
	public void revisionAfterChangeRequest(AuthenticatedUser user, Project project) {
		if (!ProjectTransition.REQUEST_REVISION.isAllowedFrom(project.getStatus())) {
			return;
		}
		if (!permissions.mayTrigger(user, project, ProjectTransition.REQUEST_REVISION)) {
			return;
		}
		/*
		 * Seit Contract v72 sperrt die kuratierte Liste den Uebergang. Auch
		 * dieser Fall bleibt still: gestellt war die Anfrage, einen Kommentar
		 * anzulegen, und die war erlaubt. Wer den Uebergang wirklich will,
		 * nimmt das Projekt zuerst aus der Liste und bekommt ueber
		 * POST /request-revision die klare Auskunft.
		 */
		if (top10Service.holdsSeat(project)) {
			return;
		}
		applyTransition(user, project, ProjectTransition.REQUEST_REVISION);
	}

	// ------------------------------------------------------------------
	// DELETE /api/projects/{projectId}/editors/me
	// ------------------------------------------------------------------

	/**
	 * Die angemeldete Redakteur:in gibt ihre eigene Zuweisung zurueck (§6.1,
	 * §4.1, seit Contract v68), <strong>200</strong> mit der Detailantwort.
	 *
	 * <p><strong>Warum das hier liegt und nicht im
	 * {@code ProjectWriteService}.</strong> Der Aufruf aendert nicht nur die
	 * Zuweisung: war es die letzte, ist er zugleich ein Statusuebergang mit
	 * Historieneintrag (§3.12). Die Maschinerie dafuer steht in diesem Dienst,
	 * und zwei Stellen, die Statushistorie schreiben, liefen mit der Zeit
	 * auseinander.
	 *
	 * <p><strong>Reihenfolge der Pruefungen nach §6.3.1:</strong> laden (fehlt
	 * → 404) → Berechtigung (nein → 403) → Status (nein → 409) → schreiben.
	 *
	 * <p><strong>Nur die zugewiesene Person selbst.</strong> Fremde Zuweisungen
	 * aendert allein die Administration ueber
	 * {@code PUT /api/projects/{id}/editors}; wer gar nicht zugewiesen ist, hat
	 * hier nichts abzugeben und bekommt <strong>403</strong>
	 * {@code NO_PERMISSION}. Ein 404 waere die falsche Auskunft, denn das
	 * Projekt gibt es (§6.3.1). Entschieden wird ueber die Zuweisung und nicht
	 * ueber die Systemrolle: ein Admin wird in aller Regel nicht zugewiesen
	 * (§4.1), und wo eine technische Zuweisung doch besteht, ist sie es, die
	 * abgegeben wird.
	 *
	 * <p><strong>Nur in {@code SUBMITTED} und {@code REVISION}</strong>, sonst
	 * <strong>409</strong> {@code PROJECT_STATUS_NOT_EDITABLE}. Im {@code DRAFT}
	 * pflegt die Autor:in die Zuweisung selbst (§5 Fussnote 3), ab
	 * {@code APPROVED} ist die redaktionelle Arbeit getan und die Zuweisung nur
	 * noch Protokoll.
	 *
	 * <p><strong>War es die letzte Zuweisung, faellt das Projekt nach
	 * {@code DRAFT}</strong>, protokolliert mit der abgebenden Person als
	 * {@code changedBy}. Andernfalls stuende ein eingereichtes Projekt ohne
	 * zustaendige Redaktion da: genehmigen, veroeffentlichen und zurueckgeben
	 * koennte ausser der Administration niemand mehr (§5 Fussnote 11), und die
	 * Autor:in kaeme nicht heran, weil sie erst im {@code DRAFT} wieder zuweisen
	 * darf. Waren weitere zugewiesen, aendert sich allein die Zuweisung.
	 *
	 * <p><strong>Kommentare bleiben unberuehrt</strong>, offene
	 * Aenderungswuensche also auch. Sie sind der Arbeitsauftrag an die
	 * Projektseite und haengen nicht daran, wer ihn erteilt hat; erledigen kann
	 * die Projektseite sie selbst (§2.4).
	 *
	 * @throws ResourceNotFoundException wenn es die Projekt-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person dem Projekt nicht als
	 *                                   Redaktion zugewiesen ist (403)
	 * @throws ConflictException         wenn der Status das Abgeben nicht
	 *                                   zulaesst (409)
	 */
	public ProjectDetailResponse resignAsEditor(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);

		requireAssignedEditor(user, project);
		requireResignableStatus(project);

		User actor = currentUser(user);
		project.getEditors().removeIf(editor -> editor.getId().equals(actor.getId()));

		boolean wasLast = project.getEditors().isEmpty();
		ProjectStatus from = project.getStatus();
		if (wasLast) {
			project.setStatus(ProjectStatus.DRAFT);
		}
		projectRepository.saveAndFlush(project);

		if (wasLast) {
			recordTransition(project, from, ProjectStatus.DRAFT, actor);
		}

		// Nicht ueber readService.detail: der Aufruf hat der anfragenden Person
		// gerade die Leseberechtigung genommen, mit der sie ihn ausgeloest hat.
		// Begruendung an der Methode.
		return readService.detailAfterOwnResignation(project, actor.getId());
	}

	// ------------------------------------------------------------------
	// DELETE /api/projects/{projectId}/members/me
	// ------------------------------------------------------------------

	/**
	 * Die eigene Projektmitgliedschaft beenden (§6.1 und §3.13.1, seit Contract
	 * v84).
	 *
	 * <p><strong>In jedem Status.</strong> Es gibt hier bewusst keine
	 * Statuspruefung und damit auch kein 409: §3.13.1 hebt die Schranke der
	 * Mitgliederpflege fuer das Austragen der eigenen Person auf. Die
	 * Begruendung steht an {@link ProjectPermissionService#mayLeaveProject}.
	 *
	 * <p><strong>Kein Statusuebergang und kein Eintrag in die
	 * {@code ProjectStatusHistory}</strong>, anders als beim Abgeben der
	 * Redaktionszuweisung. Dort faellt das Projekt zurueck, wenn die letzte
	 * Zuweisung geht, weil ein eingereichtes Projekt ohne Redaktion niemanden
	 * mehr haette. Hier bleibt die Autor:in in jedem Fall, das Projekt ist also
	 * nie verwaist.
	 *
	 * <p><strong>Ohne Antwortkoerper (204).</strong> Eine Momentaufnahme wie bei
	 * {@link #resignAsEditor} waere hier keine Auskunft ueber die eigene
	 * Handlung, sondern ein Blick auf einen fremden Beitrag: ausserhalb von
	 * {@code PUBLISHED} hat die Person unmittelbar danach kein Leserecht mehr.
	 * {@code Project.version} bleibt unveraendert, weil die Metadaten
	 * unberuehrt sind und kein Client hier gegen einen Stand schreibt.
	 *
	 * @throws ResourceNotFoundException wenn es die Projekt-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person nicht Mitglied ist (403)
	 */
	public void leaveProject(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);

		requireMember(user, project);

		UUID actorId = user.getId();
		project.getMembers().removeIf(member -> member.getUser() != null
				&& actorId.equals(member.getUser().getId()));
		projectRepository.saveAndFlush(project);
	}

	// ------------------------------------------------------------------
	// Pruefungen
	// ------------------------------------------------------------------

	/**
	 * Austragen darf allein, wer selbst Mitglied ist (§5, Zeile
	 * „Projektmitgliedschaft beenden").
	 *
	 * <p>Aufgebaut wie {@link #requireAssignedEditor}: die Ressourcenebene
	 * beantwortet {@link ProjectPermissionService#mayLeaveProject}, hier bleibt
	 * allein die Uebersetzung des {@code false} in die richtige Antwort, und die
	 * beiden Gruende bleiben auseinandergehalten (ohne Anmeldung 401, sonst 403).
	 */
	private void requireMember(AuthenticatedUser user, Project project) {
		if (permissions.mayLeaveProject(user, project)) {
			return;
		}
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			throw new AuthenticationCredentialsNotFoundException(
					"Fuer das Beenden einer Projektmitgliedschaft ist eine Anmeldung "
							+ "erforderlich (§5).");
		}
		throw new AccessDeniedException(
				"Beenden kann eine Projektmitgliedschaft nur, wer selbst Mitglied ist; "
						+ "fremde Zeilen aendert die Projektseite ueber "
						+ "PUT /api/projects/{id} (§3.13.1).");
	}

	/**
	 * Abgeben darf allein, wer selbst zugewiesen ist (§5, Zeile „Eigene
	 * Redaktionszuweisung abgeben").
	 *
	 * <p>Die Antwort gibt {@link ProjectPermissionService#mayResignAsEditor}
	 * und nicht dieser Dienst: die Ressourcenebene gehoert vollstaendig dorthin
	 * (Hausregel „Berechtigungen zweistufig"). Hier bleibt allein die
	 * Uebersetzung des {@code false} in die richtige Antwort.
	 *
	 * <p>Die beiden Gruende dafuer auseinandergehalten wie im
	 * {@code Top10NominationService}: ohne Anmeldung 401, sonst 403. Den
	 * ersten Fall faengt die Filterkette in aller Regel schon ab; die
	 * Unterscheidung steht hier trotzdem, damit der Dienst auch fuer sich
	 * genommen die richtige Auskunft gibt.
	 */
	private void requireAssignedEditor(AuthenticatedUser user, Project project) {
		if (permissions.mayResignAsEditor(user, project)) {
			return;
		}
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			throw new AuthenticationCredentialsNotFoundException(
					"Fuer das Abgeben der Redaktionszuweisung ist eine Anmeldung erforderlich "
							+ "(§5).");
		}
		throw new AccessDeniedException(
				"Abgeben kann eine Redaktionszuweisung nur, wer selbst zugewiesen ist; "
						+ "fremde Zuweisungen aendert die Administration ueber "
						+ "PUT /api/projects/{id}/editors (§6.1).");
	}

	/**
	 * §4.1: abgegeben wird nur in {@code SUBMITTED} und {@code REVISION}.
	 *
	 * <p>Eigene Fabrik statt {@link ConflictException#statusNotEditable}, obwohl
	 * derselbe Fehlercode gilt: deren Meldung nennt {@code DRAFT} und
	 * {@code REVISION} als erlaubt und waere hier in beiden Richtungen falsch.
	 */
	private void requireResignableStatus(Project project) {
		ProjectStatus status = project.getStatus();
		if (status != ProjectStatus.SUBMITTED && status != ProjectStatus.REVISION) {
			throw ConflictException.resignNotAllowed(status.name());
		}
	}

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
	 * Ein veroeffentlichtes Projekt geht nicht nach {@code REVISION}, solange
	 * es in der kuratierten Top-10 steht (§4.1, §3.11.1, seit Contract v72).
	 *
	 * <p><strong>Die Reihenfolge ist seit v72 umgedreht.</strong> Bis v71 entzog
	 * der Uebergang den Platz still mit; ein einziges Zurueckgeben nahm damit
	 * einen kuratierten Beitrag aus der oeffentlichen Auswahl, ohne dass jemand
	 * darueber entschieden haette. Die Startseite gehoert nach §5 allein der
	 * Administration: erst aus der Liste nehmen, dann zurueckgeben.
	 *
	 * <p><strong>409 und nicht 403.</strong> Die Person darf den Uebergang, das
	 * Projekt ist nur gerade nicht in dem Zustand, in dem er greift (§6.3.1).
	 * Die Meldung nennt den Weg aus der Liste, sonst bliebe die Auskunft eine
	 * Sackgasse.
	 */
	private void requireNotInTop10ForRevision(Project project) {
		if (project.getStatus() != ProjectStatus.PUBLISHED) {
			return;
		}
		if (!top10Service.holdsSeat(project)) {
			return;
		}
		throw ConflictException.resourceInUse(
				"Dieses Projekt steht in der Top-10 und laesst sich deshalb nicht "
						+ "zurueckgeben. Die Administration nimmt es zuerst aus der Liste, "
						+ "ueber PUT /api/admin/top10 oder ueber das Zurueckziehen der "
						+ "Nominierung (§3.11.1, §4.1).");
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
	 * fehlende Feld. Sonst muesste die Person am Formular so oft einreichen, wie
	 * ihr Angaben fehlen, um zu erfahren, was ihr noch fehlt.
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
	 * <p><strong>Eine Ausnahme gibt es seit KAN-37.</strong>
	 * {@link #resignAsEditor} setzt den Status ohne diesen Weg, weil das Abgeben
	 * kein Uebergang aus der Tabelle ist, sondern eine Zuweisungsaenderung mit
	 * einer Statusfolge. Der Top-10-Entzug fehlt dort folgerichtig: abgegeben
	 * wird nur aus {@code SUBMITTED} und {@code REVISION}, und aus keinem der
	 * beiden verlaesst ein Projekt {@code PUBLISHED}. Wer hier kuenftig etwas
	 * ergaenzt, das fuer <em>jeden</em> Statuswechsel gelten soll, prueft
	 * {@code resignAsEditor} mit.
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

		applyTransition(user, project, transition);
		return readService.detail(user, project.getId());
	}

	/**
	 * Der Uebergang selbst, ohne die Antwort. Herausgeloest mit Contract v71,
	 * weil {@link #revisionAfterChangeRequest} ihn braucht und die Detailantwort
	 * nicht: sie kostet eine eigene Abfrage, und der Aufrufer dort gibt einen
	 * Kommentar zurueck und kein Projekt.
	 */
	private void applyTransition(AuthenticatedUser user, Project project,
			ProjectTransition transition) {

		ProjectStatus from = project.getStatus();
		project.setStatus(transition.target());
		projectRepository.saveAndFlush(project);

		User actor = currentUser(user);
		recordTransition(project, from, transition.target(), actor);
		/*
		 * Der Entzug bleibt als Sicherung stehen (§3.17 fuehrt ihn weiter als
		 * Schreibweg), kann seit Contract v72 aber nicht mehr ausloesen:
		 * requireNotInTop10 und holdsSeat weisen den einzigen Uebergang aus
		 * PUBLISHED vorher ab, releaseSeat findet also keinen Eintrag. Das
		 * Loeschen eines Projekts laeuft nicht hier durch, sondern ueber
		 * Top10Service.removeOnProjectDeletion aus dem ProjectWriteService.
		 */
		top10Service.removeOnLeavingPublished(project, actor);

		/*
		 * Offene Nominierungen fallen mit (§3.11.1, seit v72). Sie waeren sonst
		 * unerfuellbar und im Weg zugleich: annehmen liesse sich das Projekt
		 * nicht mehr, und offen sperrte der Vorschlag es gegen jeden neuen.
		 * Angenommene bleiben stehen, sie sind Protokoll.
		 */
		if (from == ProjectStatus.PUBLISHED) {
			top10Service.withdrawOpenNominations(project, actor);
		}
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
	 * <p>Ein eigener Typ statt einer Bedingung je Feld, damit die Liste
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
