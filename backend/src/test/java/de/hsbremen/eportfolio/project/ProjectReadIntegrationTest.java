package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.NominationTier;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.masterdata.Category;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.DevMasterDataSeeder;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.Module;
import de.hsbremen.eportfolio.masterdata.ModuleRepository;
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.SemesterRepository;
import de.hsbremen.eportfolio.masterdata.TestMasterData;
import de.hsbremen.eportfolio.masterdata.StudyProgram;
import de.hsbremen.eportfolio.masterdata.StudyProgramRepository;
import de.hsbremen.eportfolio.masterdata.TagRepository;
import de.hsbremen.eportfolio.portfolio.Portfolio;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import de.hsbremen.eportfolio.reaction.ReactionRepository;
import de.hsbremen.eportfolio.reaction.TestReaction;
import de.hsbremen.eportfolio.top10.TestTop10;
import de.hsbremen.eportfolio.top10.Top10NominationRepository;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die beiden Lese-Endpoints aus §6.1 gegen die echte Datenbank: rollenabhaengige
 * Sichtbarkeit (§5), Filter, Paginierung (§6.6) und die Fehlerpolitik aus
 * §6.3.1.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert. Die Endpoints laufen im selben
 * Thread und damit in derselben Transaktion und sehen die Testdaten auch ohne
 * Commit.
 *
 * <p><strong>Zur Isolation:</strong> Eine benutzte Entwicklungsdatenbank kann
 * bereits Projekte enthalten. Jeder Lauf vergibt deshalb ein eigenes
 * {@code semester} und filtert jede Listenabfrage darauf. Ohne diesen Kniff
 * haetten Aussagen wie „PUBLIC sieht genau ein Projekt" keinen Bestand, sobald
 * jemand lokal ein Projekt anlegt.
 *
 * <p>Die Anmeldung laeuft ueber echte Tokens aus dem {@link JwtService} statt
 * ueber einen gesetzten SecurityContext: nur so durchlaeuft jede Anfrage
 * dieselbe Filterkette wie in Produktion, einschliesslich der Nachfrage nach
 * {@code User.status} bei jedem Request.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProjectReadIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private DevMasterDataSeeder seeder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private TagRepository tagRepository;

	@Autowired
	private ProjectMemberRepository projectMemberRepository;

	@Autowired
	private ProjectStatusHistoryRepository statusHistoryRepository;

	@Autowired
	private BlockRepository blockRepository;

	/** Fuer hasOpenNomination (§3.11, seit Contract v90). */
	@Autowired
	private Top10NominationRepository nominationRepository;

	@Autowired
	private ReactionRepository reactionRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	@Autowired
	private ModuleRepository moduleRepository;

	@Autowired
	private SemesterRepository semesterRepository;

	/** Nur fuer das Profilbild eines Mitglieds: es haengt am Portfolio (§3.2). */
	@Autowired
	private PortfolioRepository portfolioRepository;

	@Autowired
	private PortfolioService portfolioService;

	/** Klammert die Projekte dieses Laufs von allem ab, was sonst in der DB steht. */
	private Semester semester;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User otherEditor;

	private User admin;

	private Project draftOfAuthor;

	private Project publishedProject;

	private Project submittedForeignProject;

	private Project foreignDraftWithMember;

	private Category category;

	private StudyProgram studyProgram;

	private Module module;

	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());
		semester = semesterRepository.saveAndFlush(
				TestMasterData.semesterWithoutId("KAN16 " + UUID.randomUUID(), 1));

		author = save(Role.STUDENT);
		member = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		otherEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		category = categoryRepository.findAllByOrderByNameAsc().getFirst();
		UUID fk4 = facultyRepository.findByAbbreviation("FK4").orElseThrow().getId();
		studyProgram = studyProgramRepository.findByFacultyIdAndName(fk4, "Informatik").orElseThrow();
		module = moduleRepository.findByStudyProgramIdOrderByNameAsc(studyProgram.getId()).getFirst();

		draftOfAuthor = newProject(author, ProjectStatus.DRAFT, "Alpha Entwurf");

		publishedProject = newProject(author, ProjectStatus.PUBLISHED, "Beta Portfolio");
		publishedProject.setSummary("Ein Teaser ueber Barrierefreiheit");
		publishedProject.setCategory(category);
		publishedProject.setFaculty(studyProgram.getFaculty());
		publishedProject.setStudyProgram(studyProgram);
		publishedProject.setModule(module);
		publishedProject.setProjectType(ProjectType.THESIS);
		publishedProject.setDegree(Degree.BACHELOR);
		publishedProject.setPublishedAt(Instant.now().truncatedTo(ChronoUnit.SECONDS));
		// Die bestehende Sammlung fuellen statt sie zu ersetzen: das Projekt ist
		// bereits gespeichert, seine Tag-Sammlung wird also von Hibernate
		// verwaltet.
		// Namen mit Zusatz, weil tag seit §3.19 eine geteilte Stammdatentabelle
		// ist: ein blankes "react" gibt es in der Entwicklungsdatenbank bereits,
		// und die Zusicherung weiter unten haengt an der Schreibweise.
		publishedProject.getTags().addAll(List.of(
				TestMasterData.existingOrNewTag(tagRepository, "ux-test"),
				TestMasterData.existingOrNewTag(tagRepository, "react-test")));
		publishedProject = projectRepository.saveAndFlush(publishedProject);

		submittedForeignProject = newProject(otherStudent, ProjectStatus.SUBMITTED, "Gamma Review");
		submittedForeignProject.getEditors().add(assignedEditor);
		submittedForeignProject = projectRepository.saveAndFlush(submittedForeignProject);

		foreignDraftWithMember = newProject(otherStudent, ProjectStatus.DRAFT, "Delta Gruppenarbeit");
		// Auch dieser Entwurf hat schon eine zugewiesene Redaktion: er belegt,
		// dass die Zuweisung allein im DRAFT noch keine Sicht verschafft (§5
		// Fussnote 11, v42).
		foreignDraftWithMember.getEditors().add(assignedEditor);
		foreignDraftWithMember = projectRepository.saveAndFlush(foreignDraftWithMember);
		ProjectMember membership = projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(foreignDraftWithMember, member, "Frontend"));
		// Die Zeile steht in der Datenbank, aber die Sammlung des bereits
		// verwalteten Projekts kennt sie noch nicht. Test und Endpoint teilen
		// sich hier einen Persistenzkontext; in Produktion faellt das nicht an,
		// weil jeder Request seinen eigenen hat und die Sammlung frisch laedt.
		// Der ProjectPermissionService liest genau diese Sammlung, deshalb
		// wird sie hier nachgezogen.
		foreignDraftWithMember.getMembers().add(membership);
	}

	// ==================================================================
	// GET /api/projects: Sichtbarkeit (§5)
	// ==================================================================

	@Nested
	@DisplayName("Liste: rollenabhaengige Sichtbarkeit")
	class Visibility {

		@Test
		@DisplayName("PUBLIC sieht ausschliesslich veroeffentlichte Projekte")
		void publicSeesOnlyPublished() throws Exception {
			assertThat(listIds(null)).containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Studierende sehen zusaetzlich die eigenen Projekte, nicht die fremden Entwuerfe")
		void authorSeesOwn() throws Exception {
			assertThat(listIds(author)).containsExactlyInAnyOrder(
					publishedProject.getId(),
					draftOfAuthor.getId());
		}

		@Test
		@DisplayName("Projektmitglieder sehen den fremden Entwurf, an dem sie mitarbeiten (§3.13)")
		void memberSeesGroupWork() throws Exception {
			assertThat(listIds(member)).containsExactlyInAnyOrder(
					publishedProject.getId(),
					foreignDraftWithMember.getId());
		}

		@Test
		@DisplayName("Die zugewiesene Redaktion sieht ihr Projekt ab der Einreichung, den "
				+ "zugewiesenen Entwurf nicht (§5 Fussnote 11, v42)")
		void assignedEditorSeesFromSubmissionOn() throws Exception {
			// foreignDraftWithMember traegt dieselbe Zuweisung, bleibt aber als
			// DRAFT unsichtbar.
			assertThat(listIds(assignedEditor)).containsExactlyInAnyOrder(
					publishedProject.getId(),
					submittedForeignProject.getId());
		}

		@Test
		@DisplayName("Eine nicht zugewiesene Redakteur:in sieht nur Veroeffentlichtes, wie "
				+ "Studierende ohne eigene Projekte")
		void unassignedEditorSeesOnlyPublished() throws Exception {
			assertThat(listIds(otherEditor)).containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Admin sieht alle Projekte in allen Status")
		void adminSeesEverything() throws Exception {
			assertThat(listIds(admin)).hasSize(4);
		}

		@Test
		@DisplayName("Ein Filter kann die Sichtbarkeitsschranke nicht aufweichen")
		void filterOpensNothing() throws Exception {
			// PUBLIC fragt gezielt nach Entwuerfen: die Antwort bleibt leer,
			// statt den Entwurf des Autors herauszugeben.
			assertThat(listIds(null, "status", "DRAFT")).isEmpty();
			assertThat(listIds(null, "author", author.getId().toString()))
					.containsExactly(publishedProject.getId());
		}
	}

	// ==================================================================
	// GET /api/projects: „Meine Reviews" (§6.1)
	// ==================================================================

	@Nested
	@DisplayName("Liste: editor=me")
	class MyReviews {

		@Test
		@DisplayName("Liefert genau die zugewiesenen Projekte ab der Einreichung")
		void onlyAssigned() throws Exception {
			// Der zugewiesene Entwurf fehlt: die Sichtbarkeitsschranke steht
			// mit UND vor dem Filter (§5 Fussnote 11, v42).
			assertThat(listIds(assignedEditor, "editor", "me"))
					.containsExactly(submittedForeignProject.getId());
		}

		@Test
		@DisplayName("Eine Redakteur:in ohne Zuweisung bekommt eine leere Liste")
		void withoutAssignmentEmpty() throws Exception {
			assertThat(listIds(otherEditor, "editor", "me")).isEmpty();
		}

		@Test
		@DisplayName("Ein zugewiesenes Admin-Konto findet sein Projekt hier, ein nicht "
				+ "zugewiesenes nicht (DoD KAN-87)")
		void assignedAdminSeesTheProject() throws Exception {
			// Ohne Zuweisung ist die Liste leer, obwohl der Admin jedes
			// Projekt lesen darf: editor=me schneidet auf die Zuweisung zu und
			// nicht auf die Sicht (§5, Fussnote 5 seit Contract v89).
			assertThat(listIds(admin, "editor", "me")).isEmpty();

			submittedForeignProject.getEditors().add(admin);
			projectRepository.saveAndFlush(submittedForeignProject);

			assertThat(listIds(admin, "editor", "me"))
					.containsExactly(submittedForeignProject.getId());
		}

		@Test
		@DisplayName("Dieselbe Wirkung ueber die ausgeschriebene Redakteurs-ID")
		void viaId() throws Exception {
			// Der Admin sieht alles, deshalb taucht hier auch der zugewiesene
			// Entwurf auf; fuer die Redaktion selbst filtert die
			// Sichtbarkeitsschranke ihn heraus (Test onlyAssigned).
			assertThat(listIds(admin, "editor", assignedEditor.getId().toString()))
					.containsExactlyInAnyOrder(
							submittedForeignProject.getId(),
							foreignDraftWithMember.getId());
		}

		@Test
		@DisplayName("Ohne Anmeldung ergibt \"me\" 401 und keine leere Liste")
		void withoutLogin() throws Exception {
			mockMvc.perform(get("/api/projects").param("editor", "me"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NOT_AUTHENTICATED));
		}

		@Test
		@DisplayName("Weder \"me\" noch UUID: 400 im Envelope, ohne den eingeschickten Wert")
		void unusableValue() throws Exception {
			mockMvc.perform(asUser(get("/api/projects").param("editor", "irgendwas"), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED))
					.andExpect(jsonPath("$.message", not(containsString("irgendwas"))));
		}
	}

	// ==================================================================
	// GET /api/projects: „Mein Portfolio" (§6.1, Filter participant seit v84)
	// ==================================================================

	@Nested
	@DisplayName("Liste: participant=me")
	class MyParticipations {

		@Test
		@DisplayName("Enthaelt Eigenes und Mitwirkung, nicht die fremden Projekte")
		void ownAndMemberships() throws Exception {
			/*
			 * Der Kern von KAN-83: member ist an foreignDraftWithMember nur
			 * Mitglied und findet es trotzdem. publishedProject bleibt draussen,
			 * obwohl member es sehen darf: sehen und beteiligt sein sind zwei
			 * verschiedene Fragen, und genau das trennt participant von der
			 * Sichtbarkeitsschranke.
			 */
			assertThat(listIds(member, "participant", "me"))
					.containsExactly(foreignDraftWithMember.getId());
		}

		@Test
		@DisplayName("Die Autor:in findet ihre eigenen Projekte, wie mit author")
		void authorSeesOwn() throws Exception {
			assertThat(listIds(author, "participant", "me")).containsExactlyInAnyOrder(
					publishedProject.getId(),
					draftOfAuthor.getId());
		}

		@Test
		@DisplayName("author bleibt die reine Autorenuebersicht und nimmt Mitgliedschaft "
				+ "nicht mit auf (§6.1)")
		void authorFilterUnchanged() throws Exception {
			// Die Zusage aus §6.1, die den neuen Parameter ueberhaupt noetig macht:
			// author waere sonst still umgedeutet worden.
			assertThat(listIds(admin, "author", member.getId().toString())).isEmpty();
			assertThat(listIds(admin, "participant", member.getId().toString()))
					.containsExactly(foreignDraftWithMember.getId());
		}

		@Test
		@DisplayName("Die Sichtbarkeitsschranke steht weiterhin mit UND davor")
		void visibilityStillApplies() throws Exception {
			/*
			 * otherEditor ist diesem Entwurf nicht zugewiesen und darf ihn deshalb
			 * nicht sehen (§5 Fussnote 11). Der Filter oeffnet daran nichts:
			 * participant sagt, wessen Beteiligung gemeint ist, nicht, wer sie
			 * sehen darf. Nicht otherStudent, denn der ist die Autor:in genau
			 * dieses Entwurfs und sieht ihn zu Recht.
			 */
			assertThat(listIds(otherEditor, "participant", member.getId().toString()))
					.isEmpty();

			// Gegenprobe: der Admin sieht alles und findet denselben Entwurf.
			assertThat(listIds(admin, "participant", member.getId().toString()))
					.containsExactly(foreignDraftWithMember.getId());
		}

		@Test
		@DisplayName("Ohne Anmeldung ergibt \"me\" 401 und keine leere Liste")
		void withoutLogin() throws Exception {
			mockMvc.perform(get("/api/projects").param("participant", "me"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NOT_AUTHENTICATED));
		}

		@Test
		@DisplayName("Weder \"me\" noch UUID: 400 im Envelope, ohne den eingeschickten Wert")
		void unusableValue() throws Exception {
			mockMvc.perform(asUser(get("/api/projects").param("participant", "unsinn"), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED))
					.andExpect(jsonPath("$.message", not(containsString("unsinn"))));
		}
	}

	// ==================================================================
	// GET /api/projects: Filter (§6.1)
	// ==================================================================

	@Nested
	@DisplayName("Liste: Filter und Suche")
	class Filters {

		@Test
		@DisplayName("Stammdatenfilter greifen einzeln")
		void masterDataFilters() throws Exception {
			UUID expected = publishedProject.getId();

			assertThat(listIds(admin, "category", category.getId().toString()))
					.containsExactly(expected);
			assertThat(listIds(admin, "faculty", studyProgram.getFaculty().getId().toString()))
					.containsExactly(expected);
			assertThat(listIds(admin, "studyProgram", studyProgram.getId().toString()))
					.containsExactly(expected);
			assertThat(listIds(admin, "module", module.getId().toString()))
					.containsExactly(expected);
			assertThat(listIds(admin, "degree", "BACHELOR")).containsExactly(expected);
			assertThat(listIds(admin, "type", "THESIS")).containsExactly(expected);
		}

		@Test
		@DisplayName("Mehrere Filter werden mit UND verknuepft")
		void combination() throws Exception {
			assertThat(listIds(admin, "type", "THESIS", "degree", "BACHELOR", "q", "Beta"))
					.containsExactly(publishedProject.getId());

			// Ein Filter, der nicht passt, macht die Kombination leer.
			assertThat(listIds(admin, "type", "THESIS", "degree", "MASTER")).isEmpty();
		}

		@Test
		@DisplayName("q sucht in Titel und Kurzbeschreibung, unabhaengig von der Schreibweise")
		void searchText() throws Exception {
			assertThat(listIds(admin, "q", "beta portfolio"))
					.containsExactly(publishedProject.getId());
			assertThat(listIds(admin, "q", "BARRIEREFREIHEIT"))
					.containsExactly(publishedProject.getId());
			assertThat(listIds(admin, "q", "gamma"))
					.containsExactly(submittedForeignProject.getId());
		}

		// --- Suche ueber Autor:innennamen (v47, KAN-66) -----------------

		@Test
		@DisplayName("q findet Projekte ueber den Vornamen und den Nachnamen der Autor:in")
		void searchByAuthorName() throws Exception {
			renameAuthor("Milena", "Quastenberg");

			assertThat(listIds(admin, "q", "milena")).containsExactlyInAnyOrder(
					draftOfAuthor.getId(), publishedProject.getId());
			assertThat(listIds(admin, "q", "QUASTENBERG")).containsExactlyInAnyOrder(
					draftOfAuthor.getId(), publishedProject.getId());
		}

		@Test
		@DisplayName("Auch der volle Name in einem Suchbegriff trifft (Klaerungsrunde KAN-66)")
		void searchByFullAuthorName() throws Exception {
			renameAuthor("Milena", "Quastenberg");

			assertThat(listIds(admin, "q", "milena quastenberg")).containsExactlyInAnyOrder(
					draftOfAuthor.getId(), publishedProject.getId());
		}

		@Test
		@DisplayName("Namenssuche laesst sich mit anderen Filtern kombinieren")
		void searchByAuthorNameCombinesWithFilters() throws Exception {
			renameAuthor("Milena", "Quastenberg");

			// type=THESIS traegt nur das veroeffentlichte Projekt; der Entwurf
			// derselben Autor:in faellt aus der Schnittmenge.
			assertThat(listIds(admin, "q", "quastenberg", "type", "THESIS"))
					.containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Die Namenssuche weicht die Sichtbarkeitsschranke nicht auf (§5)")
		void searchByAuthorNameOpensNothing() throws Exception {
			renameAuthor("Milena", "Quastenberg");

			// PUBLIC findet ueber den Namen nur das Veroeffentlichte, nicht den
			// Entwurf derselben Autor:in.
			assertThat(listIds(null, "q", "quastenberg"))
					.containsExactly(publishedProject.getId());
		}

		// --- Suche ueber Schlagwoerter (v81, KAN-80) --------------------

		@Test
		@DisplayName("q findet Projekte ueber ihre Schlagwoerter (§3.19)")
		void searchByTag() throws Exception {
			// Das veroeffentlichte Projekt traegt "ux-test" und "react-test";
			// weder das eine noch das andere Wort kommt in Titel oder Teaser vor.
			assertThat(listIds(admin, "q", "ux-test"))
					.containsExactly(publishedProject.getId());
			assertThat(listIds(admin, "q", "REACT-TEST"))
					.containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Auch ein Teil eines Schlagworts trifft, wie bei Titel und Teaser")
		void searchByTagIsSubstring() throws Exception {
			assertThat(listIds(admin, "q", "react"))
					.containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Ein Projekt mit mehreren passenden Schlagwoertern erscheint einmal")
		void tagSearchDoesNotDuplicate() throws Exception {
			// "test" trifft beide Schlagwoerter des Projekts. Ein Join statt der
			// Unterabfrage lieferte die Kachel hier zweimal und verfaelschte
			// damit Trefferzahl und Seitenaufteilung.
			assertThat(listIds(admin, "q", "-test"))
					.containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Die Schlagwortsuche weicht die Sichtbarkeitsschranke nicht auf (§5)")
		void tagSearchOpensNothing() throws Exception {
			draftOfAuthor.getTags().add(
					TestMasterData.existingOrNewTag(tagRepository, "geheim-test"));
			projectRepository.saveAndFlush(draftOfAuthor);

			assertThat(listIds(null, "q", "geheim-test")).isEmpty();
			assertThat(listIds(admin, "q", "geheim-test"))
					.containsExactly(draftOfAuthor.getId());
		}

		@Test
		@DisplayName("Platzhalter im Suchbegriff werden maskiert und wirken nicht als Joker")
		void wildcardsAreEscaped() throws Exception {
			assertThat(listIds(admin, "q", "%")).isEmpty();
			assertThat(listIds(admin, "q", "_")).isEmpty();
		}

		@Test
		@DisplayName("Ein leerer Parameter wirkt wie ein fehlender")
		void emptyParameter() throws Exception {
			assertThat(listIds(admin, "q", "")).hasSize(4);
		}

		@Test
		@DisplayName("Unbekannte Filter-ID ergibt eine leere Liste, kein 404")
		void unknownFilterId() throws Exception {
			mockMvc.perform(asUser(listRequest("category", UUID.randomUUID().toString()), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content").isEmpty());
		}

		// --- Mehrwertige Filter (v43, KAN-64) --------------------------

		@Test
		@DisplayName("Zwei Werte desselben Filters liefern die ODER-Vereinigung")
		void repeatedFilterIsUnion() throws Exception {
			Category second = secondCategoryOnSubmittedProject();

			assertThat(listIds(admin,
					"category", category.getId().toString(),
					"category", second.getId().toString()))
					.containsExactlyInAnyOrder(
							publishedProject.getId(),
							submittedForeignProject.getId());
		}

		@Test
		@DisplayName("Auch ein Enum-Filter nimmt mehrere Werte an")
		void repeatedEnumFilterIsUnion() throws Exception {
			submittedForeignProject.setDegree(Degree.MASTER);
			projectRepository.saveAndFlush(submittedForeignProject);

			assertThat(listIds(admin, "degree", "BACHELOR", "degree", "MASTER"))
					.containsExactlyInAnyOrder(
							publishedProject.getId(),
							submittedForeignProject.getId());
		}

		@Test
		@DisplayName("Wiederholter Filter und zweiter Filter: ODER innerhalb, UND dazwischen")
		void repeatedFilterCombinesWithAnd() throws Exception {
			Category second = secondCategoryOnSubmittedProject();

			// category passt auf beide Projekte, type=THESIS nur auf das
			// veroeffentlichte: die Schnittmenge ist genau eines.
			assertThat(listIds(admin,
					"category", category.getId().toString(),
					"category", second.getId().toString(),
					"type", "THESIS"))
					.containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("Ein bekannter und ein unbekannter Wert: die Vereinigung ist der bekannte Treffer")
		void repeatedFilterWithUnknownId() throws Exception {
			assertThat(listIds(admin,
					"category", category.getId().toString(),
					"category", UUID.randomUUID().toString()))
					.containsExactly(publishedProject.getId());
		}

		@Test
		@DisplayName("semester nimmt mehrere IDs an und vereinigt die Semester")
		void repeatedSemesterFilter() throws Exception {
			Semester other = semesterRepository.saveAndFlush(
					TestMasterData.semesterWithoutId("KAN64 " + UUID.randomUUID(), 2));
			Project inOtherSemester = newProject(otherStudent, ProjectStatus.PUBLISHED,
					"Epsilon Anderes Semester");
			inOtherSemester.setSemester(other);
			projectRepository.saveAndFlush(inOtherSemester);

			// listRequest grenzt jede Anfrage auf das Semester dieses Laufs
			// ein; das erste Vorkommen ersetzt genau diese Vorgabe, das zweite
			// haengt das frische Semester an.
			assertThat(listIds(admin,
					"semester", semester.getId().toString(),
					"semester", other.getId().toString()))
					.containsExactlyInAnyOrder(
							draftOfAuthor.getId(),
							publishedProject.getId(),
							submittedForeignProject.getId(),
							foreignDraftWithMember.getId(),
							inOtherSemester.getId());
		}

		@Test
		@DisplayName("Ein leerer Wert in der Wiederholung wirkt wie nicht mitgeschickt")
		void emptyRepeatedValue() throws Exception {
			assertThat(listIds(admin, "degree", "", "degree", "BACHELOR"))
					.containsExactly(publishedProject.getId());
			assertThat(listIds(admin, "category", "")).hasSize(4);
		}

		/**
		 * Gibt der Autor:in von {@code draftOfAuthor} und
		 * {@code publishedProject} einen unverwechselbaren Namen. Der
		 * Testhelfer {@code TestUser} nennt alle Personen „Test Person";
		 * eine Namenssuche traefe damit jedes Projekt dieses Laufs und
		 * bewiese nichts.
		 */
		private void renameAuthor(String firstName, String lastName) {
			author.setFirstName(firstName);
			author.setLastName(lastName);
			userRepository.saveAndFlush(author);
		}

		/**
		 * Gibt dem eingereichten Projekt eine zweite Kategorie, damit zwei
		 * Projekte dieses Laufs in verschiedenen Kategorien stehen.
		 */
		private Category secondCategoryOnSubmittedProject() {
			Category second = categoryRepository.findAllByOrderByNameAsc().get(1);
			submittedForeignProject.setCategory(second);
			projectRepository.saveAndFlush(submittedForeignProject);
			return second;
		}
	}

	// ==================================================================
	// GET /api/projects: Seitenformat und Sortierung (§6.6, §1)
	// ==================================================================

	@Nested
	@DisplayName("Liste: Paginierung und Sortierung")
	class Pages {

		@Test
		@DisplayName("Das Seitenformat traegt die fuenf Felder aus §6.6")
		void pageFormat() throws Exception {
			mockMvc.perform(asUser(listRequest("page", "1", "size", "3"), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.page").value(1))
					.andExpect(jsonPath("$.size").value(3))
					.andExpect(jsonPath("$.totalElements").value(4))
					.andExpect(jsonPath("$.totalPages").value(2))
					.andExpect(jsonPath("$.content.length()").value(1))
					// Springs Page-Felder duerfen nicht durchschlagen (§6.6).
					.andExpect(jsonPath("$.pageable").doesNotExist())
					.andExpect(jsonPath("$.numberOfElements").doesNotExist());
		}

		@Test
		@DisplayName("Ueber alle Seiten kommt jedes Projekt genau einmal")
		void pagingWithoutGaps() throws Exception {
			List<UUID> firstPage = listIds(admin, "page", "0", "size", "2");
			List<UUID> secondPage = listIds(admin, "page", "1", "size", "2");

			assertThat(firstPage).hasSize(2);
			assertThat(secondPage).hasSize(2);
			assertThat(firstPage).doesNotContainAnyElementsOf(secondPage);
		}

		@Test
		@DisplayName("sort=title,asc ordnet nach Titel")
		void sortByTitle() throws Exception {
			assertThat(listTitles(admin, "sort", "title,asc"))
					.containsExactly("Alpha Entwurf", "Beta Portfolio", "Delta Gruppenarbeit", "Gamma Review");
		}

		@Test
		@DisplayName("sort=title,desc dreht die Reihenfolge um")
		void sortDescending() throws Exception {
			assertThat(listTitles(admin, "sort", "title,desc"))
					.containsExactly("Gamma Review", "Delta Gruppenarbeit", "Beta Portfolio", "Alpha Entwurf");
		}

		@Test
		@DisplayName("Nicht erlaubtes Sortierfeld: 400 statt 500, und kein Zugriff auf fremde Pfade")
		void forbiddenSortField() throws Exception {
			mockMvc.perform(asUser(listRequest("sort", "author.passwordHash,asc"), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.VALIDATION_FAILED));
		}
	}

	// ==================================================================
	// GET /api/projects: Mitglieder an der Kachel (§3.13, Contract v78)
	// ==================================================================

	@Nested
	@DisplayName("Liste: Mitglieder an der Kachel")
	class CardMembers {

		@BeforeEach
		void addMembersToPublishedProject() {
			/*
			 * Alle Testkonten heissen "Test Person"; fuer die Reihenfolge und
			 * die Namensfelder braucht dieser Block unterscheidbare Namen.
			 */
			rename(otherStudent, "Ada", "Adler");
			rename(member, "Bea", "Bauer");

			// Eine Gruppenarbeit mit zwei Beteiligten neben der Autor:in. Nur
			// eine von beiden hat ein Profilbild hinterlegt.
			projectMemberRepository.saveAndFlush(
					TestProject.memberWithoutId(publishedProject, otherStudent, null));
			projectMemberRepository.saveAndFlush(
					TestProject.memberWithoutId(publishedProject, member, "Frontend"));

			Portfolio portfolio = portfolioService.createFor(member);
			portfolio.setAvatarUrl("/api/files/mitglied");
			portfolioRepository.saveAndFlush(portfolio);
		}

		@Test
		@DisplayName("Beide Mitglieder stehen mit Namen an der Kachel, nach Nachnamen "
				+ "geordnet (§3.13)")
		void cardCarriesAllMembers() throws Exception {
			mockMvc.perform(listRequest())
					.andExpect(status().isOk())
					// PUBLIC sieht genau das veroeffentlichte Projekt dieses Laufs.
					.andExpect(jsonPath("$.content.length()").value(1))
					.andExpect(jsonPath("$.content[0].members.length()").value(2))
					.andExpect(jsonPath("$.content[0].members[0].userId")
							.value(otherStudent.getId().toString()))
					.andExpect(jsonPath("$.content[0].members[0].firstName").value("Ada"))
					.andExpect(jsonPath("$.content[0].members[0].lastName").value("Adler"))
					// Ohne Funktionsbezeichnung, seit Contract v65 erlaubt (§3.13).
					.andExpect(jsonPath("$.content[0].members[0].projectRole").value(nullValue()))
					.andExpect(jsonPath("$.content[0].members[1].userId")
							.value(member.getId().toString()))
					.andExpect(jsonPath("$.content[0].members[1].firstName").value("Bea"))
					.andExpect(jsonPath("$.content[0].members[1].lastName").value("Bauer"))
					.andExpect(jsonPath("$.content[0].members[1].projectRole").value("Frontend"))
					// Die Autor:in ist kein Mitglied und steht weiterhin allein in
					// "author" (§3.13.1).
					.andExpect(jsonPath("$.content[0].author.id").value(author.getId().toString()));
		}

		@Test
		@DisplayName("Ein Mitglied mit hinterlegtem Profilbild fuehrt avatarUrl, eines "
				+ "ohne fuehrt null (§3.2)")
		void cardCarriesMemberAvatar() throws Exception {
			mockMvc.perform(listRequest())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[0].members[0].avatarUrl").value(nullValue()))
					.andExpect(jsonPath("$.content[0].members[1].avatarUrl")
							.value("/api/files/mitglied"));
		}

		@Test
		@DisplayName("Ein Projekt ohne Mitglieder fuehrt eine leere Liste und nicht null")
		void cardOfSoloWorkCarriesEmptyList() throws Exception {
			// draftOfAuthor hat keine Mitglieder; die Autor:in sieht ihn (§5).
			String response = body(asUser(listRequest("q", "Alpha"), author));

			JsonNode cards = objectMapper.readTree(response).get("content");
			assertThat(cards.size()).isEqualTo(1);
			JsonNode members = cards.get(0).get("members");
			assertThat(members.isArray())
					.as("Ohne Mitglieder eine leere Liste, damit das Frontend nicht auf null "
							+ "pruefen muss")
					.isTrue();
			assertThat(members.size()).isZero();
		}

		@Test
		@DisplayName("Die Kachel fuehrt keine editors: wer sie sehen darf, haengt nach §5 "
				+ "an Rolle und Status und wird nur in der Detailantwort geprueft")
		void cardNeverCarriesEditors() throws Exception {
			/*
			 * Der Admin sieht jedes Projekt (§5), darunter das eingereichte mit
			 * seiner zugewiesenen Redaktion. Selbst ihm gegenueber nennt die
			 * Kachel sie nicht.
			 */
			assertThat(listIds(admin)).contains(submittedForeignProject.getId());

			String response = body(asUser(listRequest(), admin));
			assertThat(response)
					.as("Die Redaktion bleibt der Detailantwort vorbehalten (§3.3, §5)")
					.doesNotContain("editors")
					.doesNotContain(assignedEditor.getId().toString())
					// Gegenprobe, dass wirklich die neue Kachel geprueft wurde.
					.contains("\"members\"");
		}

		private void rename(User user, String firstName, String lastName) {
			user.setFirstName(firstName);
			user.setLastName(lastName);
			userRepository.saveAndFlush(user);
		}
	}

	// ==================================================================
	// GET /api/projects/{id}
	// ==================================================================

	@Nested
	@DisplayName("Detail: Fehlerpolitik nach §6.3.1")
	class DetailErrors {

		@Test
		@DisplayName("Unbekannte ID: 404 PROJECT_NOT_FOUND")
		void unknownId() throws Exception {
			UUID id = UUID.randomUUID();

			mockMvc.perform(get("/api/projects/" + id))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.PROJECT_NOT_FOUND));
		}

		@Test
		@DisplayName("Fremder Entwurf ohne Anmeldung: 401 NOT_AUTHENTICATED")
		void foreignDraftWithoutToken() throws Exception {
			mockMvc.perform(get("/api/projects/" + draftOfAuthor.getId()))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.status").value(401))
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NOT_AUTHENTICATED));
		}

		@Test
		@DisplayName("Fremder Entwurf mit Token einer unbeteiligten Person: 403 NO_PERMISSION")
		void foreignDraftWithoutReadPermission() throws Exception {
			mockMvc.perform(asUser(get("/api/projects/" + draftOfAuthor.getId()), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.status").value(403))
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NO_PERMISSION));
		}

		@Test
		@DisplayName("Auch die zugewiesene Redaktion bekommt den Entwurf nicht, wohl aber das "
				+ "eingereichte Projekt (§5 Fussnote 11, v42)")
		void assignedEditorAndTheDraft() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + foreignDraftWithMember.getId()), assignedEditor))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NO_PERMISSION));

			mockMvc.perform(asUser(
							get("/api/projects/" + submittedForeignProject.getId()), assignedEditor))
					.andExpect(status().isOk());

			// Ohne Zuweisung bleibt auch das eingereichte Projekt verborgen.
			mockMvc.perform(asUser(
							get("/api/projects/" + submittedForeignProject.getId()), otherEditor))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value(ErrorCodes.NO_PERMISSION));
		}

		@Test
		@DisplayName("Die Autor:in bekommt ihren eigenen Entwurf")
		void ownDraft() throws Exception {
			mockMvc.perform(asUser(get("/api/projects/" + draftOfAuthor.getId()), author))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.title").value("Alpha Entwurf"));
		}

		@Test
		@DisplayName("Ein veroeffentlichtes Projekt ist auch ohne Token lesbar")
		void publishedWithoutToken() throws Exception {
			mockMvc.perform(get("/api/projects/" + publishedProject.getId()))
					.andExpect(status().isOk());
		}
	}

	@Nested
	@DisplayName("Detail: Inhalt der Antwort")
	class DetailContent {

		@Test
		@DisplayName("Metadaten, Bezuege, version und Zeitstempel")
		void metadata() throws Exception {
			mockMvc.perform(get("/api/projects/" + publishedProject.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.id").value(publishedProject.getId().toString()))
					.andExpect(jsonPath("$.title").value("Beta Portfolio"))
					.andExpect(jsonPath("$.status").value("PUBLISHED"))
					.andExpect(jsonPath("$.projectType").value("THESIS"))
					.andExpect(jsonPath("$.degree").value("BACHELOR"))
					.andExpect(jsonPath("$.semester.name").value(semester.getName()))
					.andExpect(jsonPath("$.category.id").value(category.getId().toString()))
					.andExpect(jsonPath("$.studyProgram.abbreviation").value(studyProgram.getAbbreviation()))
					.andExpect(jsonPath("$.module.id").value(module.getId().toString()))
					.andExpect(jsonPath("$.author.id").value(author.getId().toString()))
					.andExpect(jsonPath("$.version").exists())
					.andExpect(jsonPath("$.createdAt").exists())
					.andExpect(jsonPath("$.updatedAt").exists())
					.andExpect(jsonPath("$.publishedAt").exists())
					// Tags kommen alphabetisch, damit die Antwort stabil ist.
					.andExpect(jsonPath("$.tags[0]").value("react-test"))
					.andExpect(jsonPath("$.tags[1]").value("ux-test"));
		}

		@Test
		@DisplayName("Bloecke kommen nach orderIndex geordnet, mit unveraendertem content")
		void blocksOrdered() throws Exception {
			blockRepository.saveAndFlush(TestProject.blockWithoutId(publishedProject,
					BlockType.TEXT, 1, prosemirror("paragraph", "zweiter")));
			blockRepository.saveAndFlush(TestProject.blockWithoutId(publishedProject,
					BlockType.HEADING, 0, prosemirror("heading", "erster")));

			mockMvc.perform(get("/api/projects/" + publishedProject.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.blocks.length()").value(2))
					.andExpect(jsonPath("$.blocks[0].type").value("HEADING"))
					.andExpect(jsonPath("$.blocks[0].orderIndex").value(0))
					// Seit Contract v63 die 3 (§2.10): der Lesepfad meldet
					// die aktuelle Schemaversion, in die er den Inhalt bringt.
					.andExpect(jsonPath("$.blocks[0].schemaVersion")
							.value(BlockSchemaMigration.CURRENT_VERSION))
					.andExpect(jsonPath("$.blocks[0].content.type").value("heading"))
					.andExpect(jsonPath("$.blocks[1].type").value("TEXT"))
					.andExpect(jsonPath("$.blocks[1].orderIndex").value(1));
		}

		@Test
		@DisplayName("Mitglieder erscheinen mit userId, Namen und Rolle im Projekt (§3.13)")
		void members() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + foreignDraftWithMember.getId()), member))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.members.length()").value(1))
					.andExpect(jsonPath("$.members[0].userId").value(member.getId().toString()))
					.andExpect(jsonPath("$.members[0].projectRole").value("Frontend"));
		}

		@Test
		@DisplayName("reactionCount ist die Zahl der Reaktionen (§3.10)")
		void reactionCount() throws Exception {
			reactionRepository.saveAndFlush(
					TestReaction.withoutId(publishedProject, member));
			reactionRepository.saveAndFlush(
					TestReaction.withoutId(publishedProject, otherStudent));

			mockMvc.perform(get("/api/projects/" + publishedProject.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.reactionCount").value(2));

			// Dieselbe Zahl in der Kachel; Projekte ohne Reaktion zaehlen als 0.
			mockMvc.perform(asUser(listRequest("sort", "title,asc"), admin))
					.andExpect(jsonPath("$.content[0].reactionCount").value(0))
					.andExpect(jsonPath("$.content[1].reactionCount").value(2));
		}

		@Test
		@DisplayName("hasReacted sagt, ob die lesende Person selbst reagiert hat "
				+ "(§3.10, seit Contract v84)")
		void hasReacted() throws Exception {
			reactionRepository.saveAndFlush(
					TestReaction.withoutId(publishedProject, member));

			// Wer reagiert hat, sieht true; wer nicht, false; ohne Token immer
			// false, weil es ohne Identitaet nichts nachzusehen gibt. Ohne dieses
			// Feld liesse sich der gedrueckte Zustand nur bis zum Neuladen halten.
			String path = "/api/projects/" + publishedProject.getId();

			mockMvc.perform(asUser(get(path), member))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.hasReacted").value(true));

			mockMvc.perform(asUser(get(path), otherStudent))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.hasReacted").value(false));

			mockMvc.perform(get(path))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.hasReacted").value(false));

			// Die Kachel fuehrt das Feld bewusst nicht (§3.10): sie zeigt eine Zahl
			// und kein Bedienelement.
			mockMvc.perform(asUser(listRequest(), member))
					.andExpect(jsonPath("$.content[*].hasReacted").doesNotExist());
		}

		@Test
		@DisplayName("Weder passwordHash noch hsbEmail stehen irgendwo in der Antwort (§3.1), "
				+ "auch nicht in der seit v55 oeffentlichen Redaktionsliste")
		void noSensitiveFields() throws Exception {
			/*
			 * Die Redaktion wird hier ausdruecklich zugewiesen: seit Contract
			 * v55 liefert die Antwort eines veroeffentlichten Projekts sie an
			 * jede:n aus, auch ohne Anmeldung. Ohne diese Zeile liefe der
			 * Waechter gegen eine leere Liste und saehe genau an den
			 * Personenobjekten vorbei, die das Ticket neu oeffentlich macht.
			 */
			publishedProject.getEditors().add(assignedEditor);
			projectRepository.saveAndFlush(publishedProject);

			String detail = body(get("/api/projects/" + publishedProject.getId()));
			String list = body(asUser(listRequest(), admin));

			assertThat(detail).contains(assignedEditor.getId().toString());
			assertThat(detail).doesNotContain("passwordHash", "hsbEmail",
					author.getHsbEmail(), assignedEditor.getHsbEmail());
			assertThat(list).doesNotContain("passwordHash", "hsbEmail",
					author.getHsbEmail(), assignedEditor.getHsbEmail());
		}
	}

	@Nested
	@DisplayName("Detail: editors und Statushistorie (§3.3, §3.12, §5 Fussnote 7)")
	class ProjectInternals {

		@BeforeEach
		void createHistory() {
			statusHistoryRepository.saveAndFlush(TestProject.historyWithoutId(
					publishedProject, null, ProjectStatus.DRAFT, author, Instant.now()));
			publishedProject.getEditors().add(assignedEditor);
			projectRepository.saveAndFlush(publishedProject);

			statusHistoryRepository.saveAndFlush(TestProject.historyWithoutId(
					draftOfAuthor, null, ProjectStatus.DRAFT, author, Instant.now()));
			draftOfAuthor.getEditors().add(assignedEditor);
			projectRepository.saveAndFlush(draftOfAuthor);
		}

		@Test
		@DisplayName("Fuer PUBLIC steht die Statushistorie auf null, die Redaktion aber nicht: "
				+ "das Projekt ist veroeffentlicht (§3.3, seit Contract v55)")
		void publicSeesEditorsButNoHistory() throws Exception {
			mockMvc.perform(get("/api/projects/" + publishedProject.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.editors.length()").value(1))
					.andExpect(jsonPath("$.editors[0].id")
							.value(assignedEditor.getId().toString()))
					.andExpect(jsonPath("$.statusHistory").value(nullValue()));
		}

		@Test
		@DisplayName("Unbeteiligte Angemeldete sehen dasselbe wie PUBLIC")
		void othersSeeEditorsButNoHistory() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + publishedProject.getId()), otherStudent))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.editors.length()").value(1))
					.andExpect(jsonPath("$.statusHistory").value(nullValue()));
		}

		@Test
		@DisplayName("Vor der Veroeffentlichung bleibt auch die Redaktion verdeckt: "
				+ "die Autor:in sieht sie, eine unbeteiligte Person nicht")
		void unpublishedKeepsEditorsHidden() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + draftOfAuthor.getId()), author))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.editors.length()").value(1))
					.andExpect(jsonPath("$.statusHistory.length()").value(1));

			/*
			 * Eine unbeteiligte Person kommt an einen Entwurf gar nicht heran,
			 * die Schranke greift schon beim Lesen (§5, Fussnote 11). Genau
			 * deshalb legt v55 die Redaktion nur bei PUBLISHED offen: dort ist
			 * das Projekt ohnehin fuer alle lesbar.
			 */
			mockMvc.perform(asUser(
							get("/api/projects/" + draftOfAuthor.getId()), otherStudent))
					.andExpect(status().isForbidden());
		}

		@Test
		@DisplayName("Die Autor:in sieht Zuweisung und Verlauf")
		void authorSeesBoth() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + publishedProject.getId()), author))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.editors.length()").value(1))
					.andExpect(jsonPath("$.editors[0].id")
							.value(assignedEditor.getId().toString()))
					.andExpect(jsonPath("$.statusHistory.length()").value(1))
					.andExpect(jsonPath("$.statusHistory[0].fromStatus").doesNotExist())
					.andExpect(jsonPath("$.statusHistory[0].toStatus").value("DRAFT"))
					.andExpect(jsonPath("$.statusHistory[0].changedBy.id")
							.value(author.getId().toString()));
		}

		@Test
		@DisplayName("Die zugewiesene Redaktion sieht sie, eine nicht zugewiesene nicht")
		void onlyAssignedEditor() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + publishedProject.getId()), assignedEditor))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.statusHistory.length()").value(1));

			// Lesen darf sie das Projekt trotzdem, nur die Interna nicht.
			mockMvc.perform(asUser(
							get("/api/projects/" + publishedProject.getId()), otherEditor))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.title").value("Beta Portfolio"))
					.andExpect(jsonPath("$.statusHistory").value(nullValue()));
		}

		@Test
		@DisplayName("Der Admin sieht sie bei jedem Projekt")
		void adminSeesBoth() throws Exception {
			mockMvc.perform(asUser(
							get("/api/projects/" + publishedProject.getId()), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.editors.length()").value(1))
					.andExpect(jsonPath("$.statusHistory.length()").value(1));
		}
	}

	// ==================================================================
	// hasOpenNomination (§3.11, seit Contract v90)
	// ==================================================================

	@Nested
	@DisplayName("hasOpenNomination an Kachel und Detail")
	class OpenNomination {

		/**
		 * Ein offener Vorschlag der zugewiesenen Redaktion zum veroeffentlichten
		 * Projekt. Bewusst von <em>ihr</em> und nicht vom Admin: das Feld sagt
		 * „es liegt einer vor" und nicht „ich habe einen gemacht", und genau
		 * dieser Unterschied ist der Grund, aus dem es das Feld gibt
		 * (§3.11.1 Regel 2 gilt je Projekt).
		 */
		@BeforeEach
		void nominate() {
			nominationRepository.saveAndFlush(TestTop10.pending(
					publishedProject, assignedEditor, NominationTier.TOP_10));
		}

		@Test
		@DisplayName("Die Kachel sagt der Redaktion und dem Admin, dass ein Vorschlag offen ist")
		void cardTellsEditorAndAdmin() throws Exception {
			for (User user : List.of(assignedEditor, otherEditor, admin)) {
				String response = body(asUser(listRequest("q", "Beta"), user));
				JsonNode card = objectMapper.readTree(response).get("content").get(0);

				assertThat(card.get("title").asText()).isEqualTo("Beta Portfolio");
				assertThat(card.get("hasOpenNomination").asBoolean()).isTrue();
			}
		}

		@Test
		@DisplayName("Ein Projekt ohne Vorschlag steht auf false und nicht auf null")
		void cardFalseWithoutNomination() throws Exception {
			String response = body(asUser(listRequest("q", "Gamma"), admin));
			JsonNode card = objectMapper.readTree(response).get("content").get(0);

			assertThat(card.get("title").asText()).isEqualTo("Gamma Review");
			assertThat(card.get("hasOpenNomination").isNull()).isFalse();
			assertThat(card.get("hasOpenNomination").asBoolean()).isFalse();
		}

		@Test
		@DisplayName("Fuer Studierende und ohne Token bleibt das Feld null: nicht sehen "
				+ "duerfen ist etwas anderes als kein Vorschlag")
		void hiddenFromOthers() throws Exception {
			String asStudent = body(asUser(listRequest("q", "Beta"), author));
			assertThat(objectMapper.readTree(asStudent).get("content").get(0)
					.get("hasOpenNomination").isNull()).isTrue();

			String anonymous = body(listRequest("q", "Beta"));
			assertThat(objectMapper.readTree(anonymous).get("content").get(0)
					.get("hasOpenNomination").isNull()).isTrue();
		}

		@Test
		@DisplayName("Dieselbe Auskunft an der Detailantwort")
		void detailCarriesTheSameField() throws Exception {
			mockMvc.perform(asUser(get("/api/projects/" + publishedProject.getId()), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.hasOpenNomination").value(true));

			mockMvc.perform(asUser(get("/api/projects/" + publishedProject.getId()), author))
					.andExpect(status().isOk())
					// Ausdruecklich null und nicht false, wie bei statusHistory.
					.andExpect(jsonPath("$.hasOpenNomination").doesNotExist());

			mockMvc.perform(get("/api/projects/" + publishedProject.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.hasOpenNomination").doesNotExist());
		}

		@Test
		@DisplayName("Ein zurueckgezogener Vorschlag sperrt nicht mehr (§3.11.1)")
		void withdrawnDoesNotBlock() throws Exception {
			nominationRepository.findByProjectId(publishedProject.getId())
					.forEach(nomination -> {
						nomination.setStatus(NominationStatus.WITHDRAWN);
						nominationRepository.saveAndFlush(nomination);
					});

			mockMvc.perform(asUser(get("/api/projects/" + publishedProject.getId()), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.hasOpenNomination").value(false));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	private Project newProject(User owner, ProjectStatus status, String title) {
		Project project = TestProject.withoutId(owner, status, title);
		project.setSemester(semester);
		return projectRepository.saveAndFlush(project);
	}

	private JsonNode prosemirror(String type, String text) {
		return objectMapper.createObjectNode()
				.put("type", type)
				.put("text", text);
	}

	/**
	 * Listenanfrage, immer auf das Semester dieses Laufs eingegrenzt und mit
	 * einer Seitengroesse, die alle Testprojekte aufnimmt.
	 *
	 * <p>Die Parameter laufen ueber eine Map und nicht direkt in den Builder,
	 * damit ein Aufruf {@code listRequest("size", "3")} die Vorgabe wirklich
	 * ersetzt. Das erste Vorkommen eines Namens in {@code extra} ersetzt also
	 * die Vorgabe; jedes weitere Vorkommen desselben Namens haengt einen
	 * zweiten Wert an, denn die Sachfilter sind seit Contract v43 wiederholbar
	 * und genau diese Form ({@code ?faculty=a&faculty=b}) wollen die
	 * Mehrfachwert-Tests erzeugen.
	 *
	 * @param extra Paare aus Parametername und Wert
	 */
	private MockHttpServletRequestBuilder listRequest(String... extra) {
		Map<String, List<String>> parameters = new LinkedHashMap<>();
		parameters.put("semester", new ArrayList<>(List.of(semester.getId().toString())));
		parameters.put("size", new ArrayList<>(List.of("50")));

		Set<String> replaced = new HashSet<>();
		for (int i = 0; i + 1 < extra.length; i += 2) {
			if (replaced.add(extra[i])) {
				parameters.put(extra[i], new ArrayList<>());
			}
			parameters.get(extra[i]).add(extra[i + 1]);
		}

		MockHttpServletRequestBuilder request = get("/api/projects");
		for (Map.Entry<String, List<String>> entry : parameters.entrySet()) {
			request = request.param(entry.getKey(), entry.getValue().toArray(String[]::new));
		}
		return request;
	}

	/** Haengt ein echtes Bearer-Token an; {@code null} laesst die Anfrage anonym. */
	private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request, User user) {
		if (user == null) {
			return request;
		}
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	private List<UUID> listIds(User user, String... extra) throws Exception {
		return listField(user, "id", extra).stream().map(UUID::fromString).toList();
	}

	private List<String> listTitles(User user, String... extra) throws Exception {
		return listField(user, "title", extra);
	}

	/**
	 * Liest ein Feld aus jeder Kachel der Antwort, in der gelieferten
	 * Reihenfolge.
	 *
	 * <p>Bewusst mit einer Schleife ueber die Elemente und nicht mit
	 * {@code findValuesAsText}: das durchsucht den Baum rekursiv und wuerde
	 * unter „id" auch die IDs von Kategorie, Fakultaet und Autor:in einsammeln.
	 */
	private List<String> listField(User user, String field, String... extra) throws Exception {
		JsonNode response = objectMapper.readTree(body(asUser(listRequest(extra), user)));

		List<String> values = new ArrayList<>();
		for (JsonNode card : response.get("content")) {
			values.add(card.get(field).asText());
		}
		return values;
	}

	/**
	 * Fuehrt die Anfrage aus, erwartet 200 und liefert den Koerper. Bewusst mit
	 * ausdruecklichem UTF-8, damit Umlaute in Titeln nicht am Zeichensatz der
	 * Testantwort scheitern.
	 */
	private String body(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}
}
