package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
 * <p>Seit KAN-46 gehoert das Zusammenfuehren zweier Kategorien dazu
 * ({@code POST /admin/categories/{id}/merge}), der Gegenpol zur Loeschsperre:
 * es ist der einzige Weg, eine doppelt angelegte Kategorie loszuwerden, an der
 * noch Projekte haengen.
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
		@DisplayName("merge haengt alle Projekte um und loescht die Quelle (§6.1, KAN-46)")
		void mergeMovesProjectsAndRemovesSource() throws Exception {
			UUID sourceId = createdId(CATEGORIES, Map.of("name", "Quelle " + marker));
			UUID targetId = createdId(CATEGORIES, Map.of("name", "Ziel " + marker));

			Project first = TestProject.withoutId(admin, ProjectStatus.DRAFT, "Erstes");
			first.setCategory(categoryRepository.findById(sourceId).orElseThrow());
			first = projectRepository.saveAndFlush(first);

			// Auch ein veroeffentlichtes Projekt geht mit: §4.1 sperrt die
			// Inhaltsbearbeitung, nicht das Aufraeumen der Stammdaten.
			Project published = TestProject.withoutId(admin, ProjectStatus.PUBLISHED, "Zweites");
			published.setCategory(categoryRepository.findById(sourceId).orElseThrow());
			published = projectRepository.saveAndFlush(published);

			mockMvc.perform(as(admin, post(CATEGORIES + "/" + sourceId + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("targetCategoryId", targetId.toString())))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.id").value(targetId.toString()))
					.andExpect(jsonPath("$.name").value("Ziel " + marker));

			assertThat(categoryRepository.findById(sourceId)).isEmpty();
			assertThat(projectRepository.existsByCategoryId(sourceId)).isFalse();
			assertThat(projectRepository.findById(first.getId()).orElseThrow()
					.getCategory().getId()).isEqualTo(targetId);
			assertThat(projectRepository.findById(published.getId()).orElseThrow()
					.getCategory().getId()).isEqualTo(targetId);
		}

		@Test
		@DisplayName("merge ohne anhaengende Projekte loescht die Quelle ebenfalls")
		void mergeWorksWithoutProjects() throws Exception {
			UUID sourceId = createdId(CATEGORIES, Map.of("name", "Leer " + marker));
			UUID targetId = createdId(CATEGORIES, Map.of("name", "Sammelt " + marker));

			mockMvc.perform(as(admin, post(CATEGORIES + "/" + sourceId + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("targetCategoryId", targetId.toString())))))
					.andExpect(status().isOk());

			assertThat(categoryRepository.findById(sourceId)).isEmpty();
			assertThat(categoryRepository.findById(targetId)).isPresent();
		}

		@Test
		@DisplayName("merge auf sich selbst ergibt 400 und loescht nichts (§6.1)")
		void mergeIntoItselfIsRejected() throws Exception {
			UUID id = createdId(CATEGORIES, Map.of("name", "Selbst " + marker));

			mockMvc.perform(as(admin, post(CATEGORIES + "/" + id + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("targetCategoryId", id.toString())))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(categoryRepository.findById(id)).isPresent();
		}

		@Test
		@DisplayName("Unbekannte targetCategoryId ergibt 400, unbekannte ID im Pfad 404 (§6.3.1)")
		void mergeDistinguishesBodyAndPath() throws Exception {
			UUID sourceId = createdId(CATEGORIES, Map.of("name", "Bleibt stehen " + marker));

			mockMvc.perform(as(admin, post(CATEGORIES + "/" + sourceId + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("targetCategoryId", UUID.randomUUID().toString())))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			mockMvc.perform(as(admin, post(CATEGORIES + "/" + UUID.randomUUID() + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("targetCategoryId", sourceId.toString())))))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

			assertThat(categoryRepository.findById(sourceId)).isPresent();
		}

		@Test
		@DisplayName("merge ohne Admin-Rolle: 401 ohne Token, 403 mit EDITOR, nichts geloescht (§5)")
		void mergeRequiresAdmin() throws Exception {
			UUID sourceId = createdId(CATEGORIES, Map.of("name", "Geschuetzt " + marker));
			UUID targetId = createdId(CATEGORIES, Map.of("name", "Geschuetzt Ziel " + marker));
			String body = json(Map.of("targetCategoryId", targetId.toString()));

			mockMvc.perform(post(CATEGORIES + "/" + sourceId + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(body))
					.andExpect(status().isUnauthorized());

			mockMvc.perform(as(editor, post(CATEGORIES + "/" + sourceId + "/merge")
							.contentType(MediaType.APPLICATION_JSON)
							.content(body)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(categoryRepository.findById(sourceId)).isPresent();
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
			createdId(STUDY_PROGRAMS, Map.of("name", "Studiengang " + marker,
					"abbreviation", "SZ", "facultyId", facultyId.toString()));

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
									"abbreviation", "IL",
									"facultyId", UUID.randomUUID().toString())))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ohne abbreviation ergibt POST 400 (§3.7, Contract v81)")
		void abbreviationIsRequiredOnCreate() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Ohne Kurzform " + marker, "abbreviation", "FB" + marker));

			mockMvc.perform(as(admin, post(STUDY_PROGRAMS)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Kurzformlos " + marker,
									"facultyId", facultyId.toString())))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ein fehlendes Feld laesst die Kurzform stehen, eine leere ergibt 400")
		void emptyAbbreviationIsRejected() throws Exception {
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

			// Leere Zeichenkette: seit Contract v81 kein Leeren mehr, sondern 400.
			mockMvc.perform(as(admin, patch(STUDY_PROGRAMS + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("abbreviation", "")))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(studyProgramRepository.findById(id).orElseThrow().getAbbreviation())
					.isEqualTo("MK");
		}

		@Test
		@DisplayName("DELETE eines Studiengangs mit anhaengendem Modul ergibt 409")
		void deleteIsBlockedByModules() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FM" + marker));
			UUID programId = createdId(STUDY_PROGRAMS, Map.of("name", "Mit Modul " + marker,
					"abbreviation", "MM", "facultyId", facultyId.toString()));
			UUID moduleId = createdId(MODULES, Map.of("name", "Modul " + marker,
					"abbreviation", "MOD", "studyProgramId", programId.toString()));

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
		@DisplayName("Ein neuer Studiengang bekommt sein Sammelmodul mit (§3.9, v84)")
		void createBringsCollectiveModule() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FC" + marker));
			UUID programId = createdId(STUDY_PROGRAMS, Map.of("name", "Bionik " + marker,
					"abbreviation", "BNX", "facultyId", facultyId.toString()));

			/*
			 * Es entsteht als Nebenwirkung und nicht von Hand: ein Studiengang
			 * ohne Auffangzeile liesse genau das Loch zurueck, das der Punkt
			 * schliessen soll, und gemerkt haette es niemand.
			 */
			Module collective = moduleRepository
					.findByStudyProgramIdAndCollectiveTrue(programId)
					.orElseThrow();
			assertThat(collective.getName())
					.isEqualTo("Module aus dem Studiengang Bionik " + marker);
			assertThat(collective.getAbbreviation()).isEqualTo("BNX-ALLG");

			// Und die oeffentliche Modulliste weist es aus, damit die Oberflaeche
			// es ans Listenende stellen kann.
			mockMvc.perform(get("/api/modules")
							.param("studyProgram", programId.toString()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].collective").value(true));
		}

		@Test
		@DisplayName("Das Sammelmodul allein sperrt das Loeschen nicht und faellt mit "
				+ "dem Studiengang (§3.9, v84)")
		void collectiveModuleDoesNotBlockDeletion() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FD" + marker));
			UUID programId = createdId(STUDY_PROGRAMS, Map.of("name", "Kurzlebig " + marker,
					"abbreviation", "KLX", "facultyId", facultyId.toString()));
			UUID collectiveId = moduleRepository
					.findByStudyProgramIdAndCollectiveTrue(programId)
					.orElseThrow()
					.getId();

			/*
			 * Ohne diese Ausnahme waere vom Tag der Einfuehrung an kein
			 * Studiengang mehr loeschbar, weil jeder ein Modul traegt.
			 */
			mockMvc.perform(as(admin, delete(STUDY_PROGRAMS + "/" + programId)))
					.andExpect(status().isNoContent());

			assertThat(moduleRepository.findById(collectiveId)).isEmpty();
			assertThat(studyProgramRepository.findById(programId)).isEmpty();
		}

		@Test
		@DisplayName("Das Sammelmodul laesst sich nicht einzeln loeschen (409)")
		void collectiveModuleCannotBeDeletedAlone() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FE" + marker));
			UUID programId = createdId(STUDY_PROGRAMS, Map.of("name", "Bestaendig " + marker,
					"abbreviation", "BSX", "facultyId", facultyId.toString()));
			UUID collectiveId = moduleRepository
					.findByStudyProgramIdAndCollectiveTrue(programId)
					.orElseThrow()
					.getId();

			mockMvc.perform(as(admin, delete(MODULES + "/" + collectiveId)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(moduleRepository.findById(collectiveId)).isPresent();
		}

		@Test
		@DisplayName("Das Sammelmodul laesst sich umbenennen, aber nicht umhaengen (400)")
		void collectiveModuleStaysWithItsProgram() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FF" + marker));
			UUID programId = createdId(STUDY_PROGRAMS, Map.of("name", "Erster " + marker,
					"abbreviation", "ER1", "facultyId", facultyId.toString()));
			UUID otherProgramId = createdId(STUDY_PROGRAMS, Map.of("name", "Zweiter " + marker,
					"abbreviation", "ZW1", "facultyId", facultyId.toString()));
			UUID collectiveId = moduleRepository
					.findByStudyProgramIdAndCollectiveTrue(programId)
					.orElseThrow()
					.getId();

			// Der Name ist freier Text und bleibt aenderbar.
			mockMvc.perform(as(admin, patch(MODULES + "/" + collectiveId)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("name", "Sonstige Module " + marker)))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.collective").value(true));

			/*
			 * Und ebenso, wenn der eigene Studiengang mitgeschickt wird: genau das
			 * tut die Administrationsseite, sie sendet beim Aendern eines Moduls
			 * immer alle drei Felder. Eine Sperre auf das blosse Vorhandensein des
			 * Feldes liess jedes Umbenennen mit 400 scheitern, obwohl §3.9 es
			 * erlaubt (Befund des code-reviewers).
			 */
			mockMvc.perform(as(admin, patch(MODULES + "/" + collectiveId)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of(
									"name", "Auffangmodul " + marker,
									"studyProgramId", programId.toString())))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.name").value("Auffangmodul " + marker))
					.andExpect(jsonPath("$.collective").value(true));

			/*
			 * Umhaengen dagegen liesse den einen Studiengang ohne Auffangzeile
			 * zurueck und braechte dem anderen eine zweite; der partielle Index
			 * uq_module_collective wuerde das mit einem Datenbankfehler
			 * beantworten statt mit einer Meldung.
			 */
			mockMvc.perform(as(admin, patch(MODULES + "/" + collectiveId)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("studyProgramId", otherProgramId.toString())))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(moduleRepository.findById(collectiveId).orElseThrow()
					.getStudyProgram().getId()).isEqualTo(programId);
		}

		@Test
		@DisplayName("DELETE eines Moduls mit anhaengendem Projekt ergibt 409")
		void moduleDeleteIsBlockedByProjects() throws Exception {
			UUID facultyId = createdId(FACULTIES,
					Map.of("name", "Fakultaet " + marker, "abbreviation", "FP" + marker));
			UUID programId = createdId(STUDY_PROGRAMS, Map.of("name", "Studiengang " + marker,
					"abbreviation", "SGP", "facultyId", facultyId.toString()));
			UUID moduleId = createdId(MODULES, Map.of("name", "Belegtes Modul " + marker,
					"abbreviation", "BMO", "studyProgramId", programId.toString()));

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
