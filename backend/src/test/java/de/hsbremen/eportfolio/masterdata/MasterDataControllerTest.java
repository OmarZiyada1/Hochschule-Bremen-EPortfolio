package de.hsbremen.eportfolio.masterdata;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.JwtAuthenticationFilter;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.auth.RestAccessDeniedHandler;
import de.hsbremen.eportfolio.auth.RestAuthenticationEntryPoint;
import de.hsbremen.eportfolio.common.error.ApiErrorWriter;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.config.CorsProperties;
import de.hsbremen.eportfolio.config.JwtProperties;
import de.hsbremen.eportfolio.config.SecurityConfig;
import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Tests der HTTP-Schicht der Stammdaten-Endpoints ueber die volle Filterkette:
 * Erreichbarkeit ohne Token (PUBLIC, §5), Bindung der Filterparameter und das
 * Fehlerformat aus §6.2.
 *
 * <p>Bewusst ein {@code @WebMvcTest} ohne Datenbank: die fachliche Seite deckt
 * {@link MasterDataServiceTest} ab, das Zusammenspiel mit echten Daten
 * {@link MasterDataIntegrationTest}.
 */
@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = MasterDataController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, RestAuthenticationEntryPoint.class,
		RestAccessDeniedHandler.class, ApiErrorWriter.class, GlobalExceptionHandler.class,
		MasterDataControllerTest.TestConfig.class})
class MasterDataControllerTest {

	@TestConfiguration
	static class TestConfig {

		@Bean
		JwtProperties jwtProperties() {
			return new JwtProperties("a".repeat(88), Duration.ofHours(8), "eportfolio");
		}

		@Bean
		JwtService jwtService(JwtProperties properties) {
			return new JwtService(properties);
		}

		@Bean
		CorsProperties corsProperties() {
			return new CorsProperties(null);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MasterDataService masterDataService;

	/** Wird vom {@link JwtAuthenticationFilter} gebraucht, hier aber nie befragt. */
	@MockitoBean
	private UserRepository userRepository;

	// --- Erreichbarkeit ohne Token (PUBLIC, §5) ----------------------------

	@Test
	@DisplayName("GET /api/categories: 200 ohne Token")
	void categoriesWithoutToken() throws Exception {
		UUID id = UUID.randomUUID();
		when(masterDataService.categories()).thenReturn(List.of(new CategoryResponse(id, "Praxisprojekt")));

		mockMvc.perform(get("/api/categories"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$[0].id").value(id.toString()))
				.andExpect(jsonPath("$[0].name").value("Praxisprojekt"));
	}

	@Test
	@DisplayName("GET /api/faculties: 200 ohne Token, mit Kuerzel")
	void facultiesWithoutToken() throws Exception {
		UUID id = UUID.randomUUID();
		when(masterDataService.faculties())
				.thenReturn(List.of(new FacultyResponse(id, "Elektrotechnik und Informatik", "FK4")));

		mockMvc.perform(get("/api/faculties"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].abbreviation").value("FK4"))
				.andExpect(jsonPath("$[0].name").value("Elektrotechnik und Informatik"));
	}

	@Test
	@DisplayName("GET /api/study-programs: 200 ohne Token, mit facultyId")
	void studyProgramsWithoutToken() throws Exception {
		UUID id = UUID.randomUUID();
		UUID facultyId = UUID.randomUUID();
		when(masterDataService.studyPrograms(null))
				.thenReturn(List.of(new StudyProgramResponse(id, "Informatik", "INF", facultyId)));

		mockMvc.perform(get("/api/study-programs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].facultyId").value(facultyId.toString()))
				.andExpect(jsonPath("$[0].abbreviation").value("INF"));
	}

	@Test
	@DisplayName("GET /api/modules: 200 ohne Token, mit studyProgramId")
	void modulesWithoutToken() throws Exception {
		UUID id = UUID.randomUUID();
		UUID studyProgramId = UUID.randomUUID();
		when(masterDataService.modules(null))
				.thenReturn(List.of(new ModuleResponse(id, "Softwaretechnik", "SWT", studyProgramId)));

		mockMvc.perform(get("/api/modules"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].studyProgramId").value(studyProgramId.toString()))
				.andExpect(jsonPath("$[0].name").value("Softwaretechnik"));
	}

	// --- Filterparameter ---------------------------------------------------

	@Test
	@DisplayName("?faculty=<uuid> wird an den Service durchgereicht")
	void studyProgramsWithFilter() throws Exception {
		UUID facultyId = UUID.randomUUID();
		when(masterDataService.studyPrograms(facultyId)).thenReturn(List.of());

		mockMvc.perform(get("/api/study-programs").param("faculty", facultyId.toString()))
				.andExpect(status().isOk());

		verify(masterDataService).studyPrograms(facultyId);
	}

	@Test
	@DisplayName("Ohne ?faculty kommt null beim Service an, nicht etwa ein Default")
	void studyProgramsWithoutFilterParameter() throws Exception {
		when(masterDataService.studyPrograms(null)).thenReturn(List.of());

		mockMvc.perform(get("/api/study-programs")).andExpect(status().isOk());

		verify(masterDataService).studyPrograms(isNull());
	}

	@Test
	@DisplayName("?studyProgram=<uuid> wird an den Service durchgereicht")
	void modulesWithFilter() throws Exception {
		UUID studyProgramId = UUID.randomUUID();
		when(masterDataService.modules(studyProgramId)).thenReturn(List.of());

		mockMvc.perform(get("/api/modules").param("studyProgram", studyProgramId.toString()))
				.andExpect(status().isOk());

		verify(masterDataService).modules(studyProgramId);
	}

	@Test
	@DisplayName("Leere Liste ist 200 mit [], nicht 404")
	void emptyList() throws Exception {
		when(masterDataService.modules(any())).thenReturn(List.of());

		mockMvc.perform(get("/api/modules").param("studyProgram", UUID.randomUUID().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$").isEmpty());
	}

	// --- Fehlerformat ------------------------------------------------------

	@Test
	@DisplayName("Ungueltige UUID im Filter: 400 im Envelope aus §6.2")
	void filterIsNotAUuid() throws Exception {
		mockMvc.perform(get("/api/study-programs").param("faculty", "keine-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.timestamp").exists())
				.andExpect(jsonPath("$.path").value("/api/study-programs"))
				// Der eingeschickte Wert darf nicht in der Antwort auftauchen.
				.andExpect(jsonPath("$.message").value(
						org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("keine-uuid"))));
	}
}
