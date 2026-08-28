package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.editlock.EditLockGuard;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.ModuleRepository;
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.SemesterRepository;
import de.hsbremen.eportfolio.masterdata.StudyProgramRepository;
import de.hsbremen.eportfolio.masterdata.Tag;
import de.hsbremen.eportfolio.masterdata.TagRepository;
import de.hsbremen.eportfolio.project.dto.MemberRequest;
import de.hsbremen.eportfolio.project.dto.ProjectCreateRequest;
import de.hsbremen.eportfolio.project.dto.ProjectDetailResponse;
import de.hsbremen.eportfolio.project.dto.ProjectEditorsRequest;
import de.hsbremen.eportfolio.project.dto.ProjectMetadataRequest;
import de.hsbremen.eportfolio.project.dto.ProjectUpdateRequest;
import de.hsbremen.eportfolio.top10.Top10Service;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die schreibenden Projekt-Endpoints aus API-Contract §6.1:
 * {@code POST /api/projects}, {@code PUT /api/projects/{id}},
 * {@code PUT /api/projects/{id}/editors} und
 * {@code DELETE /api/projects/{id}}.
 *
 * <p><strong>Warum getrennt vom {@link ProjectReadService}:</strong> das Lesen
 * haelt die gesamte Filter-, Sortier- und Sichtbarkeitslogik, das Schreiben den
 * Zustandsautomaten (§4.1), die Versionspruefung (§6.4) und den Abgleich der
 * beiden eingebetteten Listen. Die beiden teilen sich nichts ausser der Entity.
 * In einer Klasse stuenden zwei Themen nebeneinander, die nur den Namen teilen.
 *
 * <p><strong>Die Antwort kommt vom Lesedienst.</strong> Alle drei schreibenden
 * Endpoints, die einen Koerper liefern, geben ein
 * {@link ProjectDetailResponse} zurueck und bauen es nicht selbst, sondern
 * lassen es sich von {@link ProjectReadService#detail} erzeugen. So ist
 * garantiert, dass die Antwort auf ein {@code POST} oder {@code PUT} exakt der
 * eines anschliessenden {@code GET} entspricht, einschliesslich der
 * Sichtbarkeitsregeln fuer {@code statusHistory} (§5, Fussnote ⁷) und fuer
 * {@code editors}, das seit Contract v55 einer eigenen, weiteren Regel folgt
 * (§3.3). Eine zweite Zusammenstellung derselben Antwort waere genau die
 * Stelle, an der die beiden auseinanderlaufen.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> in jeder Methode, nach §6.3.1
 * und dem Ablaufmuster aus dem Skill {@code backend-modul}: laden (fehlt → 404)
 * → Berechtigung (nein → 403) → Statusregel (nein → 409) → Versionsstand
 * (nein → 409) → fachliche Validierung (nein → 400) → schreiben. Die Existenz
 * einer Ressource wird dabei nicht hinter einem 404 verborgen (§6.3.1).
 *
 * <p><strong>Die Bearbeitungssperre (§6.9, seit Contract v85) steht zwischen
 * Statusregel und Versionsstand, aber nur in {@link #update}.</strong> Dort
 * wird der Beitrag selbst geaendert, und genau darum geht es ihr.
 * {@link #create} kann sie nicht betreffen, {@code reassignEditors} ist der
 * Weg der Administration und laeuft nach §6.1 bewusst an ihr vorbei, und das
 * Loeschen ebenso: ein Projekt, das verschwindet, braucht keine Reihenfolge
 * unter seinen Bearbeitenden. Sperre und Versionsstand antworten beide mit
 * 409, und die Sperre ist der speziellere Grund; ausfuehrlich im
 * {@link BlockService}.
 */
@Service
@Transactional
public class ProjectWriteService {

	private final ProjectRepository projectRepository;

	private final ProjectStatusHistoryRepository statusHistoryRepository;

	private final UserRepository userRepository;

	private final CategoryRepository categoryRepository;

	private final FacultyRepository facultyRepository;

	private final StudyProgramRepository studyProgramRepository;

	private final ModuleRepository moduleRepository;

	private final SemesterRepository semesterRepository;

	private final TagRepository tagRepository;

	private final ProjectPermissionService permissions;

	private final ProjectReadService readService;

	/**
	 * Nur fuer den Protokolleintrag vor dem Loeschen (§3.17). Die Abhaengigkeit
	 * zeigt in dieselbe Richtung wie die des {@link ProjectWorkflowService}, der
	 * den Entzug beim Statuswechsel ausloest; sie kommt also nicht neu hinzu.
	 */
	private final Top10Service top10Service;

	/**
	 * Setzt die Bearbeitungssperre aus §6.9 am Metadatenpfad durch, genauso wie
	 * im {@code BlockService} am Inhaltspfad. Beide Wege schreiben am Beitrag
	 * selbst, also muessen beide fragen: waere die Sperre nur am Inhalt
	 * geprueft, liessen sich Titel, Kurzbeschreibung oder Mitgliederliste
	 * aendern, waehrend jemand anders im Editor sitzt.
	 *
	 * <p><strong>Das eigene Austragen bleibt davon frei.</strong>
	 * {@code DELETE /projects/{id}/members/me} aendert zwar dieselbe Liste,
	 * laeuft aber ausdruecklich ohne diese Pruefung: wer nicht laenger als
	 * Mitwirkende:r genannt werden will, soll nicht warten muessen, bis jemand
	 * anders den Editor schliesst. §3.13.1 hebt fuer diesen Weg schon die
	 * Statusschranke auf, und die Sperre folgt derselben Ueberlegung.
	 */
	private final EditLockGuard editLockGuard;

	public ProjectWriteService(ProjectRepository projectRepository,
			ProjectStatusHistoryRepository statusHistoryRepository,
			UserRepository userRepository,
			CategoryRepository categoryRepository,
			FacultyRepository facultyRepository,
			StudyProgramRepository studyProgramRepository,
			ModuleRepository moduleRepository,
			SemesterRepository semesterRepository,
			TagRepository tagRepository,
			ProjectPermissionService permissions,
			ProjectReadService readService,
			Top10Service top10Service,
			EditLockGuard editLockGuard) {
		this.projectRepository = projectRepository;
		this.statusHistoryRepository = statusHistoryRepository;
		this.userRepository = userRepository;
		this.categoryRepository = categoryRepository;
		this.facultyRepository = facultyRepository;
		this.studyProgramRepository = studyProgramRepository;
		this.moduleRepository = moduleRepository;
		this.semesterRepository = semesterRepository;
		this.tagRepository = tagRepository;
		this.permissions = permissions;
		this.readService = readService;
		this.top10Service = top10Service;
		this.editLockGuard = editLockGuard;
	}

	// ------------------------------------------------------------------
	// POST /api/projects
	// ------------------------------------------------------------------

	/**
	 * Legt ein Projekt im Status {@code DRAFT} an (§4.1, Zeile „Anlegen").
	 *
	 * <p>Autor:in ist immer die angemeldete Person; das Feld steht nicht im
	 * Body. Pflicht ist allein der Titel, alle uebrigen Metadaten duerfen im
	 * Entwurf fehlen und werden erst beim Einreichen verlangt (§3.3).
	 *
	 * <p><strong>Der Anlagevorgang wird protokolliert.</strong> §4.1 fuehrt
	 * „Anlegen" als Uebergang von nichts nach {@code DRAFT} und verlangt zu
	 * jedem Uebergang einen {@code ProjectStatusHistory}-Eintrag (§3.12). Der
	 * erste Eintrag traegt deshalb {@code fromStatus = null}; genau dafuer ist
	 * das Feld nullable. Ohne ihn begaenne der Verlauf jedes Projekts mit einer
	 * Luecke, und „wann ist das entstanden" waere nur ueber {@code createdAt}
	 * und damit ausserhalb der Historie zu beantworten.
	 *
	 * @param user    angemeldete Person; ohne Anmeldung kommt die Anfrage hier
	 *                nicht an, weil der Pfad in {@code SecurityConfig} unter
	 *                {@code authenticated()} faellt (401)
	 * @param request Titel und optionale Metadaten
	 * @throws AccessDeniedException wenn die Rechtematrix das Anlegen nicht
	 *                               zulaesst (403)
	 * @throws ValidationException   bei unbekannten IDs im Body (400)
	 */
	public ProjectDetailResponse create(AuthenticatedUser user, ProjectCreateRequest request) {
		if (!permissions.mayCreateProject(user)) {
			throw new AccessDeniedException("Zum Anlegen eines Projekts fehlt die Berechtigung.");
		}
		User author = loadCurrentUser(user);

		// Vor jeder Mutation, siehe resolveTags.
		Set<Tag> tags = resolveTags(request.tags());

		Project project = new Project();
		project.setAuthor(author);
		project.setStatus(ProjectStatus.DRAFT);
		applyMetadata(project, request);
		applyTags(project, tags);

		Separation before = separationOf(project);
		applyMembers(user, project, request.members(), author);
		applyEditors(user, project, request.editorIds());
		requireProjectSideSeparateFromEditors(project, before);

		Project saved = projectRepository.saveAndFlush(project);
		recordCreation(saved, author);

		return readService.detail(user, saved.getId());
	}

	// ------------------------------------------------------------------
	// PUT /api/projects/{id}
	// ------------------------------------------------------------------

	/**
	 * Aendert ausschliesslich die Metadaten eines Projekts (§6.1). Der Inhalt
	 * laeuft ueber {@code PUT /projects/{id}/blocks} (KAN-18).
	 *
	 * <p>Die Einzelfelder werden ersetzt: was im Body fehlt, wird {@code null}.
	 * Die drei Sammlungen {@code tags}, {@code editorIds} und {@code members}
	 * bleiben dagegen unveraendert, wenn sie fehlen, und werden mit {@code []}
	 * geleert. Begruendung in {@link ProjectUpdateRequest}.
	 *
	 * @param user      angemeldete Person
	 * @param projectId ID aus dem Pfad
	 * @param request   neue Metadaten samt {@code version}
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person nicht zur Projektseite
	 *                                   gehoert (403)
	 * @throws ConflictException         wenn der Status die Bearbeitung sperrt,
	 *                                   jemand anders die Bearbeitungssperre
	 *                                   haelt (§6.9) oder {@code version}
	 *                                   veraltet ist (409)
	 * @throws ValidationException       bei unbekannten IDs im Body (400)
	 */
	public ProjectDetailResponse update(AuthenticatedUser user, UUID projectId,
			ProjectUpdateRequest request) {

		Project project = load(projectId);
		requireEditable(user, project);
		editLockGuard.requireNotLockedByOther(projectId, user.getId());
		requireCurrentVersion(project, request.version());

		// Vor jeder Mutation, siehe resolveTags.
		Set<Tag> tags = resolveTags(request.tags());

		applyMetadata(project, request);
		applyTags(project, tags);

		Separation before = separationOf(project);
		applyMembers(user, project, request.members(), project.getAuthor());
		applyEditors(user, project, request.editorIds());
		requireProjectSideSeparateFromEditors(project, before);

		projectRepository.saveAndFlush(project);

		return readService.detail(user, projectId);
	}

	/**
	 * Trennt die beiden Gruende, aus denen eine Metadatenaenderung scheitern
	 * kann, in zwei verschiedene Antworten.
	 *
	 * <p>Gehoert die anfragende Person zur Projektseite, liegt es am Status:
	 * <strong>409</strong> {@code PROJECT_STATUS_NOT_EDITABLE} (§4.1). Sonst
	 * fehlt ihr das Recht: <strong>403</strong> {@code NO_PERMISSION}.
	 *
	 * <p>Die Reihenfolge ist bewusst so: Unbeteiligte bekommen auch bei einem
	 * gesperrten Projekt 403 und nicht 409. Ein 409 wuerde ihnen verraten, dass
	 * sie bei einem offenen Projekt weitergekommen waeren, und damit den Status
	 * eines fremden Entwurfs preisgeben.
	 */
	private void requireEditable(AuthenticatedUser user, Project project) {
		if (permissions.mayEditMetadata(user, project)) {
			return;
		}
		if (permissions.isProjectSide(user, project)) {
			throw ConflictException.statusNotEditable(project.getStatus().name());
		}
		throw new AccessDeniedException(
				"Metadaten aendern duerfen nur die Autor:in und die Projektmitglieder (§6.1).");
	}

	/**
	 * Vergleicht die {@code version} aus dem Body mit dem Stand in der
	 * Datenbank (§6.4).
	 *
	 * <p><strong>Warum ausdruecklich und nicht nur ueber Hibernate:</strong> der
	 * Zaehler an der Entity gehoert dem Persistenzlayer und hat bewusst keinen
	 * Setter. Ohne diesen Vergleich wuerde der eingeschickte Wert schlicht
	 * ignoriert und ein veralteter Client bekaeme sein Update genau dann
	 * durchgewunken, wenn zwischen den beiden Requests niemand sonst
	 * geschrieben hat, also im haeufigsten Fall des stillen Ueberschreibens:
	 * derselbe Mensch mit zwei offenen Browser-Tabs. Die Pruefung von Hibernate
	 * bleibt daneben bestehen, sie faengt den echten Wettlauf zweier
	 * gleichzeitiger Transaktionen ab.
	 */
	private void requireCurrentVersion(Project project, Long expected) {
		if (!Objects.equals(project.getVersion(), expected)) {
			throw ConflictException.versionConflict();
		}
	}

	// ------------------------------------------------------------------
	// PUT /api/projects/{id}/editors
	// ------------------------------------------------------------------

	/**
	 * Verteilt die zustaendige Redaktion neu (§6.1): ADMIN, jederzeit und
	 * unabhaengig vom Status.
	 *
	 * <p>Ohne Statuspruefung und ohne {@code version}: der Endpoint existiert
	 * gerade fuer die Faelle, in denen die Metadaten gesperrt sind. Begruendung
	 * in {@link ProjectEditorsRequest}.
	 *
	 * <p><strong>Die Trennung von Projektseite und Redaktion gilt auch
	 * hier</strong> (§5, Fussnote ³ seit Contract v61, KAN-77). Die Berechtigung
	 * bleibt unveraendert bei der Administration; ohne die Zustandspruefung
	 * bliebe aber genau ein Weg offen, auf dem ein Projektmitglied doch noch zur
	 * zustaendigen Redaktion des eigenen Projekts wuerde.
	 *
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person kein Admin ist (403)
	 * @throws ValidationException       bei unbekannten IDs im Body und bei einer
	 *                                   neu entstehenden Ueberschneidung mit der
	 *                                   Projektseite (400)
	 */
	public ProjectDetailResponse reassignEditors(AuthenticatedUser user, UUID projectId,
			ProjectEditorsRequest request) {

		Project project = load(projectId);
		if (!permissions.mayReassignEditors(user)) {
			throw new AccessDeniedException(
					"Die Redaktion umverteilen darf nur die Administration (§6.1).");
		}

		Separation before = separationOf(project);
		replaceEditors(project, request.editorIds());
		requireProjectSideSeparateFromEditors(project, before);

		projectRepository.saveAndFlush(project);

		return readService.detail(user, projectId);
	}

	// ------------------------------------------------------------------
	// DELETE /api/projects/{id}
	// ------------------------------------------------------------------

	/**
	 * Loescht ein Projekt (§6.1): die Autor:in nur im {@code DRAFT}, der Admin
	 * jederzeit.
	 *
	 * <p><strong>Warum die Autor:in nur im Entwurf:</strong> ab {@code SUBMITTED}
	 * haengt an dem Projekt fremde Arbeit, naemlich die redaktionelle Pruefung.
	 * Ein veroeffentlichtes Projekt zu loeschen hiesse ausserdem, eine oeffentlich
	 * verlinkte Seite verschwinden zu lassen.
	 *
	 * <p><strong>Abhaengige Zeilen fallen per Cascade.</strong> Bloecke, Tags,
	 * Mitglieder und die Redaktionszuweisung raeumt JPA ueber die Beziehungen
	 * des Aggregats ab; Kommentare, Reaktionen, Statushistorie und
	 * Top-10-Eintraege loescht die Datenbank ueber {@code on delete cascade}, das
	 * an allen Fremdschluesseln auf {@code project} steht. Kein
	 * {@code version}-Feld: {@code DELETE} hat keinen Koerper, und anders als
	 * beim Speichern gibt es hier nichts zu ueberschreiben, was jemand anderes
	 * verlieren koennte.
	 *
	 * <p><strong>Eine Ausnahme von der Cascade ist das Top-10-Protokoll</strong>
	 * (§3.17, seit KAN-45). Belegt das Projekt einen Platz, wird der Entzug
	 * <em>vor</em> dem Loeschen protokolliert; sonst verschwaende es lautlos aus
	 * der kuratierten Liste, weil die Cascade in {@code top10_entry} keinen
	 * Java-Code beruehrt. Die Protokollzeile selbst faellt nicht mit: ihr
	 * Fremdschluessel steht auf {@code on delete set null}, sie verliert also nur
	 * ihren Projektverweis und behaelt Zeitpunkt, Person, Aktion und Platz.
	 *
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Rechtematrix das Loeschen nicht
	 *                                   zulaesst (403)
	 */
	public void delete(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		if (!permissions.mayDeleteProject(user, project)) {
			throw new AccessDeniedException("Fuer dieses Projekt fehlt die Loeschberechtigung.");
		}

		top10Service.removeOnProjectDeletion(project, loadCurrentUser(user));
		projectRepository.delete(project);
	}

	// ------------------------------------------------------------------
	// Metadaten und Tags
	// ------------------------------------------------------------------

	/**
	 * Uebernimmt die Einzelfelder aus §3.3. Gemeinsam fuer Anlegen und Aendern,
	 * damit die beiden Pfade nicht auseinanderlaufen (siehe
	 * {@link ProjectMetadataRequest}).
	 *
	 * <p>Leere Zeichenketten werden zu {@code null}: ein Formular schickt
	 * unausgefuellte Felder als {@code ""} mit, und ein leerer Teaser ist kein
	 * Teaser. Ohne diese Umdeutung stuende in der Datenbank je nach Client
	 * einmal {@code null} und einmal {@code ""} fuer denselben Sachverhalt.
	 *
	 * <p>Die Stammdatenbezuege werden bewusst <em>nicht</em> gegeneinander
	 * geprueft: der Contract fuehrt sie in §3.3 als vier unabhaengige,
	 * nullable Fremdschluessel, und ein Entwurf darf unfertig sein. Ob der
	 * Studiengang zur Fakultaet passt, ist eine Frage fuer das Einreichen
	 * (KAN-19) und nicht fuer jeden Zwischenstand.
	 */
	private void applyMetadata(Project project, ProjectMetadataRequest request) {
		project.setTitle(request.title().trim());
		project.setSummary(emptyAsNull(request.summary()));
		project.setCoverImageUrl(emptyAsNull(request.coverImageUrl()));
		project.setProjectType(request.projectType());
		project.setDegree(request.degree());
		project.setSemester(semesterReference(request.semesterId(), project.getSemester()));
		project.setCategory(reference(request.categoryId(), categoryRepository, "categoryId"));
		project.setFaculty(reference(request.facultyId(), facultyRepository, "facultyId"));
		project.setStudyProgram(
				reference(request.studyProgramId(), studyProgramRepository, "studyProgramId"));
		project.setModule(reference(request.moduleId(), moduleRepository, "moduleId"));
		/* Leerraum ist keine Bezeichnung, wie bei projectRole auch (§3.3 seit
		   Contract v66). */
		project.setAuthorRole(normalizedRole(request.authorRole()));
	}

	/**
	 * Loest einen Stammdatenbezug auf. Eine unbekannte ID ergibt
	 * <strong>400</strong> und nicht 404: adressiert ist das Projekt, und das
	 * gibt es. Falsch ist der Inhalt der Anfrage. Ein 404 waere hier
	 * mehrdeutig, weil dieselbe Antwort schon „dieses Projekt gibt es nicht"
	 * bedeutet.
	 */
	private <T> T reference(UUID id, JpaRepository<T, UUID> repository, String field) {
		if (id == null) {
			return null;
		}
		return repository.findById(id).orElseThrow(() -> new ValidationException(
				ErrorCodes.VALIDATION_FAILED,
				"Unter der in \"" + field + "\" angegebenen ID gibt es keinen Eintrag."));
	}

	/**
	 * Loest das Semester auf (§3.18). Wie {@link #reference} ergibt eine
	 * unbekannte ID <strong>400</strong>, dazu kommt hier der Auswahlzustand.
	 *
	 * <p><strong>Ein inaktives Semester laesst sich nicht neu setzen</strong>,
	 * denn genau dafuer gibt es {@code active}: die Administration nimmt ein
	 * abgelaufenes Semester aus der Auswahl, und ein Client, der die Liste
	 * ungefiltert laedt, soll es nicht doch anbieten koennen.
	 *
	 * <p><strong>Ein bereits gesetztes bleibt dagegen stehen</strong>, auch wenn
	 * es inzwischen deaktiviert wurde. Sonst waere ein Projekt aus dem
	 * vergangenen Semester nicht mehr speicherbar, sobald die Administration
	 * aufraeumt: jedes {@code PUT} schickt die vollstaendigen Metadaten mit
	 * (§6.1), also auch das unveraenderte Semester, und liefe in einen 400, den
	 * die schreibende Person nicht aufloesen koennte, ohne die Angabe zu
	 * verlieren.
	 *
	 * @param requested die ID aus dem Body; {@code null} loescht die Zuordnung
	 * @param current   das Semester, das am Projekt bereits steht
	 */
	private Semester semesterReference(UUID requested, Semester current) {
		if (requested == null) {
			return null;
		}
		if (current != null && requested.equals(current.getId())) {
			return current;
		}

		Semester semester = reference(requested, semesterRepository, "semesterId");
		if (!semester.isActive()) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"semesterId: Dieses Semester steht nicht mehr zur Auswahl.");
		}
		return semester;
	}

	/** Innere Mehrfach-Leerzeichen, siehe {@link #normalizedTagName(String)}. */
	private static final Pattern INNER_WHITESPACE = Pattern.compile("\\s+");

	/**
	 * Schlagwoerter, hoechstens fuenf (§3.3, §3.19). Die Obergrenze und die
	 * Laenge je Wort pruefen die Bean-Validation am Request; hier wird
	 * normalisiert, aufgeloest und uebernommen.
	 *
	 * <p><strong>Seit Contract v57 werden daraus Stammdatenzeilen.</strong> Ein
	 * Wort, das es schon gibt, wird wiederverwendet, und zwar mit
	 * <em>seinem</em> Anzeigenamen: wer &bdquo;nachhaltigkeit&ldquo; tippt,
	 * bekommt das vorhandene &bdquo;Nachhaltigkeit&ldquo;. Sonst stuenden auf
	 * zwei Kacheln zwei Schreibweisen desselben Worts, und die Vorschlagsliste
	 * fuehrte es doppelt.
	 *
	 * <p>Ein Wort, das es noch nicht gibt, entsteht in der getippten
	 * Schreibweise. Das ist die Entscheidung aus §3.19: das Feld ist eine
	 * Combobox und kein Auswahlfeld mit fester Liste, und es gibt keinen
	 * Freigabeschritt.
	 *
	 * <p>Aufgeloest wird in {@link #resolveTags(Set)}, und zwar vor jeder
	 * Mutation am Projekt; hier wird nur noch uebernommen.
	 *
	 * <p><strong>Sortiert wird, bevor aufgeloest wird.</strong> Stehen in
	 * <em>einer</em> Anfrage zwei Schreibweisen desselben neuen Worts, entsteht
	 * die Zeile in derjenigen, die zuerst an die Reihe kommt. Ohne das
	 * {@code sorted()} waere das die Iterationsreihenfolge eines {@code Set},
	 * also nichts, worauf sich jemand berufen koennte: dieselbe Anfrage koennte
	 * einmal &bdquo;Robotik&ldquo; und einmal &bdquo;robotik&ldquo; anlegen. Auf
	 * ein vorhandenes Wort hat die Reihenfolge keinen Einfluss, das gewinnt
	 * ohnehin mit seinem Anzeigenamen.
	 *
	 * <p>Die vorhandene Sammlung wird geleert und neu gefuellt statt ersetzt:
	 * sie gehoert zu einer verwalteten Entity, und ein neues {@code Set} wuerde
	 * Hibernate die Sammlung unter den Fuessen wegziehen. Der Vergleich davor
	 * spart den Schreibvorgang, wenn sich nichts geaendert hat; er traegt, weil
	 * beide Seiten dieselben verwalteten Instanzen desselben
	 * Persistenzkontextes enthalten.
	 */
	private void applyTags(Project project, Set<Tag> wanted) {
		if (wanted == null) {
			return;
		}
		if (project.getTags().equals(wanted)) {
			return;
		}
		project.getTags().clear();
		project.getTags().addAll(wanted);
	}

	/**
	 * Loest die eingehenden Namen in Zeilen der Tabelle {@code tag} auf, ohne das
	 * Projekt anzufassen.
	 *
	 * <p><strong>Warum das vor jeder Mutation geschieht und nicht mittendrin:</strong>
	 * das Auflösen fragt die Datenbank ({@link #tagReference}), und Hibernate
	 * schreibt vor einer Abfrage aus, was im Persistenzkontext offen steht. Liefe
	 * es nach {@code applyMetadata}, entstuende dort ein erster
	 * {@code update project ...} und damit ein Versionsschritt, der zweite kaeme
	 * beim Schreiben der Zuordnungen: ein Aufruf von {@code PUT} zaehlte
	 * {@code version} um zwei hoch statt um eins (§6.4). Fachlich waere das
	 * folgenlos, weil die Antwort den neuen Stand traegt, aber es widerspraeche
	 * der Zusage &bdquo;ein Schreibvorgang, ein Versionsschritt&ldquo;, an der
	 * sich der Editor mit seinem Autosave orientiert. Vor der ersten Mutation ist
	 * nichts offen, der Flush schreibt nichts, und es bleibt bei einem Schritt.
	 *
	 * @param requested Namen aus dem Request; {@code null} heisst
	 *                  &bdquo;unveraendert&ldquo; und wird durchgereicht
	 * @return die aufgeloesten Zeilen, oder {@code null} bei {@code null}
	 */
	private Set<Tag> resolveTags(Set<String> requested) {
		if (requested == null) {
			return null;
		}
		return requested.stream()
				.map(ProjectWriteService::normalizedTagName)
				.filter(name -> !name.isEmpty())
				.distinct()
				.sorted()
				.map(this::tagReference)
				.collect(Collectors.toCollection(LinkedHashSet::new));
	}

	/**
	 * Die Normalform eines Schlagworts: getrimmt, innere Mehrfach-Leerzeichen
	 * zusammengezogen.
	 *
	 * <p>Genau dieselbe Form benutzt die Migration {@code V202608191630__tag.sql}
	 * bei der Uebernahme des Bestands. Liefen die beiden auseinander, gaebe es
	 * Zeilen, die dieser Schreibweg nie wiederfaende: er suchte nach
	 * &bdquo;Green IT&ldquo; und legte es neben einem gespeicherten
	 * &bdquo;Green&nbsp;&nbsp;IT&ldquo; ein zweites Mal an.
	 *
	 * <p>Die Gross- und Kleinschreibung bleibt hier stehen. Sie ist erst beim
	 * Vergleich gleichgueltig, und fuer ein neues Tag ist sie der Anzeigename.
	 *
	 * <p>Dass {@link #applyTags} das Ergebnis danach auf Leere prueft, ist
	 * Vorsorge und kein toter Zweig mit Aussicht auf Wirkung: heute faengt die
	 * Bean-Validation den nur aus Leerzeichen bestehenden Wert schon am Request
	 * ab ({@code @NotBlank}, 400 {@code VALIDATION_FAILED}). Faellt diese
	 * Annotation kuenftig weg, entsteht hier trotzdem keine Zeile mit leerem
	 * Namen.
	 */
	private static String normalizedTagName(String raw) {
		return INNER_WHITESPACE.matcher(raw.trim()).replaceAll(" ");
	}

	/**
	 * Loest einen normalisierten Namen in eine Zeile der Tabelle {@code tag} auf
	 * und legt sie an, falls es sie noch nicht gibt (§3.19).
	 *
	 * <p><strong>Einfuegen statt vorher fragen und dann einfuegen.</strong> Zwei
	 * gleichzeitige Speicherungen mit demselben neuen Wort verletzten sonst den
	 * Unique-Index {@code uq_tag_name_lower}; PostgreSQL braeche die laufende
	 * Transaktion daraufhin ab, und aus einem gelungenen Speichervorgang wuerde
	 * 500 {@code INTERNAL_ERROR}. {@code insertIfAbsent} laesst den Fehler gar
	 * nicht erst entstehen, weshalb hier auch kein Fehlercode hinzukommt.
	 *
	 * <p>Die vorgeschaltete Suche bleibt trotzdem stehen: im Regelfall gibt es
	 * das Wort bereits, und dann ist ein Lesevorgang billiger als ein Einfuegen,
	 * das ohnehin nichts tut.
	 */
	private Tag tagReference(String name) {
		return tagRepository.findByNameNormalized(name)
				.orElseGet(() -> {
					tagRepository.insertIfAbsent(name);
					return tagRepository.findByNameNormalized(name)
							.orElseThrow(() -> new IllegalStateException(
									"Tag konnte nicht angelegt werden: " + name));
				});
	}

	// ------------------------------------------------------------------
	// Mitgliederliste (§3.13.1)
	// ------------------------------------------------------------------

	/**
	 * Gleicht die Mitgliederliste ab (§3.13.1).
	 *
	 * <p>Berechtigt sind Autor:in <em>und</em> bestehende Mitglieder, nur in
	 * {@code DRAFT} und {@code REVISION}. Ein Mitglied darf also weitere
	 * aufnehmen und andere entfernen; §3.13.1 begruendet das damit, dass sich
	 * Gruppenarbeiten nicht ueber eine einzelne privilegierte Person
	 * organisieren.
	 *
	 * <p>Die Pruefung greift nur, wenn sich die Liste tatsaechlich aendert. Wer
	 * die unveraenderte Liste zurueckschickt, weil er das Objekt aus
	 * {@code GET} durchreicht, aendert nichts und braucht dafuer auch kein
	 * Recht.
	 */
	private void applyMembers(AuthenticatedUser user, Project project, List<MemberRequest> requested,
			User author) {

		if (requested == null) {
			return;
		}
		Map<UUID, String> wanted = validateMembers(requested, author);
		if (currentMembers(project).equals(wanted)) {
			return;
		}
		if (!permissions.mayManageMembers(user, project)) {
			throw new AccessDeniedException(
					"Die Mitgliederliste pflegen duerfen nur die Autor:in und die vorhandenen "
							+ "Projektmitglieder, und nur in DRAFT und REVISION (§3.13.1).");
		}
		replaceMembers(project, wanted);
	}

	/**
	 * Prueft die gewuenschte Liste und bringt sie in die Form „Konto nach
	 * Funktionsbezeichnung".
	 *
	 * <p>Zwei fachliche Regeln aus §3.13.1 stehen hier: die Autor:in ist kein
	 * Mitglied, sie steht in {@code Project.authorId} und traegt ihre
	 * Funktionsbezeichnung seit Contract v66 in {@code authorRole}; und ein
	 * Konto ist
	 * hoechstens einmal Mitglied desselben Projekts, was die Datenbank ueber
	 * {@code unique(project_id, user_id)} ohnehin erzwingt. Beides ergibt
	 * <strong>400</strong>. Die Doppelung vor dem Schreiben abzufangen ist
	 * kein Selbstzweck: aus der Datenbank kaeme sonst eine
	 * Constraint-Verletzung und damit ein 500 statt einer Antwort, mit der der
	 * Client etwas anfangen kann.
	 */
	private Map<UUID, String> validateMembers(List<MemberRequest> requested, User author) {
		Map<UUID, String> wanted = new LinkedHashMap<>();
		for (MemberRequest entry : requested) {
			// containsKey und nicht der Rueckgabewert von put: seit Contract
			// v65 darf die Bezeichnung null sein, und put gaebe fuer eine
			// vorhandene Zeile ohne Bezeichnung ebenfalls null zurueck. Die
			// Doppelung bliebe unbemerkt und liefe in die
			// Constraint-Verletzung, die diese Pruefung gerade abfaengt.
			if (wanted.containsKey(entry.userId())) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Ein Konto kann nur einmal Mitglied desselben Projekts sein (§3.13).");
			}
			if (author != null && entry.userId().equals(author.getId())) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Die Autor:in ist kein Projektmitglied und gehoert nicht in die Liste "
								+ "(§3.13.1). Ihre Funktionsbezeichnung steht in authorRole.");
			}
			wanted.put(entry.userId(), normalizedRole(entry.projectRole()));
		}
		return wanted;
	}

	/**
	 * Leerraum ist keine Bezeichnung. Seit Contract v65 ist das Feld
	 * freiwillig; eine Zeichenkette aus Leerzeichen waere weder eine Angabe
	 * noch ein ausdrueckliches Nichts und liefe beim naechsten Vergleich als
	 * Aenderung durch.
	 */
	private String normalizedRole(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private Map<UUID, String> currentMembers(Project project) {
		Map<UUID, String> current = new LinkedHashMap<>();
		for (ProjectMember member : project.getMembers()) {
			if (member.getUser() != null) {
				current.put(member.getUser().getId(), member.getProjectRole());
			}
		}
		return current;
	}

	/**
	 * Schreibt die neue Mitgliederliste.
	 *
	 * <p><strong>Warum abgeglichen und nicht geleert und neu angelegt.</strong>
	 * Beim Leeren und Neuanlegen bekaeme jede unveraenderte Zeile eine neue ID,
	 * und schwerer wiegt: Hibernate fuehrt in einem Flush die Inserts vor den
	 * Deletes aus. Eine Person, die in der Liste bleibt, waere damit fuer einen
	 * Moment zweimal eingetragen und liefe in
	 * {@code unique(project_id, user_id)}. Der Abgleich vermeidet beides und
	 * aendert bei einer reinen Rollenkorrektur nur ein Feld.
	 *
	 * <p>Die neuen Konten werden vollstaendig aufgeloest, <em>bevor</em> die
	 * Sammlung angefasst wird. Sonst haette eine unbekannte ID am Ende der
	 * Liste die vorherigen Eintraege schon entfernt, und die 400er-Antwort
	 * liesse ein halb geaendertes Projekt zurueck.
	 */
	private void replaceMembers(Project project, Map<UUID, String> wanted) {
		Map<UUID, String> current = currentMembers(project);
		Map<UUID, User> added = new LinkedHashMap<>();
		for (UUID userId : wanted.keySet()) {
			if (!current.containsKey(userId)) {
				added.put(userId, loadMemberAccount(userId));
			}
		}

		project.getMembers().removeIf(member -> member.getUser() == null
				|| !wanted.containsKey(member.getUser().getId()));

		for (ProjectMember member : project.getMembers()) {
			member.setProjectRole(wanted.get(member.getUser().getId()));
		}

		for (Map.Entry<UUID, User> entry : added.entrySet()) {
			ProjectMember member = new ProjectMember();
			member.setProject(project);
			member.setUser(entry.getValue());
			member.setProjectRole(wanted.get(entry.getKey()));
			project.getMembers().add(member);
		}
	}

	/**
	 * Konto eines neuen Mitglieds. Es muss existieren (§3.13: „jeweils
	 * registrierte User"), sonst <strong>400</strong>.
	 *
	 * <p><strong>Der Kontostatus wird bewusst nicht geprueft.</strong> §5
	 * verlangt {@code ACTIVE} fuer <em>Aktionen</em>, hier geht es um eine
	 * Zuordnung. Wuerde der Status verlangt, koennte eine Gruppe ihre eigene
	 * Liste nicht mehr aendern, sobald ein Konto darin deaktiviert wird: schon
	 * das Aufnehmen einer weiteren Person schlaege dann an der unveraenderten
	 * Zeile daneben fehl.
	 */
	private User loadMemberAccount(UUID userId) {
		return userRepository.findById(userId).orElseThrow(() -> new ValidationException(
				ErrorCodes.VALIDATION_FAILED,
				"Unter der in \"members[].userId\" angegebenen ID gibt es kein Konto."));
	}

	// ------------------------------------------------------------------
	// Redaktionszuweisung (§5, Fussnote 3)
	// ------------------------------------------------------------------

	/**
	 * Gleicht die Redaktionszuweisung ab, soweit sie ueber
	 * {@code POST /projects} und {@code PUT /projects/{id}} mitkommt.
	 *
	 * <p>Zustaendig ist wie bei der Mitgliederliste die Projektseite in
	 * {@code DRAFT} und {@code REVISION} (§3.13.1, seit Contract v85). Bis v84
	 * war {@code editorIds} allein der Autor:in vorbehalten; zusammen mit dem
	 * geoeffneten Einreichen ergab das eine Sackgasse, siehe
	 * {@link ProjectPermissionService#mayAssignEditors}.
	 *
	 * <p><strong>Die Pruefung faellt damit heute mit {@link #requireEditable}
	 * und {@code mayEditMetadata} zusammen</strong> und wirft fuer eine Person
	 * ohne Rolle ADMIN praktisch nicht mehr. Sie bleibt trotzdem stehen: §3.13.1
	 * ist eine eigene Contract-Zeile, und faellt sie spaeter wieder enger aus
	 * als die Metadatenzeile, ist genau diese eine Stelle zu aendern. Dieselbe
	 * Ueberlegung wie bei {@code mayEditBlocks} neben {@code mayEditMetadata}.
	 *
	 * <p>Wie bei den Mitgliedern greift die Pruefung nur bei einer echten
	 * Aenderung, damit ein durchgereichtes {@code GET}-Ergebnis kein 403 ergibt.
	 */
	private void applyEditors(AuthenticatedUser user, Project project, Set<UUID> requested) {
		if (requested == null) {
			return;
		}
		if (currentEditorIds(project).equals(requested)) {
			return;
		}
		if (!permissions.mayAssignEditors(user, project)) {
			// Genannt wird der Grund, der hier tatsaechlich greift: die
			// Zugehoerigkeit, nicht der Status. Wer zur Projektseite gehoert und
			// in einem gesperrten Status schreibt, ist schon an requireEditable
			// mit 409 gescheitert und kommt gar nicht bis hierher.
			throw new AccessDeniedException(
					"Die Redaktionszuweisung aendert nur die Projektseite, also Autor:in "
							+ "und Projektmitglieder (§3.13.1). Ab der Einreichung fuehrt der "
							+ "Weg ueber PUT /api/projects/{id}/editors.");
		}
		requireNotSelfAssigned(user, requested);
		replaceEditors(project, requested);
	}

	/**
	 * Niemand traegt sich selbst als Redaktion ein (§5, Fussnote ³):
	 * <strong>400</strong> {@code VALIDATION_FAILED} am Feld {@code editorIds}.
	 *
	 * <p><strong>Warum ein eigener Satz, obwohl
	 * {@link #requireProjectSideSeparateFromEditors} denselben Fall abdeckt.</strong>
	 * Die Selbstzuweisung ist der haeufigste Fehlgriff am Metadatenformular und
	 * verdient die klare Auskunft. Die allgemeine Meldung sagt nur, dass sich
	 * Projektseite und Redaktion ausschliessen, und laesst die Person raten, wen
	 * genau der Server meint. Fachlich bleibt es ein Sonderfall der Trennung und
	 * keine zweite Regel.
	 *
	 * <p><strong>Warum im eingebetteten Weg und nicht in
	 * {@link #loadEditorAccount}.</strong> Die Aussage betrifft die
	 * <em>anfragende</em> Person, nicht das zugewiesene Konto. Auf
	 * {@code PUT /projects/{id}/editors} verteilt die Administration fremde
	 * Zustaendigkeiten, dort greift allein die Zustandspruefung.
	 *
	 * <p><strong>Deren Begruendung hat sich mit KAN-82 verschoben, ihr Ergebnis
	 * nicht.</strong> Bis v82 lautete sie: ein Admin-Konto gehoert nicht zur
	 * Projektseite, seine Zuweisung ist nach §5 Fussnote ¹¹ ohnehin wirkungslos.
	 * Der erste Halbsatz stimmt nicht mehr, seit ein Admin eigene Projekte
	 * anlegen darf: an seinem eigenen Projekt ist er sehr wohl die Projektseite.
	 * Die Trennung greift dort trotzdem, und zwar ohne Zutun, weil
	 * {@link #requireProjectSideSeparateFromEditors} die Ueberschneidung von
	 * Projektseite und Redaktion prueft und nicht die Rolle. Ein Admin, der sich
	 * dem eigenen Projekt als Redaktion zuweist, bekommt deshalb 400
	 * {@code VALIDATION_FAILED} wie jede andere Person auch.
	 *
	 * <p><strong>Die Meldung beginnt mit dem Feldnamen und einem Doppelpunkt</strong>,
	 * wie {@code semesterId: …} weiter oben. Das ist keine Kosmetik: das Formular
	 * schneidet am ersten {@code ": "} und haengt den Rest an genau dieses Feld
	 * ({@code applyValidationErrors}). Ohne das Praefix landet der Satz als
	 * anonyme Meldung am Formularfuss, und §5 Fussnote ³ verlangt sie
	 * ausdruecklich <em>am Feld</em> {@code editorIds}. Im Resttext steht deshalb
	 * kein weiteres {@code ": "} und kein {@code "; "}.
	 */
	private void requireNotSelfAssigned(AuthenticatedUser user, Set<UUID> requested) {
		if (requested.contains(user.getId())) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"editorIds: Sich selbst kann niemand als Redaktion eintragen, denn ueber "
							+ "eine Arbeit entscheidet die Redaktion und nicht, wer sie "
							+ "verfasst hat (§5, Fussnote 3).");
		}
	}

	// ------------------------------------------------------------------
	// Trennung von Projektseite und Redaktion (§5, Fussnote 3 seit v61)
	// ------------------------------------------------------------------

	/**
	 * Der Stand eines Projekts, soweit die Trennung von Projektseite und
	 * Redaktion ihn braucht: die zugewiesene Redaktion und die Personen, die
	 * zugleich auf beiden Seiten stehen.
	 *
	 * @param editorIds zugewiesene Redaktion zu diesem Zeitpunkt
	 * @param overlap   Schnittmenge aus Projektseite und Redaktion
	 */
	private record Separation(Set<UUID> editorIds, Set<UUID> overlap) {
	}

	/**
	 * Die „Projektseite" kommt aus dem {@link ProjectPermissionService} und wird
	 * hier nicht ein zweites Mal definiert: wer zum Projekt gehoert, ist eine
	 * Frage der Ressourcenebene und steht nach CLAUDE.md an genau einer Stelle.
	 */
	private Separation separationOf(Project project) {
		Set<UUID> editorIds = currentEditorIds(project);
		Set<UUID> overlap = new LinkedHashSet<>(permissions.projectSideIds(project));
		overlap.retainAll(editorIds);
		return new Separation(editorIds, overlap);
	}

	/**
	 * Zugewiesene Redaktion und Projektseite schliessen einander aus (§5,
	 * Fussnote ³ seit Contract v61, KAN-77). Was der Schreibvorgang an
	 * Ueberschneidung neu erzeugt, ergibt <strong>400</strong>
	 * {@code VALIDATION_FAILED}.
	 *
	 * <p><strong>Warum am Zustand und nicht am Schreibweg.</strong>
	 * {@link #applyMembers} laeuft vor {@link #applyEditors}. Eine Pruefung im
	 * Mitgliederpfad saehe die neuen Editoren noch nicht, eine im Editorenpfad
	 * die neuen Mitglieder schon; beides liesse genau eine Reihenfolge offen und
	 * waere im gemeinsamen {@code PUT} wirkungslos, wo {@code members} und
	 * {@code editorIds} zusammen eintreffen. Der gemeinsame Schritt nach beiden
	 * Zuweisungen ist reihenfolgeunabhaengig und beantwortet die Frage genau
	 * einmal, fuer alle drei Schreibwege der Zuweisung.
	 *
	 * <p><strong>Warum nur neu Entstandenes.</strong> Ab {@code SUBMITTED} ist
	 * die Redaktionszuweisung fuer die Projektseite gesperrt (§5, Fussnote ³). Eine
	 * harte Pruefung wuerde ein Projekt mit bestehender Ueberschneidung
	 * unspeicherbar machen, ohne dass es ausser dem Admin jemand aufloesen
	 * koennte: dieselbe Sackgasse, die {@code mayAssignEditors} an anderer Stelle
	 * beseitigt. Verglichen wird deshalb gegen den Stand vor der Aenderung, und
	 * Bestandsdaten werden nicht rueckwirkend beanstandet, wie beim Pflichtfeld
	 * aus §3.3 auch.
	 *
	 * <p><strong>Welches Feld die Meldung nennt.</strong> Stand die Person schon
	 * vorher in der Redaktion, entsteht die Ueberschneidung ueber
	 * {@code members}, sonst ueber {@code editorIds}. Treffen beide Aenderungen
	 * zusammen ein, faellt die Person in den zweiten Fall und die Meldung nennt
	 * {@code editorIds}: das ist das Feld, das die Zustaendigkeit vergibt.
	 * Entstehen in einem Request mehrere Ueberschneidungen auf verschiedenen
	 * Wegen, nennt sie ebenfalls {@code editorIds}, statt vom Zufall der
	 * Mengenreihenfolge abzuhaengen.
	 *
	 * <p><strong>Die Meldung beginnt mit dem Feldnamen</strong>, aus demselben
	 * Grund wie bei {@link #requireNotSelfAssigned}: nur so haengt sie im
	 * Formular am betroffenen Feld und nicht am Formularfuss.
	 *
	 * <p><strong>Der Wurf sitzt nach beiden Zuweisungen</strong>, also nach
	 * Mutationen am verwalteten Projekt. Anders als {@link #replaceMembers} und
	 * {@link #replaceEditors}, die bewusst erst aufloesen und dann aendern, kann
	 * diese Pruefung ihr Ergebnis konstruktionsbedingt nicht vorher kennen: sie
	 * beurteilt genau den Zustand, den beide Schritte zusammen erzeugen. Dass
	 * kein halb geaendertes Projekt zurueckbleibt, traegt hier deshalb das
	 * Rollback der Transaktion: {@link ValidationException} ist eine
	 * {@code RuntimeException}, und bis hierher hat nichts geflusht.
	 */
	private void requireProjectSideSeparateFromEditors(Project project, Separation before) {
		Set<UUID> added = new LinkedHashSet<>(separationOf(project).overlap());
		added.removeAll(before.overlap());
		if (added.isEmpty()) {
			return;
		}
		boolean onlyThroughMembers = before.editorIds().containsAll(added);
		String field = onlyThroughMembers ? "members" : "editorIds";
		throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
				field + ": Zugewiesene Redaktion und Projektseite schliessen einander aus, "
						+ "die angegebene Person gehoert bereits zur anderen Seite desselben "
						+ "Projekts (§5, Fussnote 3).");
	}

	/**
	 * Schreibt die neue Redaktionszuweisung. Abgeglichen statt geleert und neu
	 * gefuellt, aus demselben Grund wie bei {@link #replaceMembers}: die
	 * Join-Tabelle {@code project_editor} hat ihren Primaerschluessel auf beiden
	 * Spalten. Ebenso wird erst aufgeloest und dann geaendert, damit eine
	 * unbekannte ID kein halb geaendertes Projekt hinterlaesst.
	 */
	private void replaceEditors(Project project, Set<UUID> requested) {
		Set<UUID> present = currentEditorIds(project);
		List<User> added = new ArrayList<>();
		for (UUID id : requested) {
			if (!present.contains(id)) {
				added.add(loadEditorAccount(id));
			}
		}

		project.getEditors().removeIf(editor -> !requested.contains(editor.getId()));
		project.getEditors().addAll(added);
	}

	private Set<UUID> currentEditorIds(Project project) {
		return project.getEditors().stream()
				.map(User::getId)
				.collect(Collectors.toCollection(HashSet::new));
	}

	/**
	 * Konto einer zugewiesenen Redakteur:in.
	 *
	 * <p><strong>Die Rolle wird geprueft</strong>, anders als beim Mitglied. Das
	 * Feld heisst in §3.3 „Zugewiesene Redakteur:innen" und speist „Meine
	 * Reviews"; die Auswahlliste dazu ist {@code GET /users/lookup?role=EDITOR}
	 * (§6.1). Eine Studierende dort einzutragen ergaebe eine Review-Liste, in
	 * der sie nichts tun kann, und wuerde ihr ueber
	 * {@code ProjectPermissionService.isAssignedEditor} zugleich die Interna des
	 * Projekts oeffnen (§5, Fussnote ⁷). ADMIN ist mit aufgenommen, weil §4.1
	 * die Administration bei jeder redaktionellen Entscheidung neben der
	 * Redaktion fuehrt; eine unbekannte oder unpassende ID ergibt
	 * <strong>400</strong>.
	 */
	private User loadEditorAccount(UUID userId) {
		User user = userRepository.findById(userId).orElseThrow(() -> new ValidationException(
				ErrorCodes.VALIDATION_FAILED,
				"Unter der in \"editorIds\" angegebenen ID gibt es kein Konto."));

		if (user.getRole() != Role.EDITOR && user.getRole() != Role.ADMIN) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"Als Redakteur:in kann nur ein Konto mit der Rolle EDITOR oder ADMIN "
							+ "zugewiesen werden (§3.3).");
		}
		return user;
	}

	// ------------------------------------------------------------------
	// Gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	private Project load(UUID projectId) {
		return projectRepository.findWithReferencesById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));
	}

	/**
	 * Die angemeldete Person als Entity. {@link AuthenticatedUser} traegt nur
	 * die Felder fuer Autorisierungsentscheidungen; fuer einen Fremdschluessel
	 * braucht es die Zeile.
	 */
	private User loadCurrentUser(AuthenticatedUser user) {
		return userRepository.findById(user.getId()).orElseThrow(() -> new AccessDeniedException(
				"Das angemeldete Konto existiert nicht mehr."));
	}

	/** Erster Eintrag der Statushistorie: nichts nach {@code DRAFT} (§3.12, §4.1). */
	private void recordCreation(Project project, User author) {
		ProjectStatusHistory entry = new ProjectStatusHistory();
		entry.setProject(project);
		entry.setFromStatus(null);
		entry.setToStatus(ProjectStatus.DRAFT);
		entry.setChangedBy(author);
		entry.setTimestamp(Instant.now());
		statusHistoryRepository.saveAndFlush(entry);
	}

	/** Wie im {@link ProjectReadService}: ein leeres Feld ist ein fehlendes Feld. */
	private static String emptyAsNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
