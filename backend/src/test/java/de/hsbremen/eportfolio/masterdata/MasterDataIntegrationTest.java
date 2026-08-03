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
 * Die vier Endpoints aus §6.1 gegen die echte Datenbank und die echten
 * Seed-Daten: Erreichbarkeit ohne Token, Sortierung, Filter und die
 * Mehrfachausfuehrbarkeit des {@link DevMasterDataSeeder}.
 *
 * <p>{@code @Transactional} sorgt dafuer, dass alles, was dieser Test anlegt,
 * hinterher zurueckgerollt wird: die Entwicklungsdatenbank bleibt so, wie sie
 * war. Die Endpoints laufen im selben Thread und damit in derselben
 * Transaktion; sie sehen die Seed-Daten deshalb auch ohne Commit.
 *
 * <p>Der Seeder wird in {@link #ensureSeed()} selbst aufgerufen, statt sich
 * darauf zu verlassen, dass Spring den {@code ApplicationRunner} beim
 * Hochfahren des Testkontexts ausgefuehrt hat. Weil er idempotent ist, kostet
 * das nichts und macht den Test unabhaengig davon.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MasterDataIntegrationTest {

	/** Die fuenf Fakultaeten des Seeders in der erwarteten Reihenfolge (nach name). */
	private static final List<String> FACULTIES_BY_NAME = List.of(
			"Architektur, Bau und Umwelt",
			"Elektrotechnik und Informatik",
			"Gesellschaftswissenschaften",
			"Natur und Technik",
			"Wirtschaftswissenschaften");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private DevMasterDataSeeder seeder;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	@Autowired
	private ModuleRepository moduleRepository;

	@BeforeEach
	void ensureSeed() {
		seeder.run(new DefaultApplicationArguments());
	}

	// --- Seeder ------------------------------------------------------------

	@Test
	@DisplayName("Zweiter Seeder-Lauf legt nichts doppelt an")
	void seederIsIdempotent() {
		long categories = categoryRepository.count();
		long faculties = facultyRepository.count();
		long studyPrograms = studyProgramRepository.count();
		long modules = moduleRepository.count();

		// Nach dem Lauf in ensureSeed() ist das bereits der zweite,
		// bei laufendem ApplicationRunner der dritte.
		seeder.run(new DefaultApplicationArguments());

		assertThat(categoryRepository.count()).isEqualTo(categories);
		assertThat(facultyRepository.count()).isEqualTo(faculties);
		assertThat(studyProgramRepository.count()).isEqualTo(studyPrograms);
		assertThat(moduleRepository.count()).isEqualTo(modules);
	}

	@Test
	@DisplayName("Seeder legt FK1 bis FK5 genau einmal an")
	void seederCreatesEachFacultyExactlyOnce() {
		seeder.run(new DefaultApplicationArguments());

		assertThat(facultyRepository.findAllByOrderByNameAsc())
				.extracting(Faculty::getAbbreviation)
				.doesNotHaveDuplicates()
				.contains("FK1", "FK2", "FK3", "FK4", "FK5");
	}

	// --- Erreichbarkeit ohne Token -----------------------------------------

	@Test
	@DisplayName("Alle vier Endpoints antworten ohne Token mit 200 und Seed-Daten")
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

		// Nur die Seed-Fakultaeten betrachten: in einer benutzten
		// Entwicklungsdatenbank koennen weitere Zeilen stehen.
		assertThat(response.stream()
				.map(FacultyResponse::name)
				.filter(FACULTIES_BY_NAME::contains)
				.toList())
				.containsExactlyElementsOf(FACULTIES_BY_NAME);
	}

	@Test
	@DisplayName("Module eines Studiengangs kommen nach name sortiert")
	void modulesAreSorted() throws Exception {
		UUID informatik = studyProgramId("FK4", "Informatik");

		List<ModuleResponse> response = fetch(
				get("/api/modules").param("studyProgram", informatik.toString()), ModuleResponse.class);

		assertThat(response).extracting(ModuleResponse::name)
				.containsExactly("Grundlagen der Programmierung", "Softwaretechnik");
	}

	// --- Filter ------------------------------------------------------------

	@Test
	@DisplayName("?faculty liefert nur die Studiengaenge dieser Fakultaet")
	void studyProgramsFiltered() throws Exception {
		UUID fk4 = facultyId("FK4");

		List<StudyProgramResponse> response = fetch(
				get("/api/study-programs").param("faculty", fk4.toString()), StudyProgramResponse.class);

		assertThat(response).isNotEmpty();
		assertThat(response).extracting(StudyProgramResponse::facultyId).containsOnly(fk4);
		assertThat(response).extracting(StudyProgramResponse::name)
				.contains("Elektrotechnik", "Informatik", "Medieninformatik");

		// Gegenprobe: ohne Filter sind auch andere Fakultaeten dabei.
		assertThat(fetch(get("/api/study-programs"), StudyProgramResponse.class))
				.extracting(StudyProgramResponse::facultyId)
				.contains(facultyId("FK1"));
	}

	@Test
	@DisplayName("?studyProgram liefert nur die Module dieses Studiengangs")
	void modulesFiltered() throws Exception {
		UUID medieninformatik = studyProgramId("FK4", "Medieninformatik");

		List<ModuleResponse> response = fetch(
				get("/api/modules").param("studyProgram", medieninformatik.toString()), ModuleResponse.class);

		assertThat(response).isNotEmpty();
		assertThat(response).extracting(ModuleResponse::studyProgramId).containsOnly(medieninformatik);
		assertThat(response).extracting(ModuleResponse::name)
				.contains("Mensch-Maschine-Interaktion", "Webtechnologien");
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
		UUID biologie = studyProgramId("FK5", "Biologie");

		List<ModuleResponse> response = fetch(
				get("/api/modules").param("studyProgram", biologie.toString()), ModuleResponse.class);

		assertThat(response).extracting(ModuleResponse::name).contains("Ökologie");
	}

	// --- Hilfsmittel -------------------------------------------------------

	private UUID facultyId(String abbreviation) {
		return facultyRepository.findByAbbreviation(abbreviation).orElseThrow().getId();
	}

	private UUID studyProgramId(String facultyAbbreviation, String name) {
		return studyProgramRepository.findByFacultyIdAndName(facultyId(facultyAbbreviation), name)
				.orElseThrow()
				.getId();
	}

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
