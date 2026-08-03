package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.JwtAuthenticationFilter;
import de.hsbremen.eportfolio.auth.JwtProperties;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.auth.RestAccessDeniedHandler;
import de.hsbremen.eportfolio.auth.RestAuthenticationEntryPoint;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.error.ApiErrorWriter;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.config.CorsProperties;
import de.hsbremen.eportfolio.config.SecurityConfig;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.project.dto.ProjectFilterRequest;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Tests der HTTP-Schicht der Projekt-Endpoints ueber die volle Filterkette:
 * Erreichbarkeit ohne Token (§5), Bindung der elf Filterparameter und der
 * Paginierung (§1) sowie das Fehlerformat aus §6.2 fuer 400, 401, 403 und 404.
 *
 * <p>Bewusst ein {@code @WebMvcTest} ohne Datenbank. Was der Dienst aus den
 * Parametern macht, also Sichtbarkeit, Filterwirkung und Fehlerpolitik gegen
 * echte Daten, prueft {@link ProjectReadIntegrationTest}. Hier geht es
 * ausschliesslich darum, dass die Werte richtig ankommen und die Ausnahmen im
 * richtigen Envelope wieder herauskommen.
 */
@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = ProjectController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, RestAuthenticationEntryPoint.class,
		RestAccessDeniedHandler.class, ApiErrorWriter.class, GlobalExceptionHandler.class,
		ProjectControllerTest.TestConfig.class})
class ProjectControllerTest {

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
	private ProjectReadService projectReadService;

	/**
	 * Der Controller bedient seit KAN-17 auch die schreibenden Endpoints und
	 * braucht den Dienst deshalb im Kontext. Befragt wird er hier nicht: was
	 * die Schreibpfade tun, prueft {@link ProjectWriteIntegrationTest} gegen
	 * die echte Datenbank, weil daran Statusregeln, Versionsstand und
	 * Cascade haengen, die ohne Persistenz keine Aussage haetten.
	 */
	@MockitoBean
	private ProjectWriteService projectWriteService;

	/** Wird vom {@link JwtAuthenticationFilter} gebraucht, hier aber nie befragt. */
	@MockitoBean
	private UserRepository userRepository;

	// --- Erreichbarkeit ohne Token (PUBLIC, §5) ----------------------------

	@Test
	@DisplayName("GET /api/projects: 200 ohne Token, Antwort im Seitenformat aus §6.6")
	void listWithoutToken() throws Exception {
		when(projectReadService.list(isNull(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projects"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content").isArray())
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(20))
				.andExpect(jsonPath("$.totalElements").value(0))
				.andExpect(jsonPath("$.totalPages").value(0));
	}

	@Test
	@DisplayName("Ohne Token kommt null als Benutzer beim Dienst an, das ist der PUBLIC-Fall")
	void withoutTokenUserIsNull() throws Exception {
		when(projectReadService.list(any(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projects")).andExpect(status().isOk());

		verify(projectReadService).list(isNull(), any(ProjectFilterRequest.class), any(Pageable.class));
	}

	@Test
	@DisplayName("GET /api/projects/{id}: 200 ohne Token")
	void detailWithoutToken() throws Exception {
		UUID id = UUID.randomUUID();
		when(projectReadService.detail(isNull(), eq(id))).thenReturn(null);

		mockMvc.perform(get("/api/projects/" + id)).andExpect(status().isOk());

		verify(projectReadService).detail(isNull(), eq(id));
	}

	// --- Bindung der Filterparameter (§6.1) --------------------------------

	@Test
	@DisplayName("Alle elf Filter kommen unveraendert beim Dienst an")
	void allFiltersArePassedThrough() throws Exception {
		UUID category = UUID.randomUUID();
		UUID faculty = UUID.randomUUID();
		UUID studyProgram = UUID.randomUUID();
		UUID module = UUID.randomUUID();
		UUID author = UUID.randomUUID();
		when(projectReadService.list(any(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projects")
						.param("category", category.toString())
						.param("faculty", faculty.toString())
						.param("studyProgram", studyProgram.toString())
						.param("module", module.toString())
						.param("degree", "MASTER")
						.param("type", "THESIS")
						.param("semester", "WS 2025/26")
						.param("q", "Portfolio")
						.param("status", "PUBLISHED")
						.param("author", author.toString())
						.param("editor", "me"))
				.andExpect(status().isOk());

		ProjectFilterRequest filter = capturedFilter();
		assertThat(filter.category()).isEqualTo(category);
		assertThat(filter.faculty()).isEqualTo(faculty);
		assertThat(filter.studyProgram()).isEqualTo(studyProgram);
		assertThat(filter.module()).isEqualTo(module);
		assertThat(filter.degree()).isEqualTo(Degree.MASTER);
		assertThat(filter.type()).isEqualTo(ProjectType.THESIS);
		assertThat(filter.semester()).isEqualTo("WS 2025/26");
		assertThat(filter.q()).isEqualTo("Portfolio");
		assertThat(filter.status()).isEqualTo(ProjectStatus.PUBLISHED);
		assertThat(filter.author()).isEqualTo(author);
		assertThat(filter.editor()).isEqualTo("me");
	}

	@Test
	@DisplayName("Ohne Filterparameter ist jedes Feld null, nicht etwa ein Default")
	void withoutFiltersEverythingIsNull() throws Exception {
		when(projectReadService.list(any(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projects")).andExpect(status().isOk());

		ProjectFilterRequest filter = capturedFilter();
		assertThat(filter.category()).isNull();
		assertThat(filter.degree()).isNull();
		assertThat(filter.q()).isNull();
		assertThat(filter.editor()).isNull();
	}

	// --- Paginierung und Sortierung (§1) -----------------------------------

	@Test
	@DisplayName("Ohne page und size gelten 0 und 20, sortiert nach updatedAt absteigend")
	void defaultPagination() throws Exception {
		when(projectReadService.list(any(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projects")).andExpect(status().isOk());

		Pageable pageable = capturedPageable();
		assertThat(pageable.getPageNumber()).isZero();
		assertThat(pageable.getPageSize()).isEqualTo(20);
		assertThat(pageable.getSort().getOrderFor("updatedAt"))
				.isNotNull()
				.extracting(Sort.Order::getDirection)
				.isEqualTo(Sort.Direction.DESC);
	}

	@Test
	@DisplayName("?page, ?size und ?sort=<feld>,<richtung> werden gebunden")
	void overridePagination() throws Exception {
		when(projectReadService.list(any(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(), 2, 5, 0, 0));

		mockMvc.perform(get("/api/projects")
						.param("page", "2")
						.param("size", "5")
						.param("sort", "title,asc"))
				.andExpect(status().isOk());

		Pageable pageable = capturedPageable();
		assertThat(pageable.getPageNumber()).isEqualTo(2);
		assertThat(pageable.getPageSize()).isEqualTo(5);
		assertThat(pageable.getSort().getOrderFor("title"))
				.isNotNull()
				.extracting(Sort.Order::getDirection)
				.isEqualTo(Sort.Direction.ASC);
	}

	// --- Fehlerformat (§6.2, §6.3.1) ---------------------------------------

	@Test
	@DisplayName("Ungueltige UUID im Filter: 400 im Envelope, ohne den eingeschickten Wert")
	void filterIsNotAUuid() throws Exception {
		mockMvc.perform(get("/api/projects").param("category", "keine-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED))
				.andExpect(jsonPath("$.timestamp").exists())
				.andExpect(jsonPath("$.path").value("/api/projects"))
				.andExpect(jsonPath("$.message", not(containsString("keine-uuid"))));
	}

	@Test
	@DisplayName("Unbekannter Enum-Wert: 400 im Envelope")
	void filterWithUnknownEnum() throws Exception {
		mockMvc.perform(get("/api/projects").param("degree", "DIPLOM"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED))
				.andExpect(jsonPath("$.message", not(containsString("DIPLOM"))));
	}

	@Test
	@DisplayName("Ungueltige Projekt-ID im Pfad: 400 im Envelope")
	void detailIdIsNotAUuid() throws Exception {
		mockMvc.perform(get("/api/projects/keine-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED));
	}

	@Test
	@DisplayName("Unerlaubtes Sortierfeld: 400 im Envelope")
	void forbiddenSortField() throws Exception {
		when(projectReadService.list(any(), any(), any()))
				.thenThrow(new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Nach diesem Feld kann nicht sortiert werden."));

		mockMvc.perform(get("/api/projects").param("sort", "author.passwordHash,asc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED));
	}

	@Test
	@DisplayName("Unbekannte Projekt-ID: 404 PROJECT_NOT_FOUND im Envelope (§6.3.1)")
	void detailNotFound() throws Exception {
		UUID id = UUID.randomUUID();
		when(projectReadService.detail(any(), eq(id)))
				.thenThrow(ResourceNotFoundException.forProject(id));

		mockMvc.perform(get("/api/projects/" + id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.PROJECT_NOT_FOUND))
				.andExpect(jsonPath("$.path").value("/api/projects/" + id));
	}

	@Test
	@DisplayName("Vorhandenes Projekt ohne Anmeldung: 401 NOT_AUTHENTICATED (§6.3.1)")
	void detailWithoutLogin() throws Exception {
		UUID id = UUID.randomUUID();
		when(projectReadService.detail(any(), eq(id)))
				.thenThrow(new AuthenticationCredentialsNotFoundException("Anmeldung erforderlich."));

		mockMvc.perform(get("/api/projects/" + id))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NOT_AUTHENTICATED));
	}

	@Test
	@DisplayName("Vorhandenes Projekt ohne Leserecht: 403 NO_PERMISSION (§6.3.1)")
	void detailWithoutReadPermission() throws Exception {
		UUID id = UUID.randomUUID();
		when(projectReadService.detail(any(), eq(id)))
				.thenThrow(new AccessDeniedException("Keine Leseberechtigung."));

		mockMvc.perform(get("/api/projects/" + id))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NO_PERMISSION));
	}

	@Test
	@DisplayName("\"editor=me\" ohne Anmeldung: 401 im Envelope")
	void editorMeWithoutLogin() throws Exception {
		when(projectReadService.list(any(), any(), any()))
				.thenThrow(new AuthenticationCredentialsNotFoundException(
						"Der Filter \"editor=me\" setzt eine Anmeldung voraus."));

		mockMvc.perform(get("/api/projects").param("editor", "me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NOT_AUTHENTICATED));
	}

	@Test
	@DisplayName("Unbrauchbares Token: 401 TOKEN_INVALID aus dem Filter, nicht 200 als PUBLIC")
	void brokenToken() throws Exception {
		mockMvc.perform(get("/api/projects").header("Authorization", "Bearer kaputt"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value(ErrorCodes.TOKEN_INVALID));
	}

	// --- Antwortinhalt -----------------------------------------------------

	@Test
	@DisplayName("Die Kachel liefert genau die Felder aus §6.1")
	void cardFields() throws Exception {
		UUID id = UUID.randomUUID();
		ProjectCardResponse card = new ProjectCardResponse(
				id, "Titel", "Teaser", "/api/files/1", ProjectStatus.PUBLISHED,
				ProjectType.THESIS, Degree.BACHELOR, "WS 2025/26",
				null, null, null, null, List.of("react", "ux"), 3, null);
		when(projectReadService.list(any(), any(), any()))
				.thenReturn(new PageResponse<>(List.of(card), 0, 20, 1, 1));

		mockMvc.perform(get("/api/projects"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].id").value(id.toString()))
				.andExpect(jsonPath("$.content[0].title").value("Titel"))
				.andExpect(jsonPath("$.content[0].status").value("PUBLISHED"))
				.andExpect(jsonPath("$.content[0].projectType").value("THESIS"))
				.andExpect(jsonPath("$.content[0].degree").value("BACHELOR"))
				.andExpect(jsonPath("$.content[0].semester").value("WS 2025/26"))
				.andExpect(jsonPath("$.content[0].tags[0]").value("react"))
				.andExpect(jsonPath("$.content[0].reactionCount").value(3));
	}

	// --- Hilfsmittel -------------------------------------------------------

	private ProjectFilterRequest capturedFilter() {
		ArgumentCaptor<ProjectFilterRequest> captor = ArgumentCaptor.forClass(ProjectFilterRequest.class);
		verify(projectReadService).list(any(), captor.capture(), any());
		return captor.getValue();
	}

	private Pageable capturedPageable() {
		ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
		verify(projectReadService).list(any(), any(), captor.capture());
		return captor.getValue();
	}
}
