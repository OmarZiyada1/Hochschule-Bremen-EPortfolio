package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die vier Endpoints aus §6.1 gegen die echte Datenbank: Erreichbarkeit ohne
 * Token, Sortierung, Filter und die Mehrfachausfuehrbarkeit des
 * {@link DevMasterDataSeeder}.
 *
 * <p>{@code @Transactional} sorgt dafuer, dass alles, was dieser Test anlegt,
 * hinterher zurueckgerollt wird: die Entwicklungsdatenbank bleibt so, wie sie
 * war. Die Endpoints laufen im selben Thread und damit in derselben
 * Transaktion; sie sehen die Testdaten deshalb auch ohne Commit.
 *
 * <p><strong>Der Test bringt seine Hierarchie selbst mit.</strong> Frueher
 * prueften Sortierung und Filter gegen die Fakultaeten, Studiengaenge und
 * Module des {@link DevMasterDataSeeder}, also gegen Namen wie
 * &bdquo;Informatik&ldquo; oder &bdquo;Medieninformatik&ldquo;. Diese Hierarchie
 * fuehrt der Seeder nicht mehr; sie kommt aus dem Skript
 * {@code stammdaten-seeder.sh}, das den echten Bestand der Hochschule schreibt
 * und ausserhalb des ausgelieferten Programms steht. Ein Test, der gegen dessen
 * Inhalt zusichert, haenge an einer Datenlieferung, die sich mit jeder
 * Aktualisierung der Hochschulseiten aendern darf. Die eigenen Zeilen tragen
 * Kuerzel mit dem Praefix {@code FKT}, das keiner echten Fakultaet gehoert:
 * {@code faculty.abbreviation} ist unique.
 *
 * <p>Kategorien und Semester kommen weiterhin aus dem Seeder. Er wird in
 * {@link #buildData()} selbst aufgerufen, statt sich darauf zu verlassen, dass
 * Spring den {@code ApplicationRunner} beim Hochfahren des Testkontexts
 * ausgefuehrt hat. Weil er idempotent ist, kostet das nichts und macht den Test
 * unabhaengig davon.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MasterDataIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private DevMasterDataSeeder seeder;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private SemesterRepository semesterRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	@Autowired
	private ModuleRepository moduleRepository;

	/** Traegt die Studiengaenge, gegen die Sortierung und Filter pruefen. */
	private Faculty faculty;

	/** Zweite Fakultaet, damit der Filter etwas auszuschliessen hat. */
	private Faculty otherFaculty;

	private StudyProgram alpha;

	private StudyProgram bravo;

	/**
	 * Legt die eigene Hierarchie an, absichtlich in falscher Reihenfolge: eine
	 * Zusicherung auf Sortierung traegt nur, wenn die Einfuegereihenfolge nicht
	 * schon die erwartete ist.
	 */
	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());

		otherFaculty = facultyRepository.saveAndFlush(
				TestMasterData.facultyWithoutId("FKT2", "Testfakultaet Zeta"));
		faculty = facultyRepository.saveAndFlush(
				TestMasterData.facultyWithoutId("FKT1", "Testfakultaet Alpha"));

		bravo = studyProgramRepository.saveAndFlush(
				TestMasterData.studyProgramWithoutId("TSTB", "Testgang Bravo", faculty));
		alpha = studyProgramRepository.saveAndFlush(
				TestMasterData.studyProgramWithoutId("TSTA", "Testgang Alpha", faculty));
		studyProgramRepository.saveAndFlush(
				TestMasterData.studyProgramWithoutId("TSTZ", "Testgang Zeta", otherFaculty));

		moduleRepository.saveAndFlush(
				TestMasterData.moduleWithoutId("TSTA-Z", "Zeta Modul", alpha));
		moduleRepository.saveAndFlush(
				TestMasterData.moduleWithoutId("TSTA-A", "Alpha Modul", alpha));
		// Das Sammelmodul entsteht im Betrieb als Nebenwirkung des Anlegens
		// (§3.9). Der Test geht am Dienst vorbei und legt es ueber dieselbe
		// Fabrik an, damit der Name nicht ein zweites Mal gebildet wird.
		moduleRepository.saveAndFlush(Module.collectiveFor(alpha));

		moduleRepository.saveAndFlush(
				TestMasterData.moduleWithoutId("TSTB-OE", "Ökologie im Test", bravo));
	}

	// --- Seeder ------------------------------------------------------------

	@Test
	@DisplayName("Zweiter Seeder-Lauf legt nichts doppelt an")
	void seederIsIdempotent() {
		long categories = categoryRepository.count();
		long semesters = semesterRepository.count();
		long faculties = facultyRepository.count();
		long studyPrograms = studyProgramRepository.count();
		long modules = moduleRepository.count();

		// Nach dem Lauf in buildData() ist das bereits der zweite,
		// bei laufendem ApplicationRunner der dritte.
		seeder.run(new DefaultApplicationArguments());

		assertThat(categoryRepository.count()).isEqualTo(categories);
		assertThat(semesterRepository.count()).isEqualTo(semesters);
		// Die drei folgenden zaehlt der Seeder gar nicht mehr hoch; die
		// Zusicherung bleibt stehen, weil genau das ihre Aussage ist.
		assertThat(facultyRepository.count()).isEqualTo(faculties);
		assertThat(studyProgramRepository.count()).isEqualTo(studyPrograms);
		assertThat(moduleRepository.count()).isEqualTo(modules);
	}

	@Test
	@DisplayName("Seeder legt Kategorien und Semester an, aber keine Hierarchie")
	void seederCreatesCategoriesAndSemestersOnly() {
		long faculties = facultyRepository.count();
		long studyPrograms = studyProgramRepository.count();
		long modules = moduleRepository.count();

		seeder.run(new DefaultApplicationArguments());

		assertThat(categoryRepository.findAllByOrderByNameAsc())
				.as("die Filterleiste braucht Kategorien")
				.isNotEmpty();
		assertThat(semesterRepository.findAllByOrderBySortOrderAsc())
				.as("das Metadatenformular braucht Semester")
				.isNotEmpty();
		assertThat(facultyRepository.count())
				.as("Fakultaeten kommen aus dem Seeder-Skript, nicht aus dem Seeder")
				.isEqualTo(faculties);
		assertThat(studyProgramRepository.count()).isEqualTo(studyPrograms);
		assertThat(moduleRepository.count()).isEqualTo(modules);
	}

	// --- Erreichbarkeit ohne Token -----------------------------------------

	@Test
	@DisplayName("Alle vier Endpoints antworten ohne Token mit 200 und Daten")
	void allFourEndpointsWithoutToken() throws Exception {
		assertThat(fetch(get("/api/categories"), CategoryResponse.class)).isNotEmpty();
		assertThat(fetch(get("/api/faculties"), FacultyResponse.class)).isNotEmpty();
		assertThat(fetch(get("/api/study-programs"), StudyProgramResponse.class)).isNotEmpty();
		assertThat(fetch(get("/api/modules"), ModuleResponse.class)).isNotEmpty();
	}

	// --- Sortierung --------------------------------------------------------

	@Test
	@DisplayName("Fakultaeten kommen nach name sortiert")
	void facultiesAreSorted() throws Exception {
		List<FacultyResponse> response = fetch(get("/api/faculties"), FacultyResponse.class);

		// Nur die eigenen Zeilen betrachten: in einer benutzten
		// Entwicklungsdatenbank stehen daneben die echten Fakultaeten.
		List<String> own = List.of("Testfakultaet Alpha", "Testfakultaet Zeta");
		assertThat(response.stream().map(FacultyResponse::name).filter(own::contains).toList())
				.containsExactlyElementsOf(own);
	}

	@Test
	@DisplayName("Module eines Studiengangs kommen nach name sortiert, samt Sammelmodul")
	void modulesAreSorted() throws Exception {
		List<ModuleResponse> response = fetch(
				get("/api/modules").param("studyProgram", alpha.getId().toString()),
				ModuleResponse.class);

		/*
		 * Das Sammelmodul steht seit Contract v84 in jeder Modulliste (§3.9) und
		 * sortiert sich als gewoehnliche Zeile nach Name ein. Ans Listenende
		 * stellt es die Oberflaeche, dafuer traegt die Antwort das Merkmal
		 * collective; der Server sortiert es bewusst nicht um, sonst haette die
		 * Zusage &bdquo;nach name sortiert&ldquo; eine stille Ausnahme.
		 */
		assertThat(response).extracting(ModuleResponse::name)
				.containsExactly("Alpha Modul",
						"Module aus dem Studiengang Testgang Alpha",
						"Zeta Modul");

		assertThat(response).filteredOn(ModuleResponse::collective)
				.extracting(ModuleResponse::name)
				.containsExactly("Module aus dem Studiengang Testgang Alpha");
	}

	// --- Filter ------------------------------------------------------------

	@Test
	@DisplayName("?faculty liefert nur die Studiengaenge dieser Fakultaet")
	void studyProgramsFiltered() throws Exception {
		List<StudyProgramResponse> response = fetch(
				get("/api/study-programs").param("faculty", faculty.getId().toString()),
				StudyProgramResponse.class);

		assertThat(response).extracting(StudyProgramResponse::facultyId)
				.containsOnly(faculty.getId());
		assertThat(response).extracting(StudyProgramResponse::name)
				.containsExactly("Testgang Alpha", "Testgang Bravo");

		// Gegenprobe: ohne Filter ist auch die zweite Fakultaet dabei.
		assertThat(fetch(get("/api/study-programs"), StudyProgramResponse.class))
				.extracting(StudyProgramResponse::facultyId)
				.contains(otherFaculty.getId());
	}

	@Test
	@DisplayName("?studyProgram liefert nur die Module dieses Studiengangs")
	void modulesFiltered() throws Exception {
		List<ModuleResponse> response = fetch(
				get("/api/modules").param("studyProgram", bravo.getId().toString()),
				ModuleResponse.class);

		assertThat(response).isNotEmpty();
		assertThat(response).extracting(ModuleResponse::studyProgramId)
				.containsOnly(bravo.getId());
		assertThat(response).extracting(ModuleResponse::name).contains("Ökologie im Test");
	}

	@Test
	@DisplayName("Unbekannte Filter-ID: 200 mit leerer Liste, kein 404")
	void unknownFilterId() throws Exception {
		assertThat(fetch(get("/api/study-programs").param("faculty", UUID.randomUUID().toString()),
				StudyProgramResponse.class)).isEmpty();
		assertThat(fetch(get("/api/modules").param("studyProgram", UUID.randomUUID().toString()),
				ModuleResponse.class)).isEmpty();
	}

	// --- Zeichensatz -------------------------------------------------------

	@Test
	@DisplayName("Umlaute ueberstehen den Weg Java-Quelltext, Datenbank, JSON")
	void umlautsSurvive() throws Exception {
		List<ModuleResponse> response = fetch(
				get("/api/modules").param("studyProgram", bravo.getId().toString()),
				ModuleResponse.class);

		assertThat(response).extracting(ModuleResponse::name).contains("Ökologie im Test");
	}

	// --- Hilfsmittel -------------------------------------------------------

	/**
	 * Fuehrt die Anfrage aus, erwartet 200 und liest den Koerper als Liste.
	 * Bewusst mit ausdruecklichem UTF-8 statt der Standardkodierung der
	 * Antwort: sonst wuerde der Umlauttest die Kodierung mitpruefen, die er
	 * eigentlich pruefen soll.
	 */
	private <T> List<T> fetch(RequestBuilder request, Class<T> type) throws Exception {
		String body = mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);

		return objectMapper.readValue(body,
				objectMapper.getTypeFactory().constructCollectionType(List.class, type));
	}
}
