package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.masterdata.dto.CategoryCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.CategoryMergeRequest;
import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.CategoryUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.FacultyCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.ModuleCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.SemesterCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.SemesterMoveRequest;
import de.hsbremen.eportfolio.masterdata.dto.SemesterResponse;
import de.hsbremen.eportfolio.masterdata.dto.SemesterUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramUpdateRequest;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Das Stammdaten-CRUD der Administrationsseite aus §6.1 (KAN-25): Anlegen,
 * Aendern und Loeschen von Kategorien, Fakultaeten, Studiengaengen und Modulen
 * (§3.6 bis §3.9), dazu seit KAN-46 das Zusammenfuehren zweier Kategorien
 * ({@link #mergeCategory}) und seit KAN-65 die Semester (§3.18) samt ihrer
 * Reihenfolge ({@link #moveSemester}).
 *
 * <p><strong>Getrennt vom {@link MasterDataService}</strong>, der dieselben vier
 * Tabellen liest. Der Lesedienst ist PUBLIC und kennt keine Rechtepruefung, weil
 * die Listen an keiner Ressource mit Eigentuemer haengen; dieser hier ist ADMIN
 * vorbehalten (§5, Zeile „Kategorien / Studiengaenge / Module / Fakultaeten /
 * Semester verwalten"). Beides in einer Klasse hiesse, dass in derselben Datei Methoden
 * mit und ohne Zugangspruefung nebeneinander stuenden, und beim naechsten
 * Zuwachs vergisst jemand die Pruefung.
 *
 * <p><strong>Loeschen mit bestehenden Referenzen ergibt 409</strong>
 * {@code RESOURCE_IN_USE} (§6.1). Eine Kategorie, an der noch Projekte haengen,
 * wird nicht geloescht; andernfalls verloeren diese Projekte ihre Klassifikation
 * ohne Vorwarnung. Fuer Fakultaet und Studiengang zaehlen dabei
 * <strong>beide</strong> Richtungen: die Projekte, die direkt darauf verweisen,
 * und die Stammdaten-Zeilen darunter. Die Fremdschluessel der Kindzeilen sind
 * {@code not null}, ein Loeschen scheiterte sonst an der Datenbank und ergaebe
 * einen 500 statt der Auskunft, was im Weg steht.
 *
 * <p><strong>Ein bereits vergebener eindeutiger Wert ergibt ebenfalls 409</strong>
 * {@code RESOURCE_IN_USE}, also derselbe Code wie bei der schon vergebenen
 * Adresse in der Registrierung (§6.1). §6.3 fuehrt „bereits vergeben"
 * ausdruecklich unter 409, und fuer die aufrufende Person ist es dieselbe
 * Aussage: der Wert ist in Ordnung, nur eben schon in Gebrauch. Entschieden in
 * der Klaerungsrunde zu KAN-25. Betroffen sind {@code category.name} und
 * {@code faculty.abbreviation}, die beiden einzigen Unique-Spalten dieser vier
 * Tabellen.
 *
 * <p><strong>Eine unbekannte ID im Body ergibt dagegen 400.</strong> Ein
 * Studiengang mit unbekannter {@code facultyId} ist keine Aussage ueber einen
 * Zustand, sondern eine unbrauchbare Anfrage; die Abgrenzung steht in
 * {@link ConflictException}. Eine unbekannte ID im <em>Pfad</em> bleibt 404.
 */
@Service
@Transactional
public class MasterDataAdminService {

	private final CategoryRepository categoryRepository;

	private final FacultyRepository facultyRepository;

	private final StudyProgramRepository studyProgramRepository;

	private final ModuleRepository moduleRepository;

	private final SemesterRepository semesterRepository;

	private final ProjectRepository projectRepository;

	private final ProjectPermissionService permissions;

	public MasterDataAdminService(CategoryRepository categoryRepository,
			FacultyRepository facultyRepository,
			StudyProgramRepository studyProgramRepository,
			ModuleRepository moduleRepository,
			SemesterRepository semesterRepository,
			ProjectRepository projectRepository,
			ProjectPermissionService permissions) {
		this.categoryRepository = categoryRepository;
		this.facultyRepository = facultyRepository;
		this.studyProgramRepository = studyProgramRepository;
		this.moduleRepository = moduleRepository;
		this.semesterRepository = semesterRepository;
		this.projectRepository = projectRepository;
		this.permissions = permissions;
	}

	// ==================================================================
	// Kategorien (§3.6)
	// ==================================================================

	/** {@code POST /api/admin/categories}, <strong>201</strong>. */
	public CategoryResponse createCategory(AuthenticatedUser user, CategoryCreateRequest request) {
		requireMasterDataAdministration(user);

		Category category = new Category();
		category.setName(requireFreeCategoryName(request.name(), NEVER_ASSIGNED));

		return CategoryResponse.from(saveCategory(category));
	}

	/** {@code PATCH /api/admin/categories/{id}}. */
	public CategoryResponse updateCategory(AuthenticatedUser user, UUID id,
			CategoryUpdateRequest request) {

		Category category = loadCategory(id);
		requireMasterDataAdministration(user);

		if (request.name() != null) {
			category.setName(requireFreeCategoryName(request.name(), id));
		}

		return CategoryResponse.from(saveCategory(category));
	}

	/** {@code DELETE /api/admin/categories/{id}}, <strong>204</strong>. */
	public void deleteCategory(AuthenticatedUser user, UUID id) {
		Category category = loadCategory(id);
		requireMasterDataAdministration(user);

		if (projectRepository.existsByCategoryId(id)) {
			throw inUse("Diese Kategorie", "Projekte");
		}

		categoryRepository.delete(category);
	}

	/**
	 * {@code POST /api/admin/categories/{id}/merge}, <strong>200</strong>
	 * (§6.1, KAN-46): haengt alle Projekte der Quellkategorie an das Ziel um und
	 * loescht danach die Quelle.
	 *
	 * <p><strong>Der dritte Weg neben Anlegen und Loeschen.</strong> Weil
	 * {@link #deleteCategory} eine noch referenzierte Kategorie mit 409
	 * {@code RESOURCE_IN_USE} stehen laesst, war eine doppelt angelegte Kategorie
	 * bisher dauerhaft nicht aufraeumbar. Erst das Umhaengen macht die Quelle
	 * referenzlos, und deshalb sind beide Schritte hier ein Vorgang und nicht
	 * zwei Aufrufe: zwischen ihnen gaebe es keinen Endpoint, mit dem sich der
	 * erste ueberhaupt ausfuehren liesse.
	 *
	 * <p><strong>Quelle gleich Ziel ergibt 400</strong>
	 * {@code VALIDATION_FAILED} (§6.1). Die Anfrage waere sonst ein Loeschen mit
	 * Umweg: die Projekte behielten ihre Kategorie und die Zeile verschwaende
	 * trotzdem, also genau das, was die Loeschsperre verhindern soll.
	 *
	 * <p><strong>§4.1 steht dem nicht entgegen.</strong> Die Sperre
	 * „Inhaltsbearbeitung nur in {@code DRAFT} und {@code REVISION}" richtet sich
	 * an {@code PUT /projects/{id}} und {@code PUT /projects/{id}/blocks}, also
	 * an die Projektseite. Hier raeumt die Administration Stammdaten auf, und die
	 * Klassifikation eines veroeffentlichten Projekts von der doppelten auf die
	 * verbleibende Kategorie zu ziehen aendert nichts an dem, was die Redaktion
	 * geprueft hat. Waeren veroeffentlichte Projekte ausgenommen, bliebe die
	 * Quelle referenziert und der Endpoint traefe genau die Faelle nicht, fuer die
	 * es ihn gibt.
	 *
	 * <p>Die Antwort ist die <strong>Zielkategorie</strong> und keine Bilanz des
	 * Vorgangs. Die Administrationsseite laedt ihre Liste danach ohnehin neu; was
	 * sie braucht, ist die Zeile, die uebrig bleibt.
	 *
	 * @param id die Quellkategorie aus dem Pfad; sie ist am Ende geloescht
	 */
	public CategoryResponse mergeCategory(AuthenticatedUser user, UUID id,
			CategoryMergeRequest request) {

		Category source = loadCategory(id);
		requireMasterDataAdministration(user);

		Category target = referencedCategory(request.targetCategoryId());
		if (source.getId().equals(target.getId())) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"targetCategoryId: Quelle und Ziel sind dieselbe Kategorie. Zum Loeschen "
							+ "einer leeren Kategorie dient DELETE /api/admin/categories/{id}.");
		}

		List<Project> affected = projectRepository.findByCategoryId(id);
		for (Project project : affected) {
			project.setCategory(target);
		}
		// Erst die Projekte schreiben, dann die Quelle loeschen: umgekehrt
		// scheiterte das DELETE am Fremdschluessel project.category_id.
		projectRepository.saveAll(affected);
		projectRepository.flush();

		categoryRepository.delete(source);
		categoryRepository.flush();

		return CategoryResponse.from(target);
	}

	// ==================================================================
	// Fakultaeten (§3.8)
	// ==================================================================

	/** {@code POST /api/admin/faculties}, <strong>201</strong>. */
	public FacultyResponse createFaculty(AuthenticatedUser user, FacultyCreateRequest request) {
		requireMasterDataAdministration(user);

		Faculty faculty = new Faculty();
		faculty.setName(requireFilled(request.name(), "name"));
		faculty.setAbbreviation(requireFreeAbbreviation(request.abbreviation(), NEVER_ASSIGNED));

		return FacultyResponse.from(saveFaculty(faculty));
	}

	/** {@code PATCH /api/admin/faculties/{id}}. */
	public FacultyResponse updateFaculty(AuthenticatedUser user, UUID id,
			FacultyUpdateRequest request) {

		Faculty faculty = loadFaculty(id);
		requireMasterDataAdministration(user);

		if (request.name() != null) {
			faculty.setName(requireFilled(request.name(), "name"));
		}
		if (request.abbreviation() != null) {
			faculty.setAbbreviation(requireFreeAbbreviation(request.abbreviation(), id));
		}

		return FacultyResponse.from(saveFaculty(faculty));
	}

	/**
	 * {@code DELETE /api/admin/faculties/{id}}, <strong>204</strong>.
	 *
	 * <p>Gesperrt, solange noch ein Studiengang oder ein Projekt darauf verweist.
	 */
	public void deleteFaculty(AuthenticatedUser user, UUID id) {
		Faculty faculty = loadFaculty(id);
		requireMasterDataAdministration(user);

		if (studyProgramRepository.existsByFacultyId(id)) {
			throw inUse("Diese Fakultaet", "Studiengaenge");
		}
		if (projectRepository.existsByFacultyId(id)) {
			throw inUse("Diese Fakultaet", "Projekte");
		}

		facultyRepository.delete(faculty);
	}

	// ==================================================================
	// Studiengaenge (§3.7)
	// ==================================================================

	/** {@code POST /api/admin/study-programs}, <strong>201</strong>. */
	public StudyProgramResponse createStudyProgram(AuthenticatedUser user,
			StudyProgramCreateRequest request) {

		requireMasterDataAdministration(user);

		StudyProgram studyProgram = new StudyProgram();
		studyProgram.setName(requireFilled(request.name(), "name"));
		studyProgram.setAbbreviation(requireFilled(request.abbreviation(), "abbreviation"));
		studyProgram.setFaculty(referencedFaculty(request.facultyId()));

		return StudyProgramResponse.from(studyProgramRepository.save(studyProgram));
	}

	/** {@code PATCH /api/admin/study-programs/{id}}. */
	public StudyProgramResponse updateStudyProgram(AuthenticatedUser user, UUID id,
			StudyProgramUpdateRequest request) {

		StudyProgram studyProgram = loadStudyProgram(id);
		requireMasterDataAdministration(user);

		if (request.name() != null) {
			studyProgram.setName(requireFilled(request.name(), "name"));
		}
		if (request.abbreviation() != null) {
			// Seit Contract v81 ist das Kuerzel Pflicht: die leere Zeichenkette
			// loescht es nicht mehr, sie ist ein 400. Zum Beibehalten bleibt das
			// Feld weg, siehe StudyProgramUpdateRequest.
			studyProgram.setAbbreviation(requireFilled(request.abbreviation(), "abbreviation"));
		}
		if (request.facultyId() != null) {
			studyProgram.setFaculty(referencedFaculty(request.facultyId()));
		}

		return StudyProgramResponse.from(studyProgramRepository.save(studyProgram));
	}

	/**
	 * {@code DELETE /api/admin/study-programs/{id}}, <strong>204</strong>.
	 *
	 * <p>Gesperrt, solange noch ein Modul oder ein Projekt darauf verweist.
	 */
	public void deleteStudyProgram(AuthenticatedUser user, UUID id) {
		StudyProgram studyProgram = loadStudyProgram(id);
		requireMasterDataAdministration(user);

		if (moduleRepository.existsByStudyProgramId(id)) {
			throw inUse("Dieser Studiengang", "Module");
		}
		if (projectRepository.existsByStudyProgramId(id)) {
			throw inUse("Dieser Studiengang", "Projekte");
		}

		studyProgramRepository.delete(studyProgram);
	}

	// ==================================================================
	// Module (§3.9)
	// ==================================================================

	/** {@code POST /api/admin/modules}, <strong>201</strong>. */
	public ModuleResponse createModule(AuthenticatedUser user, ModuleCreateRequest request) {
		requireMasterDataAdministration(user);

		Module module = new Module();
		module.setName(requireFilled(request.name(), "name"));
		module.setAbbreviation(requireFilled(request.abbreviation(), "abbreviation"));
		module.setStudyProgram(referencedStudyProgram(request.studyProgramId()));

		return ModuleResponse.from(moduleRepository.save(module));
	}

	/** {@code PATCH /api/admin/modules/{id}}. */
	public ModuleResponse updateModule(AuthenticatedUser user, UUID id,
			ModuleUpdateRequest request) {

		Module module = loadModule(id);
		requireMasterDataAdministration(user);

		if (request.name() != null) {
			module.setName(requireFilled(request.name(), "name"));
		}
		if (request.abbreviation() != null) {
			// Pflicht seit Contract v81, wie beim Studiengang.
			module.setAbbreviation(requireFilled(request.abbreviation(), "abbreviation"));
		}
		if (request.studyProgramId() != null) {
			module.setStudyProgram(referencedStudyProgram(request.studyProgramId()));
		}

		return ModuleResponse.from(moduleRepository.save(module));
	}

	/** {@code DELETE /api/admin/modules/{id}}, <strong>204</strong>. */
	public void deleteModule(AuthenticatedUser user, UUID id) {
		Module module = loadModule(id);
		requireMasterDataAdministration(user);

		if (projectRepository.existsByModuleId(id)) {
			throw inUse("Dieses Modul", "Projekte");
		}

		moduleRepository.delete(module);
	}

	// ==================================================================
	// Semester (§3.18)
	// ==================================================================

	/**
	 * {@code POST /api/admin/semesters}, <strong>201</strong>.
	 *
	 * <p>Die neue Zeile bekommt den hoechsten {@code sortOrder} und steht damit
	 * am Ende der Liste. Die Position waehlt danach {@link #moveSemester}; sie
	 * steht bewusst nicht im Body (Begruendung in {@link SemesterCreateRequest}).
	 */
	public SemesterResponse createSemester(AuthenticatedUser user, SemesterCreateRequest request) {
		requireMasterDataAdministration(user);

		Semester semester = new Semester();
		semester.setName(requireFreeSemesterName(request.name(), NEVER_ASSIGNED));
		semester.setActive(request.active() == null || request.active());
		semester.setSortOrder(nextSortOrder());

		return SemesterResponse.from(saveSemester(semester));
	}

	/**
	 * {@code PATCH /api/admin/semesters/{id}}.
	 *
	 * <p>Deckt das Deaktivieren mit ab: {@code active} ist ein gewoehnliches
	 * Attribut und kein Zustandsuebergang (§3.18). Ein deaktiviertes Semester
	 * bleibt an den Projekten stehen, die es tragen; geprueft wird der
	 * Auswahlzustand erst beim naechsten Schreiben am Projekt
	 * ({@code ProjectWriteService}).
	 */
	public SemesterResponse updateSemester(AuthenticatedUser user, UUID id,
			SemesterUpdateRequest request) {

		Semester semester = loadSemester(id);
		requireMasterDataAdministration(user);

		if (request.name() != null) {
			semester.setName(requireFreeSemesterName(request.name(), id));
		}
		if (request.active() != null) {
			semester.setActive(request.active());
		}

		return SemesterResponse.from(saveSemester(semester));
	}

	/**
	 * {@code DELETE /api/admin/semesters/{id}}, <strong>204</strong>.
	 *
	 * <p>Gesperrt, solange ein Projekt darauf verweist, wie bei den uebrigen
	 * Stammdaten. Wer ein abgelaufenes Semester aus der Auswahl nehmen will,
	 * setzt {@code active} auf {@code false}; das Loeschen ist fuer die
	 * versehentlich angelegte Zeile da (§3.18).
	 *
	 * <p>Die Luecke, die in der Reihenfolge entsteht, wird nicht geschlossen:
	 * {@code sortOrder} ordnet, es zaehlt nicht. Ein Auffuellen schriebe jede
	 * uebrige Zeile neu, ohne dass sich an der Reihenfolge etwas aendert.
	 */
	public void deleteSemester(AuthenticatedUser user, UUID id) {
		Semester semester = loadSemester(id);
		requireMasterDataAdministration(user);

		if (projectRepository.existsBySemesterId(id)) {
			throw inUse("Dieses Semester", "Projekte");
		}

		semesterRepository.delete(semester);
	}

	/**
	 * {@code POST /api/admin/semesters/{id}/move}, <strong>200</strong> mit der
	 * vollstaendigen neuen Reihenfolge (§6.1).
	 *
	 * <p>Getauscht wird nur mit der unmittelbaren Nachbarzeile. Am oberen
	 * beziehungsweise unteren Rand gibt es keine, dann bleibt die Liste
	 * unveraendert und die Antwort trotzdem <strong>200</strong>: der
	 * gewuenschte Zustand besteht bereits, ein Fehler waere irrefuehrend.
	 *
	 * <p>Die Antwort ist die ganze Liste und nicht die bewegte Zeile allein. Die
	 * Oberflaeche zeichnet die Tabelle danach neu, und zwei Zeilen haben ihre
	 * Position getauscht; mit nur einer davon muesste der Client die zweite
	 * erraten.
	 */
	public List<SemesterResponse> moveSemester(AuthenticatedUser user, UUID id,
			SemesterMoveRequest request) {

		Semester semester = loadSemester(id);
		requireMasterDataAdministration(user);

		Optional<Semester> neighbour =
				request.direction() == SemesterMoveRequest.MoveDirection.UP
						? semesterRepository.findFirstBySortOrderLessThanOrderBySortOrderDesc(
								semester.getSortOrder())
						: semesterRepository.findFirstBySortOrderGreaterThanOrderBySortOrderAsc(
								semester.getSortOrder());

		neighbour.ifPresent(other -> {
			int own = semester.getSortOrder();
			semester.setSortOrder(other.getSortOrder());
			other.setSortOrder(own);
			semesterRepository.saveAll(List.of(semester, other));
			semesterRepository.flush();
		});

		return semesterRepository.findAllByOrderBySortOrderAsc().stream()
				.map(SemesterResponse::from)
				.toList();
	}

	// ==================================================================
	// Pruefungen und gemeinsame Hilfsmittel
	// ==================================================================

	/**
	 * Platzhalter fuer „diese Zeile gibt es noch nicht" in den
	 * Eindeutigkeitspruefungen beim Anlegen.
	 *
	 * <p>Die Pruefungen fragen „ist der Wert an eine <em>andere</em> Zeile
	 * vergeben?" und brauchen dafuer eine ID, die auszuschliessen ist. Beim
	 * Anlegen gibt es noch keine; eine feste, nirgends vergebene UUID schliesst
	 * dann nichts aus und die Frage lautet schlicht „ist der Wert vergeben?". Die
	 * Alternative waeren zwei Repository-Methoden je Spalte, mit und ohne
	 * Ausnahme.
	 */
	private static final UUID NEVER_ASSIGNED =
			UUID.fromString("00000000-0000-0000-0000-000000000000");

	/** Zeile „Kategorien / Studiengaenge / Module / Fakultaeten / Semester verwalten" aus §5: nur ADMIN. */
	private void requireMasterDataAdministration(AuthenticatedUser user) {
		if (!permissions.mayManageMasterData(user)) {
			throw new AccessDeniedException(
					"Stammdaten verwaltet ausschliesslich die Administration (§5).");
		}
	}

	// ------------------------------------------------------------------
	// Laden; eine unbekannte ID im Pfad ergibt 404 RESOURCE_NOT_FOUND, den §6.2
	// als generischen 404er ausdruecklich fuer Stammdaten fuehrt. Geladen wird
	// vor der Rechtepruefung, wie §6.3.1 es festlegt.
	// ------------------------------------------------------------------

	private Category loadCategory(UUID id) {
		return categoryRepository.findById(id)
				.orElseThrow(() -> notFound("Kategorie", id));
	}

	private Faculty loadFaculty(UUID id) {
		return facultyRepository.findById(id)
				.orElseThrow(() -> notFound("Fakultaet", id));
	}

	private StudyProgram loadStudyProgram(UUID id) {
		return studyProgramRepository.findById(id)
				.orElseThrow(() -> notFound("Studiengang", id));
	}

	private Module loadModule(UUID id) {
		return moduleRepository.findById(id)
				.orElseThrow(() -> notFound("Modul", id));
	}

	private Semester loadSemester(UUID id) {
		return semesterRepository.findById(id)
				.orElseThrow(() -> notFound("Semester", id));
	}

	// ------------------------------------------------------------------
	// Bezuege aus dem Body; eine unbekannte ID ergibt hier 400 und nicht 404,
	// siehe Klassenkommentar.
	// ------------------------------------------------------------------

	/**
	 * Die Zielkategorie aus dem Body von {@code /merge} (§6.1, KAN-46). Wie bei
	 * {@link #referencedFaculty} ergibt eine unbekannte ID hier 400 und nicht
	 * 404, weil sie im Body steht und nicht im Pfad.
	 */
	private Category referencedCategory(UUID categoryId) {
		return categoryRepository.findById(categoryId)
				.orElseThrow(() -> new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"targetCategoryId: Unter dieser ID gibt es keine Kategorie."));
	}

	private Faculty referencedFaculty(UUID facultyId) {
		return facultyRepository.findById(facultyId)
				.orElseThrow(() -> new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"facultyId: Unter dieser ID gibt es keine Fakultaet."));
	}

	private StudyProgram referencedStudyProgram(UUID studyProgramId) {
		return studyProgramRepository.findById(studyProgramId)
				.orElseThrow(() -> new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"studyProgramId: Unter dieser ID gibt es keinen Studiengang."));
	}

	// ------------------------------------------------------------------
	// Eindeutigkeit
	// ------------------------------------------------------------------

	/**
	 * Prueft {@code category.name} gegen den Unique-Index der Tabelle.
	 *
	 * @param name    eingeschickter Name
	 * @param ownId   ID der Zeile, die den Wert schon tragen darf (beim Anlegen
	 *                {@link #NEVER_ASSIGNED}). Ohne diese Ausnahme scheiterte ein
	 *                PATCH, der den Namen gar nicht aendert, an sich selbst
	 */
	private String requireFreeCategoryName(String name, UUID ownId) {
		String trimmed = requireFilled(name, "name");
		if (categoryRepository.existsByNameAndIdNot(trimmed, ownId)) {
			throw ConflictException.resourceInUse(
					"name: Eine Kategorie mit diesem Namen gibt es bereits.");
		}
		return trimmed;
	}

	/** Wie {@link #requireFreeCategoryName}, fuer {@code semester.name} (§3.18). */
	private String requireFreeSemesterName(String name, UUID ownId) {
		String trimmed = requireFilled(name, "name");
		if (semesterRepository.existsByNameAndIdNot(trimmed, ownId)) {
			throw ConflictException.resourceInUse(
					"name: Ein Semester mit diesem Namen gibt es bereits.");
		}
		return trimmed;
	}

	/** Wie {@link #requireFreeCategoryName}, fuer {@code faculty.abbreviation}. */
	private String requireFreeAbbreviation(String abbreviation, UUID ownId) {
		String trimmed = requireFilled(abbreviation, "abbreviation");
		if (facultyRepository.existsByAbbreviationAndIdNot(trimmed, ownId)) {
			throw ConflictException.resourceInUse(
					"abbreviation: Eine Fakultaet mit diesem Kuerzel gibt es bereits.");
		}
		return trimmed;
	}

	/**
	 * Speichert und uebersetzt den Constraint-Verstoss in dieselbe 409-Antwort
	 * wie die Vorabpruefung.
	 *
	 * <p>Hierher fuehrt nur der Wettlauf zweier gleichzeitiger Anlagen auf
	 * denselben Namen; dieselbe Ueberlegung wie im {@code RegistrationService}.
	 * Ohne die Uebersetzung waere das ein 500, obwohl der Fall fachlich derselbe
	 * ist.
	 */
	private Category saveCategory(Category category) {
		try {
			return categoryRepository.saveAndFlush(category);
		}
		catch (DataIntegrityViolationException e) {
			throw ConflictException.resourceInUse(
					"name: Eine Kategorie mit diesem Namen gibt es bereits.");
		}
	}

	/** Wie {@link #saveCategory}, fuer die Fakultaet. */
	private Faculty saveFaculty(Faculty faculty) {
		try {
			return facultyRepository.saveAndFlush(faculty);
		}
		catch (DataIntegrityViolationException e) {
			throw ConflictException.resourceInUse(
					"abbreviation: Eine Fakultaet mit diesem Kuerzel gibt es bereits.");
		}
	}

	/** Wie {@link #saveCategory}, fuer das Semester. */
	private Semester saveSemester(Semester semester) {
		try {
			return semesterRepository.saveAndFlush(semester);
		}
		catch (DataIntegrityViolationException e) {
			throw ConflictException.resourceInUse(
					"name: Ein Semester mit diesem Namen gibt es bereits.");
		}
	}

	/**
	 * Die naechste freie Position am Ende der Liste.
	 *
	 * <p>Gezaehlt wird nicht die Zahl der Zeilen, sondern der hoechste vergebene
	 * Wert erhoeht: nach einem Loeschen bleibt eine Luecke in der Folge stehen
	 * (siehe {@link #deleteSemester}), und eine Zaehlung ergaebe dann einen
	 * bereits vergebenen Wert.
	 */
	private int nextSortOrder() {
		return semesterRepository.findFirstByOrderBySortOrderDesc()
				.map(last -> last.getSortOrder() + 1)
				.orElse(1);
	}

	// ------------------------------------------------------------------

	/**
	 * Ein uebermitteltes Pflichtfeld darf nicht leer sein.
	 *
	 * <p>Beim Anlegen faengt das schon {@code @NotBlank} am Record ab; beim PATCH
	 * kann Bean-Validation es nicht, weil dort das Fehlen des Feldes der Regelfall
	 * ist. Die Methode traegt beide Wege, damit derselbe Wortlaut herauskommt.
	 */
	private static String requireFilled(String value, String field) {
		String trimmed = value.trim();
		if (trimmed.isEmpty()) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					field + ": Das Feld darf nicht leer sein. Zum Beibehalten weglassen.");
		}
		return trimmed;
	}

	private static ResourceNotFoundException notFound(String what, UUID id) {
		return new ResourceNotFoundException(ErrorCodes.RESOURCE_NOT_FOUND,
				what + " mit ID " + id + " existiert nicht.");
	}

	/**
	 * 409 {@code RESOURCE_IN_USE} beim Loeschen einer noch referenzierten Zeile
	 * (§6.1).
	 *
	 * <p>Die Meldung nennt, <em>was</em> im Weg steht, weil die Administration
	 * sonst nicht weiss, wo sie aufraeumen muss. Sie nennt keine Zahl und keine
	 * IDs: entschieden wird im Client ohnehin nach {@code errorCode} (§6.2), und
	 * eine Trefferzahl waere eine zweite Abfrage fuer eine Angabe, die niemand
	 * weiterverarbeitet.
	 *
	 * @param subject      die betroffene Zeile samt Artikel, etwa „Diese
	 *                     Kategorie". Der Artikel steht im Aufruf und nicht hier,
	 *                     weil er beim Studiengang und beim Modul anders lautet
	 * @param referencedBy was noch darauf verweist, im Plural
	 */
	private static ConflictException inUse(String subject, String referencedBy) {
		return ConflictException.resourceInUse(
				subject + " laesst sich nicht loeschen, weil noch " + referencedBy
						+ " darauf verweisen. Sonst verloeren sie ihre Zuordnung ohne Vorwarnung.");
	}
}
