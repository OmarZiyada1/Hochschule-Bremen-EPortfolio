package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Das Stammdaten-CRUD des Admin-Bereichs aus §6.1 gegen die echte Datenbank
 * (KAN-25).
 *
 * <p>Zwei Zusagen stehen im Mittelpunkt. Erstens die Loeschsperre: eine noch
 * referenzierte Zeile ergibt 409 {@code RESOURCE_IN_USE} und bleibt stehen, und
 * zwar sowohl bei Verweisen aus Projekten als auch bei Stammdaten-Zeilen
 * darunter. Zweitens die Abgrenzung der Statuscodes: ein bereits vergebener
 * eindeutiger Wert ergibt 409, eine unbekannte ID im <em>Body</em> dagegen 400
 * und nur eine unbekannte ID im <em>Pfad</em> ergibt 404 (§6.3.1).
 *
 * <p>Alle Zeilen dieses Tests tragen einen je Lauf gewuerfelten Namensteil.
 * Ohne das kollidierte der Unique-Index auf {@code category.name} und
 * {@code faculty.abbreviation} mit den Seed-Daten und mit frueheren Laeufen.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MasterDataAdminIntegrationTest {

	private static final String CATEGORIES = "/api/admin/categories";

	private static final String FACULTIES = "/api/admin/faculties";

	private static final String STUDY_PROGRAMS = "/api/admin/study-programs";

	private static final String MODULES = "/api/admin/modules";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	@Autowired
	private ModuleRepository moduleRepository;

	/** Je Lauf eindeutig, damit die Unique-Indizes nicht mit Altbestand kollidieren. */
	private String marker;

	private User admin;

	private User editor;

	@BeforeEach
	void buildData() {
		marker = UUID.randomUUID().toString().substring(0, 8);

		admin = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.ADMIN, "nicht-relevant"));
		editor = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.EDITOR, "nicht-relevant"));
	}

	// ==================================================================
	// Kategorien
	// ==================================================================

	@Nested
	@DisplayName("Kategorien (§3.6)")
	class Categories {

		@Test
		@DisplayName("POST legt an und ergibt 201, PATCH aendert den Namen")
		void createAndUpdate() throws Exception {
			UUID id = createdId(CATEGORIES, Map.of("name", "Kategorie " + marker));

			mockMvc.perform(as(admin, patch(CATEGORIES + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Umbenannt " + marker)))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.name").value("Umbenannt " + marker));

			assertThat(categoryRepository.findById(id).orElseThrow().getName())
					.isEqualTo("Umbenannt " + marker);
		}

		@Test
		@DisplayName("Ein bereits vergebener Name ergibt 409 RESOURCE_IN_USE")
		void duplicateNameIsConflict() throws Exception {
			createdId(CATEGORIES, Map.of("name", "Doppelt " + marker));

			mockMvc.perform(as(admin, post(CATEGORIES)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Doppelt " + marker)))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));
		}

		@Test
		@DisplayName("Ein PATCH auf den eigenen, unveraenderten Namen ist kein Konflikt")
		void keepingOwnNameIsNoConflict() throws Exception {
			UUID id = createdId(CATEGORIES, Map.of("name", "Bleibt " + marker));

			mockMvc.perform(as(admin, patch(CATEGORIES + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Bleibt " + marker)))))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("DELETE mit anhaengenden Projekten ergibt 409 und loescht nichts (§6.1)")
		void deleteIsBlockedByProjects() throws Exception {
			UUID id = createdId(CATEGORIES, Map.of("name", "Belegt " + marker));
			Category category = categoryRepository.findById(id).orElseThrow();

			Project project = TestProject.withoutId(admin, ProjectStatus.DRAFT, "Mit Kategorie");
			project.setCategory(category);
			projectRepository.saveAndFlush(project);

			mockMvc.perform(as(admin, delete(CATEGORIES + "/" + id)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(categoryRepository.findById(id)).isPresent();
		}

		@Test
		@DisplayName("DELETE ohne Referenzen ergibt 204 und entfernt die Zeile")
		void deleteRemovesUnreferencedRow() throws Exception {
			UUID id = createdId(CATEGORIES, Map.of("name", "Frei " + marker));

			mockMvc.perform(as(admin, delete(CATEGORIES + "/" + id)))
					.andExpect(status().isNoContent());

			assertThat(categoryRepository.findById(id)).isEmpty();
		}

		@Test
		@DisplayName("Unbekannte ID im Pfad ergibt 404 (§6.3.1)")
		void unknownIdIsNotFound() throws Exception {
			mockMvc.perform(as(admin, delete(CATEGORIES + "/" + UUID.randomUUID())))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ohne Token 401, mit EDITOR-Token 403, und es entsteht nichts (§5)")
		void requiresAdmin() throws Exception {
			long before = categoryRepository.count();

			mockMvc.perform(post(CATEGORIES)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Heimlich " + marker))))
					.andExpect(status().isUnauthorized());

			mockMvc.perform(as(editor, post(CATEGORIES)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Heimlich " + marker)))))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(categoryRepository.count()).isEqualTo(before);
		}
	}

	// ==================================================================
	// Fakultaeten
	// ==================================================================

	@Nested
	@DisplayName("Fakultaeten (§3.8)")
	class Faculties {

		@Test
		@DisplayName("POST legt an; ein doppeltes Kuerzel ergibt 409, ein doppelter Name nicht")
		void abbreviationIsUniqueButNameIsNot() throws Exception {
			createdId(FACULTIES, Map.of("name", "Fakultaet " + marker, "abbreviation", "FX" + marker));

			mockMvc.perform(as(admin, post(FACULTIES)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Andere " + marker,
									"abbreviation", "FX" + marker)))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			// Der Name traegt in der Tabelle keinen Unique-Index.
			mockMvc.perform(as(admin, post(FACULTIES)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Fakultaet " + marker,
									"abbreviation", "FY" + marker)))))
					.andExpect(status().isCreated());
		}

		@Test
		@DisplayName("DELETE mit anhaengendem Studiengang ergibt 409 (§6.1)")
		void deleteIsBlockedByStudyPrograms() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Mit Studiengang " + marker, "abbreviation", "FZ" + marker));
			createdId(STUDY_PROGRAMS,
					Map.of("name", "Studiengang " + marker, "facultyId", facultyId.toString()));

			mockMvc.perform(as(admin, delete(FACULTIES + "/" + facultyId)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(facultyRepository.findById(facultyId)).isPresent();
		}

		@Test
		@DisplayName("PATCH aendert nur die uebermittelten Felder")
		void patchIsPartial() throws Exception {
			UUID id = createdId(FACULTIES,
					Map.of("name", "Teilweise " + marker, "abbreviation", "FT" + marker));

			mockMvc.perform(as(admin, patch(FACULTIES + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Neu benannt " + marker)))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.name").value("Neu benannt " + marker))
					.andExpect(jsonPath("$.abbreviation").value("FT" + marker));
		}
	}

	// ==================================================================
	// Studiengaenge und Module
	// ==================================================================

	@Nested
	@DisplayName("Studiengaenge und Module (§3.7, §3.9)")
	class ProgramsAndModules {

		@Test
		@DisplayName("Eine unbekannte facultyId im Body ergibt 400 und nicht 404")
		void unknownReferenceInBodyIsBadRequest() throws Exception {
			mockMvc.perform(as(admin, post(STUDY_PROGRAMS)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Ins Leere " + marker,
									"facultyId", UUID.randomUUID().toString())))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Eine leere abbreviation loescht die Kurzform, ein fehlendes Feld nicht")
		void emptyAbbreviationClearsIt() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Traeger " + marker, "abbreviation", "FA" + marker));

			Map<String, Object> body = new HashMap<>();
			body.put("name", "Mit Kurzform " + marker);
			body.put("abbreviation", "MK");
			body.put("facultyId", facultyId.toString());
			UUID id = createdId(STUDY_PROGRAMS, body);

			// Feld weggelassen: die Kurzform bleibt stehen.
			mockMvc.perform(as(admin, patch(STUDY_PROGRAMS + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Umbenannt " + marker)))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.abbreviation").value("MK"));

			// Leere Zeichenkette: die Kurzform wird geleert.
			mockMvc.perform(as(admin, patch(STUDY_PROGRAMS + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("abbreviation", "")))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.abbreviation").doesNotExist());

			assertThat(studyProgramRepository.findById(id).orElseThrow().getAbbreviation()).isNull();
		}

		@Test
		@DisplayName("DELETE eines Studiengangs mit anhaengendem Modul ergibt 409")
		void deleteIsBlockedByModules() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FM" + marker));
			UUID programId = createdId(STUDY_PROGRAMS,
					Map.of("name", "Mit Modul " + marker, "facultyId", facultyId.toString()));
			UUID moduleId = createdId(MODULES,
					Map.of("name", "Modul " + marker, "studyProgramId", programId.toString()));

			mockMvc.perform(as(admin, delete(STUDY_PROGRAMS + "/" + programId)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			// Erst ohne das Modul geht es, und dann ohne Umweg.
			mockMvc.perform(as(admin, delete(MODULES + "/" + moduleId)))
					.andExpect(status().isNoContent());
			mockMvc.perform(as(admin, delete(STUDY_PROGRAMS + "/" + programId)))
					.andExpect(status().isNoContent());

			assertThat(moduleRepository.findById(moduleId)).isEmpty();
			assertThat(studyProgramRepository.findById(programId)).isEmpty();
		}

		@Test
		@DisplayName("DELETE eines Moduls mit anhaengendem Projekt ergibt 409")
		void moduleDeleteIsBlockedByProjects() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FP" + marker));
			UUID programId = createdId(STUDY_PROGRAMS,
					Map.of("name", "Studiengang " + marker, "facultyId", facultyId.toString()));
			UUID moduleId = createdId(MODULES,
					Map.of("name", "Belegtes Modul " + marker, "studyProgramId", programId.toString()));

			Project project = TestProject.withoutId(admin, ProjectStatus.DRAFT, "Mit Modul");
			project.setModule(moduleRepository.findById(moduleId).orElseThrow());
			projectRepository.saveAndFlush(project);

			mockMvc.perform(as(admin, delete(MODULES + "/" + moduleId)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(moduleRepository.findById(moduleId)).isPresent();
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	/** Legt eine Zeile an, erwartet 201 und liefert ihre ID. */
	private UUID createdId(String path, Map<String, Object> body) throws Exception {
		String response = mockMvc.perform(as(admin, post(path)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body))))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString();

		return UUID.fromString(objectMapper.readTree(response).get("id").asText());
	}

	private String json(Map<String, Object> body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
