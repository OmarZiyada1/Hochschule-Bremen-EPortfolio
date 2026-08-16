package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.SemesterResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Fachliche Tests der vier Lesepfade aus §6.1: Abbildung Entity auf DTO und die
 * Frage, welche Abfrage der Filter ausloest.
 *
 * <p>Die Repositories sind Mocks. Dass die Sortierung tatsaechlich greift, kann
 * hier nicht geprueft werden: sie steckt im Methodennamen der Abfrage und wird
 * von der Datenbank ausgefuehrt; dafuer ist {@link MasterDataIntegrationTest}
 * zustaendig. Geprueft wird hier, dass der Service <em>die sortierende</em>
 * Methode aufruft und die Reihenfolge nicht nachtraeglich umbaut.
 */
class MasterDataServiceTest {

	private CategoryRepository categoryRepository;

	private FacultyRepository facultyRepository;

	private StudyProgramRepository studyProgramRepository;

	private ModuleRepository moduleRepository;

	private SemesterRepository semesterRepository;

	private MasterDataService service;

	@BeforeEach
	void setUp() {
		categoryRepository = mock(CategoryRepository.class);
		facultyRepository = mock(FacultyRepository.class);
		studyProgramRepository = mock(StudyProgramRepository.class);
		moduleRepository = mock(ModuleRepository.class);
		semesterRepository = mock(SemesterRepository.class);
		service = new MasterDataService(categoryRepository, facultyRepository, studyProgramRepository,
				moduleRepository, semesterRepository);
	}

	// --- Kategorien --------------------------------------------------------

	@Test
	@DisplayName("Kategorien kommen als DTO in der Reihenfolge der Abfrage")
	void categories() {
		Category first = TestMasterData.category("Abschlussarbeit");
		Category second = TestMasterData.category("Praxisprojekt");
		when(categoryRepository.findAllByOrderByNameAsc()).thenReturn(List.of(first, second));

		List<CategoryResponse> response = service.categories();

		assertThat(response).containsExactly(
				new CategoryResponse(first.getId(), "Abschlussarbeit"),
				new CategoryResponse(second.getId(), "Praxisprojekt"));
	}

	// --- Fakultaeten -------------------------------------------------------

	@Test
	@DisplayName("Fakultaeten liefern Name und Kuerzel")
	void faculties() {
		Faculty fk4 = TestMasterData.faculty("FK4", "Elektrotechnik und Informatik");
		when(facultyRepository.findAllByOrderByNameAsc()).thenReturn(List.of(fk4));

		assertThat(service.faculties()).containsExactly(
				new FacultyResponse(fk4.getId(), "Elektrotechnik und Informatik", "FK4"));
	}

	// --- Studiengaenge -----------------------------------------------------

	@Test
	@DisplayName("Ohne Filter: alle Studiengaenge, sortierte Abfrage")
	void studyProgramsWithoutFilter() {
		Faculty fk4 = TestMasterData.faculty("FK4", "Elektrotechnik und Informatik");
		StudyProgram informatik = TestMasterData.studyProgram("INF", "Informatik", fk4);
		when(studyProgramRepository.findAllByOrderByNameAsc()).thenReturn(List.of(informatik));

		List<StudyProgramResponse> response = service.studyPrograms(null);

		assertThat(response).containsExactly(
				new StudyProgramResponse(informatik.getId(), "Informatik", "INF", fk4.getId()));
		verify(studyProgramRepository).findAllByOrderByNameAsc();
		verifyNoMoreInteractions(studyProgramRepository);
	}

	@Test
	@DisplayName("Mit Filter: nur die Studiengaenge dieser Fakultaet werden abgefragt")
	void studyProgramsWithFilter() {
		Faculty fk4 = TestMasterData.faculty("FK4", "Elektrotechnik und Informatik");
		StudyProgram informatik = TestMasterData.studyProgram("INF", "Informatik", fk4);
		when(studyProgramRepository.findByFacultyIdOrderByNameAsc(fk4.getId()))
				.thenReturn(List.of(informatik));

		List<StudyProgramResponse> response = service.studyPrograms(fk4.getId());

		assertThat(response).extracting(StudyProgramResponse::facultyId).containsOnly(fk4.getId());
		verify(studyProgramRepository).findByFacultyIdOrderByNameAsc(fk4.getId());
		// Der Filter darf nicht bedeuten „alles laden und danach aussieben".
		verifyNoMoreInteractions(studyProgramRepository);
	}

	@Test
	@DisplayName("Unbekannte Fakultaet: leere Liste statt 404")
	void studyProgramsWithUnknownFaculty() {
		UUID unknown = UUID.randomUUID();
		when(studyProgramRepository.findByFacultyIdOrderByNameAsc(unknown)).thenReturn(List.of());

		assertThat(service.studyPrograms(unknown)).isEmpty();
	}

	// --- Module ------------------------------------------------------------

	@Test
	@DisplayName("Ohne Filter: alle Module, sortierte Abfrage")
	void modulesWithoutFilter() {
		Faculty fk4 = TestMasterData.faculty("FK4", "Elektrotechnik und Informatik");
		StudyProgram informatik = TestMasterData.studyProgram("INF", "Informatik", fk4);
		Module swt = TestMasterData.module("SWT", "Softwaretechnik", informatik);
		when(moduleRepository.findAllByOrderByNameAsc()).thenReturn(List.of(swt));

		assertThat(service.modules(null)).containsExactly(
				new ModuleResponse(swt.getId(), "Softwaretechnik", "SWT", informatik.getId()));
		verify(moduleRepository).findAllByOrderByNameAsc();
		verifyNoMoreInteractions(moduleRepository);
	}

	@Test
	@DisplayName("Mit Filter: nur die Module dieses Studiengangs werden abgefragt")
	void modulesWithFilter() {
		Faculty fk4 = TestMasterData.faculty("FK4", "Elektrotechnik und Informatik");
		StudyProgram informatik = TestMasterData.studyProgram("INF", "Informatik", fk4);
		Module swt = TestMasterData.module("SWT", "Softwaretechnik", informatik);
		when(moduleRepository.findByStudyProgramIdOrderByNameAsc(informatik.getId())).thenReturn(List.of(swt));

		assertThat(service.modules(informatik.getId()))
				.extracting(ModuleResponse::studyProgramId)
				.containsOnly(informatik.getId());
		verify(moduleRepository).findByStudyProgramIdOrderByNameAsc(informatik.getId());
		verifyNoMoreInteractions(moduleRepository);
	}

	@Test
	@DisplayName("Unbekannter Studiengang: leere Liste statt 404")
	void modulesWithUnknownStudyProgram() {
		UUID unknown = UUID.randomUUID();
		when(moduleRepository.findByStudyProgramIdOrderByNameAsc(unknown)).thenReturn(List.of());

		assertThat(service.modules(unknown)).isEmpty();
	}

	// --- Semester (§3.18) --------------------------------------------------

	@Test
	@DisplayName("Ohne Filter kommen alle Semester in der gepflegten Reihenfolge")
	void semestersWithoutFilter() {
		Semester older = TestMasterData.semester("WiSe 2025/26", 1);
		Semester newer = TestMasterData.semester("SoSe 2026", 2);
		when(semesterRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(older, newer));

		assertThat(service.semesters(null))
				.extracting(SemesterResponse::name)
				.containsExactly("WiSe 2025/26", "SoSe 2026");
		verify(semesterRepository).findAllByOrderBySortOrderAsc();
		verifyNoMoreInteractions(semesterRepository);
	}

	@Test
	@DisplayName("Mit active=true fragt der Dienst nur die waehlbaren Semester ab")
	void semestersWithActiveFilter() {
		Semester active = TestMasterData.semester("SoSe 2026", 2);
		when(semesterRepository.findAllByActiveOrderBySortOrderAsc(true)).thenReturn(List.of(active));

		assertThat(service.semesters(true)).singleElement()
				.extracting(SemesterResponse::active)
				.isEqualTo(true);
		verify(semesterRepository).findAllByActiveOrderBySortOrderAsc(true);
		verifyNoMoreInteractions(semesterRepository);
	}

	// --- Nullable Kuerzel --------------------------------------------------

	@Test
	@DisplayName("Fehlendes Kuerzel bleibt null und wird nicht zu einem leeren String")
	void abbreviationMayBeMissing() {
		Faculty fk4 = TestMasterData.faculty("FK4", "Elektrotechnik und Informatik");
		StudyProgram withoutAbbreviation = TestMasterData.studyProgram(null, "Informatik", fk4);
		when(studyProgramRepository.findAllByOrderByNameAsc()).thenReturn(List.of(withoutAbbreviation));

		assertThat(service.studyPrograms(null)).singleElement()
				.extracting(StudyProgramResponse::abbreviation)
				.isNull();
	}
}
