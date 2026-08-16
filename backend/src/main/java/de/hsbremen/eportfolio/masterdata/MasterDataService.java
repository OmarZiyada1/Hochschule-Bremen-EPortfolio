package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.SemesterResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lesezugriff auf die Referenzlisten aus §3.6 bis §3.9 und §3.18.
 *
 * <p>Alle Listen gehen sortiert und ohne Paginierung heraus (§6.1). Das ist kein
 * vergessenes Seitenmodell: es sind kleine, selten veraenderliche Listen, die
 * das Frontend vollstaendig braucht, als Dropdown bei Projektanlage und
 * Registrierung und als Filterleiste der Projektliste. Eine Seitenaufteilung
 * wuerde dort nur einen zweiten Ladeweg erzeugen.
 *
 * <p>Sortiert wird nach {@code name}, beim Semester dagegen nach der gepflegten
 * Reihenfolge {@code sortOrder} (§3.18): alphabetisch stuende dort
 * &bdquo;SoSe 2026&ldquo; vor &bdquo;WiSe 2025/26&ldquo;.
 *
 * <p><strong>Keine Berechtigungspruefung:</strong> die Endpoints sind PUBLIC
 * (§5). Stammdaten haengen an keiner Ressource mit Eigentuemer, es gibt also
 * nichts, was der {@code ProjectPermissionService} hier entscheiden koennte.
 * Sie enthalten auch nichts Schuetzenswertes: Fakultaets- und Modulnamen der
 * Hochschule stehen ohnehin oeffentlich im Netz.
 */
@Service
// Klassenweit, weil jede Methode dieser Klasse ausschliesslich liest. readOnly
// erspart Hibernate den Dirty-Check und macht die Absicht sichtbar.
@Transactional(readOnly = true)
public class MasterDataService {

	private final CategoryRepository categoryRepository;

	private final FacultyRepository facultyRepository;

	private final StudyProgramRepository studyProgramRepository;

	private final ModuleRepository moduleRepository;

	private final SemesterRepository semesterRepository;

	public MasterDataService(CategoryRepository categoryRepository, FacultyRepository facultyRepository,
			StudyProgramRepository studyProgramRepository, ModuleRepository moduleRepository,
			SemesterRepository semesterRepository) {
		this.categoryRepository = categoryRepository;
		this.facultyRepository = facultyRepository;
		this.studyProgramRepository = studyProgramRepository;
		this.moduleRepository = moduleRepository;
		this.semesterRepository = semesterRepository;
	}

	/** Alle Kategorien fuer {@code GET /api/categories}. */
	public List<CategoryResponse> categories() {
		return categoryRepository.findAllByOrderByNameAsc().stream()
				.map(CategoryResponse::from)
				.toList();
	}

	/** Alle Fakultaeten fuer {@code GET /api/faculties}. */
	public List<FacultyResponse> faculties() {
		return facultyRepository.findAllByOrderByNameAsc().stream()
				.map(FacultyResponse::from)
				.toList();
	}

	/**
	 * Studiengaenge fuer {@code GET /api/study-programs}, optional auf eine
	 * Fakultaet eingeschraenkt.
	 *
	 * <p>Eine unbekannte {@code facultyId} ergibt eine leere Liste und kein 404:
	 * der Parameter filtert eine Liste, er adressiert keine Ressource. Ein 404
	 * wuerde ausserdem die Aussage „diese Fakultaet gibt es nicht" treffen, die
	 * dieser Endpoint gar nicht verantwortet.
	 *
	 * @param facultyId Filter; {@code null} liefert alle Studiengaenge
	 */
	public List<StudyProgramResponse> studyPrograms(UUID facultyId) {
		List<StudyProgram> found = facultyId == null
				? studyProgramRepository.findAllByOrderByNameAsc()
				: studyProgramRepository.findByFacultyIdOrderByNameAsc(facultyId);

		return found.stream()
				.map(StudyProgramResponse::from)
				.toList();
	}

	/**
	 * Module fuer {@code GET /api/modules}, optional auf einen Studiengang
	 * eingeschraenkt. Zur unbekannten ID gilt dasselbe wie bei
	 * {@link #studyPrograms(UUID)}.
	 *
	 * @param studyProgramId Filter; {@code null} liefert alle Module
	 */
	public List<ModuleResponse> modules(UUID studyProgramId) {
		List<Module> found = studyProgramId == null
				? moduleRepository.findAllByOrderByNameAsc()
				: moduleRepository.findByStudyProgramIdOrderByNameAsc(studyProgramId);

		return found.stream()
				.map(ModuleResponse::from)
				.toList();
	}

	/**
	 * Semester fuer {@code GET /api/semesters} (§3.18), optional auf den
	 * Auswahlzustand eingeschraenkt.
	 *
	 * <p>Ohne Parameter kommen <strong>alle</strong> Semester, auch die
	 * deaktivierten. Das Metadaten-Formular fragt mit {@code active=true} nach,
	 * weil dort nur Waehlbares stehen darf; die Filtergruppe der
	 * Projektbibliothek dagegen braucht auch die abgelaufenen, sonst
	 * verschwaenden veroeffentlichte Projekte aus der Suche, sobald ihr Semester
	 * vorbei ist.
	 *
	 * @param active Filter; {@code null} liefert alle Semester
	 */
	public List<SemesterResponse> semesters(Boolean active) {
		List<Semester> found = active == null
				? semesterRepository.findAllByOrderBySortOrderAsc()
				: semesterRepository.findAllByActiveOrderBySortOrderAsc(active);

		return found.stream()
				.map(SemesterResponse::from)
				.toList();
	}
}
