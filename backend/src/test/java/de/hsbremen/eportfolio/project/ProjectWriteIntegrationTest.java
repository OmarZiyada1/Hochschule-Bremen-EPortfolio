package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.masterdata.Category;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.DevMasterDataSeeder;
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.SemesterRepository;
import de.hsbremen.eportfolio.masterdata.TagRepository;
import de.hsbremen.eportfolio.masterdata.TestMasterData;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die vier schreibenden Projekt-Endpoints aus §6.1 gegen die echte Datenbank:
 * Anlegen, Metadaten aendern, Redaktion umverteilen und Loeschen, jeweils mit
 * den Rechten aus §5, den Statusregeln aus §4.1, der Versionspruefung aus §6.4
 * und der Fehlerpolitik aus §6.3.1.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert. Die Anmeldung laeuft ueber echte
 * Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe Filterkette
 * durchlaeuft wie in Produktion; das ist zugleich die Voraussetzung dafuer,
 * dass die 401-Faelle hier ueberhaupt aussagekraeftig sind.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProjectWriteIntegrationTest {

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

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private SemesterRepository semesterRepository;

	@PersistenceContext
	private EntityManager entityManager;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User otherEditor;

	private User admin;

	private Category category;

	private Semester semester;

	/** Entwurf der Autor:in, mit {@code member} als Mitglied und einer Redaktion. */
	private Project draft;

	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());

		author = save(Role.STUDENT);
		member = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		otherEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		category = categoryRepository.findAllByOrderByNameAsc().getFirst();
		semester = semesterRepository.findAllByOrderBySortOrderAsc().getFirst();

		draft = newProject(author, ProjectStatus.DRAFT, "Gruppenarbeit");
		draft.getEditors().add(assignedEditor);
		draft = projectRepository.saveAndFlush(draft);
		// Wie im Lesetest: die Zeile steht in der Datenbank, die Sammlung des
		// bereits verwalteten Projekts kennt sie noch nicht. Test und Endpoint
		// teilen sich hier einen Persistenzkontext.
		draft.getMembers().add(projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(draft, member, "Frontend")));
	}

	// ==================================================================
	// POST /api/projects
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects")
	class Creating {

		@Test
		@DisplayName("Nur der Titel genuegt: 201, Status DRAFT, version 0, Autor:in ist die "
				+ "angemeldete Person")
		void minimalBody() throws Exception {
			JsonNode created = created(author, json("title", "Frisch angelegt"));

			assertThat(created.get("title").asText()).isEqualTo("Frisch angelegt");
			assertThat(created.get("status").asText()).isEqualTo("DRAFT");
			assertThat(created.get("version").asLong()).isZero();
			assertThat(created.get("author").get("id").asText())
					.isEqualTo(author.getId().toString());
			// Ein frischer Entwurf hat keine Bloecke (§3.3).
			assertThat(created.get("blocks")).isEmpty();
			// Die uebrigen Metadaten duerfen im Entwurf fehlen (§3.3).
			assertThat(created.get("projectType").isNull()).isTrue();
			assertThat(created.get("category").isNull()).isTrue();
		}

		@Test
		@DisplayName("Vollstaendiger Body: Metadaten, Tags, Mitglieder und Redaktion kommen an")
		void fullBody() throws Exception {
			JsonNode created = created(author, json(
					"title", "Barrierefreie Navigation",
					"summary", "Ein Teaser",
					"projectType", "THESIS",
					"degree", "BACHELOR",
					"semesterId", semester.getId().toString(),
					"categoryId", category.getId().toString(),
					"tags", List.of("ux-test", "react-test"),
					"editorIds", List.of(assignedEditor.getId().toString()),
					"members", List.of(memberEntry(member, "Frontend"))));

			assertThat(created.get("summary").asText()).isEqualTo("Ein Teaser");
			assertThat(created.get("projectType").asText()).isEqualTo("THESIS");
			assertThat(created.get("semester").get("id").asText())
					.isEqualTo(semester.getId().toString());
			assertThat(created.get("category").get("id").asText())
					.isEqualTo(category.getId().toString());
			assertThat(texts(created.get("tags"))).containsExactly("react-test", "ux-test");
			assertThat(created.get("editors")).hasSize(1);
			assertThat(created.get("members")).hasSize(1);
			assertThat(created.get("members").get(0).get("projectRole").asText())
					.isEqualTo("Frontend");
		}

		@Test
		@DisplayName("Der Anlagevorgang steht als erster Eintrag in der Statushistorie (§3.12)")
		void writesStatusHistory() throws Exception {
			JsonNode created = created(author, json("title", "Mit Historie"));

			assertThat(created.get("statusHistory")).hasSize(1);
			JsonNode entry = created.get("statusHistory").get(0);
			assertThat(entry.get("fromStatus").isNull()).isTrue();
			assertThat(entry.get("toStatus").asText()).isEqualTo("DRAFT");
			assertThat(entry.get("changedBy").get("id").asText())
					.isEqualTo(author.getId().toString());
		}

		@Test
		@DisplayName("Ohne Titel: 400 VALIDATION_FAILED im Envelope aus §6.2")
		void titleRequired() throws Exception {
			mockMvc.perform(asUser(postRequest(json("summary", "ohne Titel")), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.path").value("/api/projects"))
					.andExpect(jsonPath("$.timestamp").exists());
		}

		@Test
		@DisplayName("Mehr als fuenf Tags: 400 (§3.3)")
		void tagLimit() throws Exception {
			mockMvc.perform(asUser(postRequest(json(
							"title", "Zu viele Tags",
							"tags", List.of("a", "b", "c", "d", "e", "f"))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			// Genau fuenf sind erlaubt, die Grenze liegt richtig herum.
			mockMvc.perform(asUser(postRequest(json(
							"title", "Genau fuenf",
							"tags", List.of("a", "b", "c", "d", "e"))), author))
					.andExpect(status().isCreated());
		}

		@Test
		@DisplayName("Unbekannte Kategorie-ID: 400 und kein 404, weil das Projekt die adressierte "
				+ "Ressource ist")
		void unknownReference() throws Exception {
			mockMvc.perform(asUser(postRequest(json(
							"title", "Falsche Kategorie",
							"categoryId", UUID.randomUUID().toString())), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Unbekanntes Mitgliedskonto: 400")
		void unknownMember() throws Exception {
			Map<String, Object> ghost = new LinkedHashMap<>();
			ghost.put("userId", UUID.randomUUID().toString());
			ghost.put("projectRole", "Design");

			mockMvc.perform(asUser(postRequest(json(
							"title", "Geistermitglied",
							"members", List.of(ghost))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Die Autor:in gehoert nicht in die Mitgliederliste: 400 (§3.13.1)")
		void authorIsNoMember() throws Exception {
			mockMvc.perform(asUser(postRequest(json(
							"title", "Autor:in doppelt",
							"members", List.of(memberEntry(author, "Alles")))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("Autor:in")));
		}

		@Test
		@DisplayName("Dasselbe Konto zweimal als Mitglied: 400 statt Constraint-Verletzung")
		void duplicateMember() throws Exception {
			mockMvc.perform(asUser(postRequest(json(
							"title", "Doppeltes Mitglied",
							"members", List.of(
									memberEntry(member, "Frontend"),
									memberEntry(member, "Backend")))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Als Redakteur:in kann nur ein Konto mit Rolle EDITOR oder ADMIN zugewiesen "
				+ "werden: 400 (§3.3)")
		void editorMustBeEditor() throws Exception {
			mockMvc.perform(asUser(postRequest(json(
							"title", "Studi als Redaktion",
							"editorIds", List.of(otherStudent.getId().toString()))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			mockMvc.perform(asUser(postRequest(json(
							"title", "Admin als Redaktion",
							"editorIds", List.of(admin.getId().toString()))), author))
					.andExpect(status().isCreated());
		}

		@Test
		@DisplayName("Eine Autor:in mit der Rolle EDITOR weist ihrem eigenen Entwurf eine "
				+ "Redaktion zu: 201 (§5, Fussnote 3 seit Contract v60)")
		void editorAssignsOnOwnDraft() throws Exception {
			mockMvc.perform(asUser(postRequest(json("title", "Projekt der Redaktion")),
							assignedEditor))
					.andExpect(status().isCreated());

			JsonNode created = created(assignedEditor, json(
					"title", "Mit Wunschredaktion",
					"editorIds", List.of(otherEditor.getId().toString())));

			assertThat(created.get("editors")).hasSize(1);
			assertThat(created.get("editors").get(0).get("id").asText())
					.isEqualTo(otherEditor.getId().toString());
		}

		@Test
		@DisplayName("Sich selbst kann sie dabei nicht eintragen: 400 VALIDATION_FAILED mit "
				+ "eigener Meldung (§5, Fussnote 3)")
		void selfAssignmentRejected() throws Exception {
			mockMvc.perform(asUser(postRequest(json(
							"title", "Ich beurteile mich selbst",
							"editorIds", List.of(assignedEditor.getId().toString()))),
							assignedEditor))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(containsString("selbst")))
					// Das Praefix "feld: " ist Teil der Zusage: nur damit haengt die
					// Meldung im Formular am Feld editorIds (§5, Fussnote 3).
					.andExpect(jsonPath("$.message").value(startsWith("editorIds: ")));
		}

		@Test
		@DisplayName("Projektseite und Redaktion schliessen einander aus: dasselbe Konto in "
				+ "members und editorIds ergibt 400, in jeder Reihenfolge im Body (v61)")
		void memberAndEditorInOneRequest() throws Exception {
			// otherEditor traegt die Rolle EDITOR, waere als Redaktion also
			// zulaessig. Ausschlaggebend ist allein, dass er zugleich auf der
			// Projektseite steht.
			String editorsFirst = json(
					"title", "Beteiligt und zustaendig",
					"editorIds", List.of(otherEditor.getId().toString()),
					"members", List.of(memberEntry(otherEditor, "Frontend")));
			String membersFirst = json(
					"title", "Beteiligt und zustaendig",
					"members", List.of(memberEntry(otherEditor, "Frontend")),
					"editorIds", List.of(otherEditor.getId().toString()));

			for (String body : List.of(editorsFirst, membersFirst)) {
				mockMvc.perform(asUser(postRequest(body), author))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
						.andExpect(jsonPath("$.message").value(startsWith("editorIds: ")));
			}
		}

		@Test
		@DisplayName("Ohne Ueberschneidung bleibt es beim 201: dieselbe Redaktion, aber ein "
				+ "unbeteiligtes Mitglied")
		void separateMemberAndEditorPass() throws Exception {
			JsonNode created = created(author, json(
					"title", "Sauber getrennt",
					"editorIds", List.of(otherEditor.getId().toString()),
					"members", List.of(memberEntry(member, "Frontend"))));

			assertThat(created.get("editors")).hasSize(1);
			assertThat(memberIds(created)).containsExactly(member.getId().toString());
		}

		@Test
		@DisplayName("Ein Admin-Konto darf nicht anlegen: 403 NO_PERMISSION "
				+ "(§5, Fussnote 10)")
		void adminMayNotCreate() throws Exception {
			mockMvc.perform(asUser(postRequest(json("title", "Projekt der Verwaltung")), admin))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Derselbe Koerper mit STUDENT- und mit EDITOR-Token: je 201 (§5)")
		void studentAndEditorMayCreate() throws Exception {
			// Bewusst derselbe Body wie in adminMayNotCreate: der Unterschied
			// liegt allein an der Rolle, nicht am Inhalt der Anfrage.
			String body = json("title", "Projekt der Verwaltung");

			mockMvc.perform(asUser(postRequest(body), author))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.status").value("DRAFT"));

			mockMvc.perform(asUser(postRequest(body), assignedEditor))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.status").value("DRAFT"));
		}

		@Test
		@DisplayName("Ohne Token: 401 NOT_AUTHENTICATED")
		void anonymous() throws Exception {
			mockMvc.perform(postRequest(json("title", "Anonym")))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// PUT /api/projects/{id}
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/projects/{id}")
	class UpdatingMetadata {

		@Test
		@DisplayName("Die Autor:in aendert die Metadaten, version zaehlt hoch")
		void authorUpdates() throws Exception {
			long before = draft.getVersion();

			JsonNode updated = updated(author, draft, json(
					"version", before,
					"title", "Neuer Titel",
					"summary", "Neuer Teaser",
					"semesterId", semester.getId().toString()));

			assertThat(updated.get("title").asText()).isEqualTo("Neuer Titel");
			assertThat(updated.get("summary").asText()).isEqualTo("Neuer Teaser");
			assertThat(updated.get("version").asLong()).isEqualTo(before + 1);
		}

		@Test
		@DisplayName("Einzelfelder werden ersetzt: ein weggelassenes Feld wird null")
		void singleFieldsAreReplaced() throws Exception {
			draft.setSummary("Alter Teaser");
			draft.setCategory(category);
			projectRepository.saveAndFlush(draft);

			JsonNode updated = updated(author, draft, json(
					"version", draft.getVersion(),
					"title", "Ohne Beiwerk"));

			assertThat(updated.get("summary").isNull()).isTrue();
			assertThat(updated.get("category").isNull()).isTrue();
		}

		@Test
		@DisplayName("Ein neues Tag neben geaenderten Metadaten zaehlt version trotzdem "
				+ "um genau eins hoch")
		void newTagDoesNotDisturbTheVersionCounter() throws Exception {
			long vorher = draft.getVersion();

			// insertIfAbsent ist eine native Abfrage; Hibernate leert davor die
			// Session, der Flush liegt also mitten im Schreibvorgang. Die Zusage
			// aus §6.4 gilt trotzdem: ein Aufruf, ein Versionsschritt.
			JsonNode updated = updated(author, draft, json(
					"version", vorher,
					"title", "Titel und Tag zugleich",
					"summary", "Ein Teaser",
					"tags", List.of("frisch-" + UUID.randomUUID())));

			assertThat(updated.get("version").asLong()).isEqualTo(vorher + 1);
			assertThat(updated.get("title").asText()).isEqualTo("Titel und Tag zugleich");
			assertThat(updated.get("tags")).hasSize(1);
		}

		@Test
		@DisplayName("Sammlungen dagegen nicht: fehlende tags, members und editorIds bleiben, "
				+ "[] leert sie")
		void collectionsSurviveOmission() throws Exception {
			draft.getTags().add(TestMasterData.existingOrNewTag(tagRepository, "ux-test"));
			projectRepository.saveAndFlush(draft);

			JsonNode kept = updated(author, draft, json(
					"version", draft.getVersion(),
					"title", "Sammlungen unangetastet"));

			assertThat(texts(kept.get("tags"))).containsExactly("ux-test");
			assertThat(kept.get("members")).hasSize(1);
			assertThat(kept.get("editors")).hasSize(1);

			JsonNode cleared = updated(author, draft, json(
					"version", kept.get("version").asLong(),
					"title", "Sammlungen geleert",
					"tags", List.of(),
					"members", List.of(),
					"editorIds", List.of()));

			assertThat(cleared.get("tags")).isEmpty();
			assertThat(cleared.get("members")).isEmpty();
			assertThat(cleared.get("editors")).isEmpty();
		}

		@Test
		@DisplayName("Veraltete version: 409 PROJECT_VERSION_CONFLICT (§6.4)")
		void versionConflict() throws Exception {
			mockMvc.perform(asUser(putRequest(draft, json(
							"version", draft.getVersion() + 99,
							"title", "Aus einem alten Tab")), author))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.status").value(409))
					.andExpect(jsonPath("$.errorCode").value("PROJECT_VERSION_CONFLICT"))
					.andExpect(jsonPath("$.message",
							containsString("neu laden")));
		}

		@Test
		@DisplayName("Fehlende version: 400, sie gehoert in jeden schreibenden Body (§6.4)")
		void versionRequired() throws Exception {
			mockMvc.perform(asUser(putRequest(draft, json("title", "Ohne version")), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Eingereichtes Projekt: 409 PROJECT_STATUS_NOT_EDITABLE, auch fuer die "
				+ "Autor:in (§4.1)")
		void lockedStatus() throws Exception {
			Project submitted = newProject(author, ProjectStatus.SUBMITTED, "Schon eingereicht");
			submitted = projectRepository.saveAndFlush(submitted);

			mockMvc.perform(asUser(putRequest(submitted, json(
							"version", submitted.getVersion(),
							"title", "Nachtraeglich geaendert")), author))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
		}

		@Test
		@DisplayName("Unbeteiligte bekommen 403 und nicht 409, auch bei gesperrtem Status: der "
				+ "Status eines fremden Projekts geht sie nichts an")
		void strangerGets403() throws Exception {
			Project submitted = projectRepository.saveAndFlush(
					newProject(author, ProjectStatus.SUBMITTED, "Fremd und gesperrt"));

			mockMvc.perform(asUser(putRequest(draft, json(
							"version", draft.getVersion(), "title", "Fremdzugriff")), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			mockMvc.perform(asUser(putRequest(submitted, json(
							"version", submitted.getVersion(), "title", "Fremd")), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Auch die zugewiesene Redaktion aendert keine Metadaten: 403 (§6.1)")
		void assignedEditorGets403() throws Exception {
			mockMvc.perform(asUser(putRequest(draft, json(
							"version", draft.getVersion(),
							"title", "Von der Redaktion")), assignedEditor))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Unbekannte ID: 404 PROJECT_NOT_FOUND (§6.3.1)")
		void unknownProject() throws Exception {
			UUID unknown = UUID.randomUUID();

			mockMvc.perform(asUser(put("/api/projects/" + unknown)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("version", 0, "title", "Nirgends")), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ohne Token: 401")
		void anonymous() throws Exception {
			mockMvc.perform(putRequest(draft, json("version", 0, "title", "Anonym")))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// Mitglieder und Redaktion ueber PUT /api/projects/{id} (§3.13.1)
	// ==================================================================

	@Nested
	@DisplayName("Mitgliederliste und Redaktionszuweisung im PUT")
	class MembersAndEditors {

		@Test
		@DisplayName("Ein Mitglied darf ein weiteres aufnehmen und ein anderes entfernen (§3.13.1)")
		void memberManagesMembers() throws Exception {
			JsonNode added = updated(member, draft, json(
					"version", draft.getVersion(),
					"title", draft.getTitle(),
					"members", List.of(
							memberEntry(member, "Frontend"),
							memberEntry(otherStudent, "Backend"))));

			assertThat(memberIds(added)).containsExactlyInAnyOrder(
					member.getId().toString(), otherStudent.getId().toString());

			// Und wieder heraus: dasselbe Mitglied entfernt das eben aufgenommene.
			JsonNode removed = updated(member, draft, json(
					"version", added.get("version").asLong(),
					"title", draft.getTitle(),
					"members", List.of(memberEntry(member, "Frontend"))));

			assertThat(memberIds(removed)).containsExactly(member.getId().toString());
		}

		@Test
		@DisplayName("Eine reine Rollenkorrektur behaelt die Zeile und laeuft nicht in das "
				+ "unique(project_id, user_id)")
		void roleChangeKeepsRow() throws Exception {
			JsonNode updated = updated(member, draft, json(
					"version", draft.getVersion(),
					"title", draft.getTitle(),
					"members", List.of(memberEntry(member, "Backend"))));

			assertThat(updated.get("members")).hasSize(1);
			assertThat(updated.get("members").get(0).get("projectRole").asText())
					.isEqualTo("Backend");
		}

		@Test
		@DisplayName("Ein Mitglied darf editorIds nicht aendern: 403 (§3.13.1)")
		void memberMayNotChangeEditors() throws Exception {
			mockMvc.perform(asUser(putRequest(draft, json(
							"version", draft.getVersion(),
							"title", draft.getTitle(),
							"editorIds", List.of(otherEditor.getId().toString()))), member))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Schickt es die unveraenderte Liste zurueck, aendert es nichts und bekommt "
				+ "kein 403")
		void unchangedEditorsAreNoChange() throws Exception {
			JsonNode updated = updated(member, draft, json(
					"version", draft.getVersion(),
					"title", "Nur der Titel",
					"editorIds", List.of(assignedEditor.getId().toString())));

			assertThat(updated.get("title").asText()).isEqualTo("Nur der Titel");
			assertThat(updated.get("editors")).hasSize(1);
		}

		@Test
		@DisplayName("Die Autor:in aendert die Redaktion im Entwurf (§5, Fussnote 3)")
		void authorAssignsInDraft() throws Exception {
			JsonNode updated = updated(author, draft, json(
					"version", draft.getVersion(),
					"title", draft.getTitle(),
					"editorIds", List.of(otherEditor.getId().toString())));

			assertThat(updated.get("editors")).hasSize(1);
			assertThat(updated.get("editors").get(0).get("id").asText())
					.isEqualTo(otherEditor.getId().toString());
		}

		@Test
		@DisplayName("Ein Entwurf ohne Redaktion laesst sich weiterhin speichern: die Schranke "
				+ "aus §3.3 gilt dem Einreichen, nicht dem Speichern")
		void draftWithoutEditorsStillSaves() throws Exception {
			JsonNode updated = updated(author, draft, json(
					"version", draft.getVersion(),
					"title", draft.getTitle(),
					"editorIds", List.of()));

			assertThat(updated.get("editors")).isEmpty();
		}

		@Test
		@DisplayName("Ein Projektmitglied laesst sich nicht zur Redaktion machen: 400 "
				+ "VALIDATION_FAILED am Feld editorIds (§5, Fussnote 3 seit v61)")
		void memberMayNotBecomeEditor() throws Exception {
			// otherEditor wird erst Mitglied, dann als Redaktion angeboten.
			JsonNode first = updated(author, draft, json(
					"version", draft.getVersion(),
					"title", draft.getTitle(),
					"members", List.of(memberEntry(member, "Frontend"),
							memberEntry(otherEditor, "Backend"))));

			mockMvc.perform(asUser(putRequest(draft, json(
							"version", first.get("version").asLong(),
							"title", draft.getTitle(),
							"editorIds", List.of(otherEditor.getId().toString()))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(startsWith("editorIds: ")));

			// Die Pruefung wirft nach beiden Zuweisungen, also nach Mutationen am
			// verwalteten Projekt. In den Daten darf davon nichts stehen.
			//
			// Geprueft wird ausdruecklich gegen die Datenbank und nicht ueber ein
			// GET: Test und Endpoint teilen sich hier einen Persistenzkontext, in
			// dem die verworfene Aenderung noch als schmutziger Zustand haengt.
			// In Produktion hat jede Anfrage ihren eigenen Kontext, dort raeumt
			// das Rollback ihn ab. clear() loest genau diesen Unterschied auf: es
			// verwirft den Sitzungszustand ohne zu flushen, die anschliessende
			// Abfrage zeigt also, was tatsaechlich geschrieben wurde. Waere vor
			// dem Wurf ein saveAndFlush, schlaege der Test hier fehl.
			entityManager.clear();

			Project reloaded = projectRepository.findWithReferencesById(draft.getId())
					.orElseThrow();
			assertThat(reloaded.getEditors()).extracting(User::getId)
					.containsExactly(assignedEditor.getId());
		}

		@Test
		@DisplayName("Und die Gegenrichtung ebenso: die zugewiesene Redaktion nachtraeglich als "
				+ "Mitglied eintragen ergibt 400 am Feld members")
		void editorMayNotBecomeMember() throws Exception {
			mockMvc.perform(asUser(putRequest(draft, json(
							"version", draft.getVersion(),
							"title", draft.getTitle(),
							"members", List.of(memberEntry(member, "Frontend"),
									memberEntry(assignedEditor, "Backend")))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(startsWith("members: ")));
		}

		@Test
		@DisplayName("Entstehen mehrere Ueberschneidungen auf verschiedenen Wegen, nennt die "
				+ "Meldung editorIds und nicht zufaellig eines der beiden Felder")
		void mixedOverlapNamesEditorIds() throws Exception {
			// Zwei Ueberschneidungen in einem Request, auf verschiedenen Wegen:
			// otherEditor ist schon Redaktion und wird jetzt Mitglied (Weg
			// members), das Admin-Konto ist schon Mitglied und wird jetzt
			// Redaktion (Weg editorIds). Ein Admin darf als Redaktion zugewiesen
			// werden (§3.3), taugt hier also als zweites Konto. Die
			// Feldbestimmung darf nicht von der Mengenreihenfolge abhaengen.
			draft.getEditors().add(otherEditor);
			draft = projectRepository.saveAndFlush(draft);
			draft.getMembers().add(projectMemberRepository.saveAndFlush(
					TestProject.memberWithoutId(draft, admin, "Betreuung")));

			mockMvc.perform(asUser(putRequest(draft, json(
							"version", draft.getVersion(),
							"title", draft.getTitle(),
							"members", List.of(memberEntry(member, "Frontend"),
									memberEntry(admin, "Betreuung"),
									memberEntry(otherEditor, "Backend")),
							"editorIds", List.of(assignedEditor.getId().toString(),
									otherEditor.getId().toString(),
									admin.getId().toString()))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(startsWith("editorIds: ")));
		}

		@Test
		@DisplayName("Eine bestehende Ueberschneidung blockiert kein Speichern, solange die "
				+ "Aenderung sie nicht vergroessert (Bestandsdaten)")
		void existingOverlapDoesNotBlock() throws Exception {
			// Bewusst an den Endpoints vorbei aufgebaut: seit v61 laesst der
			// Server diesen Zustand gar nicht erst entstehen. Bestandsdaten
			// tragen ihn trotzdem, und sie sollen speicherbar bleiben.
			draft.getEditors().add(otherEditor);
			draft = projectRepository.saveAndFlush(draft);
			draft.getMembers().add(projectMemberRepository.saveAndFlush(
					TestProject.memberWithoutId(draft, otherEditor, "Backend")));

			JsonNode updated = updated(author, draft, json(
					"version", draft.getVersion(),
					"title", "Nur der Titel"));

			assertThat(updated.get("title").asText()).isEqualTo("Nur der Titel");
			assertThat(updated.get("editors")).hasSize(2);
		}

		@Test
		@DisplayName("In REVISION ebenfalls: beide Arbeitszustaende zaehlen (§5, Fussnote 3 "
				+ "seit Contract v62)")
		void authorAssignsInRevision() throws Exception {
			Project revision = projectRepository.saveAndFlush(
					newProject(author, ProjectStatus.REVISION, "Zurueckgegeben"));

			// Metadaten aendern darf sie hier ohnehin.
			JsonNode first = updated(author, revision, json(
					"version", revision.getVersion(), "title", "Ueberarbeitet"));

			// Die neue version kommt aus der Antwort und nicht aus der Entity:
			// Test und Endpoint teilen sich den Persistenzkontext, die Instanz
			// traegt also bereits den hochgezaehlten Stand.
			JsonNode second = updated(author, revision, json(
					"version", first.get("version").asLong(),
					"title", "Ueberarbeitet",
					"editorIds", List.of(otherEditor.getId().toString())));

			assertThat(second.get("editors")).hasSize(1);
			assertThat(second.get("editors").get(0).get("id").asText())
					.isEqualTo(otherEditor.getId().toString());
		}

		@Test
		@DisplayName("Ab SUBMITTED nicht mehr: der Weg fuehrt ueber den Admin-Endpoint")
		void authorMayNotAssignAfterSubmit() throws Exception {
			Project submitted = projectRepository.saveAndFlush(
					newProject(author, ProjectStatus.SUBMITTED, "In Pruefung"));

			// 409 und nicht 403: die Metadaten sind ab hier ohnehin gesperrt
			// (§4.1), und der Statuskonflikt wird zuerst gemeldet. Dieser Test
			// belegt damit die Sperre des ganzen PUT; dass die Zuweisungsregel
			// selbst ab SUBMITTED zumacht, traegt
			// ProjectPermissionServiceTest.assignEditors.
			mockMvc.perform(asUser(putRequest(submitted, json(
							"version", submitted.getVersion(),
							"title", "In Pruefung",
							"editorIds", List.of(otherEditor.getId().toString()))), author))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
		}
	}

	// ==================================================================
	// PUT /api/projects/{id}/editors
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/projects/{id}/editors")
	class ReassigningEditors {

		@Test
		@DisplayName("Der Admin verteilt um, auch bei einem eingereichten Projekt (§6.1)")
		void adminReassignsInAnyStatus() throws Exception {
			Project submitted = projectRepository.saveAndFlush(
					newProject(author, ProjectStatus.SUBMITTED, "In Pruefung"));
			submitted.getEditors().add(assignedEditor);
			projectRepository.saveAndFlush(submitted);

			JsonNode updated = objectMapper.readTree(body(asUser(
					editorsRequest(submitted, List.of(otherEditor.getId().toString())), admin)));

			assertThat(updated.get("editors")).hasSize(1);
			assertThat(updated.get("editors").get(0).get("id").asText())
					.isEqualTo(otherEditor.getId().toString());
			// Der Status bleibt unberuehrt, der Endpoint aendert nur die Zuweisung.
			assertThat(updated.get("status").asText()).isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Eine leere Liste hebt die Zuweisung auf")
		void emptyListClears() throws Exception {
			JsonNode updated = objectMapper.readTree(
					body(asUser(editorsRequest(draft, List.of()), admin)));

			assertThat(updated.get("editors")).isEmpty();
		}

		@Test
		@DisplayName("Autor:in und Redaktion bekommen 403, der Endpoint bleibt Admin-only")
		void othersGet403() throws Exception {
			for (User user : List.of(author, member, assignedEditor, otherStudent)) {
				mockMvc.perform(asUser(
								editorsRequest(draft, List.of(otherEditor.getId().toString())),
								user))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@Test
		@DisplayName("Auch hier gilt die Trennung: ein Projektmitglied laesst sich nicht "
				+ "zuweisen, 400 (§5, Fussnote 3 seit v61)")
		void memberMayNotBeAssignedHereEither() throws Exception {
			draft.getMembers().add(projectMemberRepository.saveAndFlush(
					TestProject.memberWithoutId(draft, otherEditor, "Backend")));

			mockMvc.perform(asUser(
							editorsRequest(draft, List.of(otherEditor.getId().toString())), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(startsWith("editorIds: ")));
		}

		@Test
		@DisplayName("Die Autor:in ebenso wenig, auch wenn sie selbst die Rolle EDITOR traegt")
		void authorMayNotBeAssignedHere() throws Exception {
			Project ownDraft = projectRepository.saveAndFlush(
					newProject(assignedEditor, ProjectStatus.DRAFT, "Projekt der Redaktion"));

			mockMvc.perform(asUser(
							editorsRequest(ownDraft, List.of(assignedEditor.getId().toString())),
							admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(startsWith("editorIds: ")));
		}

		@Test
		@DisplayName("Eine bestehende Ueberschneidung raeumt der Admin hier weiterhin auf: sie "
				+ "wird nicht groesser, sondern kleiner")
		void adminMayResolveAnExistingOverlap() throws Exception {
			draft.getEditors().add(otherEditor);
			draft = projectRepository.saveAndFlush(draft);
			draft.getMembers().add(projectMemberRepository.saveAndFlush(
					TestProject.memberWithoutId(draft, otherEditor, "Backend")));

			JsonNode updated = objectMapper.readTree(body(asUser(
					editorsRequest(draft, List.of(assignedEditor.getId().toString())), admin)));

			assertThat(updated.get("editors")).hasSize(1);
			assertThat(updated.get("editors").get(0).get("id").asText())
					.isEqualTo(assignedEditor.getId().toString());
		}

		@Test
		@DisplayName("Unbekannte Projekt-ID: 404, unbekanntes Konto im Body: 400")
		void notFoundVersusBadRequest() throws Exception {
			mockMvc.perform(asUser(put("/api/projects/" + UUID.randomUUID() + "/editors")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("editorIds", List.of())), admin))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			mockMvc.perform(asUser(
							editorsRequest(draft, List.of(UUID.randomUUID().toString())), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ohne Token: 401")
		void anonymous() throws Exception {
			mockMvc.perform(editorsRequest(draft, List.of()))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// DELETE /api/projects/{id}
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/projects/{id}")
	class Deleting {

		@Test
		@DisplayName("Die Autor:in loescht ihren Entwurf: 204, abhaengige Zeilen fallen per "
				+ "Cascade")
		void authorDeletesDraft() throws Exception {
			UUID projectId = draft.getId();
			blockRepository.saveAndFlush(TestProject.blockWithoutId(
					draft, BlockType.TEXT, 0, prosemirror()));
			statusHistoryRepository.saveAndFlush(TestProject.historyWithoutId(
					draft, null, ProjectStatus.DRAFT, author, Instant.now()));

			// Den Persistenzkontext leeren, bevor geloescht wird. Test und
			// Endpoint teilen sich hier eine Session; ohne das Leeren blieben
			// Block und Historieneintrag als verwaltete Instanzen zurueck, die
			// auf das inzwischen entfernte Projekt zeigen, und der Flush
			// danach scheiterte an ihnen statt an der Sache. In Produktion
			// gibt es das nicht: dort hat jeder Request seinen eigenen
			// Kontext.
			entityManager.flush();
			entityManager.clear();

			mockMvc.perform(asUser(delete("/api/projects/" + projectId), author))
					.andExpect(status().isNoContent());

			entityManager.flush();
			entityManager.clear();

			assertThat(projectRepository.findById(projectId)).isEmpty();
			assertThat(blockRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).isEmpty();
			assertThat(projectMemberRepository.findByProjectId(projectId)).isEmpty();
			assertThat(statusHistoryRepository.findByProjectIdOrderByTimestampAsc(projectId))
					.isEmpty();
		}

		@Test
		@DisplayName("Nach dem Einreichen nicht mehr: 403, dann haengt fremde Arbeit daran")
		void authorMayNotDeleteSubmitted() throws Exception {
			Project submitted = projectRepository.saveAndFlush(
					newProject(author, ProjectStatus.SUBMITTED, "In Pruefung"));

			mockMvc.perform(asUser(delete("/api/projects/" + submitted.getId()), author))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Der Admin loescht in jedem Status, auch veroeffentlicht")
		void adminDeletesPublished() throws Exception {
			Project published = projectRepository.saveAndFlush(
					newProject(author, ProjectStatus.PUBLISHED, "Schon oeffentlich"));

			mockMvc.perform(asUser(delete("/api/projects/" + published.getId()), admin))
					.andExpect(status().isNoContent());
		}

		@Test
		@DisplayName("Mitglieder und Redaktion duerfen nicht loeschen: 403")
		void othersGet403() throws Exception {
			for (User user : List.of(member, otherStudent, assignedEditor)) {
				mockMvc.perform(asUser(delete("/api/projects/" + draft.getId()), user))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@Test
		@DisplayName("Unbekannte ID: 404, ohne Token: 401")
		void notFoundAndAnonymous() throws Exception {
			mockMvc.perform(asUser(delete("/api/projects/" + UUID.randomUUID()), admin))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			mockMvc.perform(delete("/api/projects/" + draft.getId()))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	private Project newProject(User owner, ProjectStatus status, String title) {
		return TestProject.withoutId(owner, status, title);
	}

	private JsonNode prosemirror() {
		return objectMapper.createObjectNode().put("type", "paragraph").put("text", "Inhalt");
	}

	/**
	 * Baut einen JSON-Koerper aus Paaren von Feldname und Wert.
	 *
	 * <p>Bewusst nicht ueber {@code Map.of}: die Reihenfolge waere dort
	 * unbestimmt, und vor allem laesst sich ein Feld nur weglassen, wenn der
	 * Bauplan das Weglassen zulaesst. Genau darauf kommt es hier an, weil
	 * fehlende Felder bei {@code PUT} eine eigene Bedeutung haben.
	 */
	private String json(Object... pairs) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		for (int i = 0; i + 1 < pairs.length; i += 2) {
			fields.put((String) pairs[i], pairs[i + 1]);
		}
		return objectMapper.writeValueAsString(fields);
	}

	private Map<String, Object> memberEntry(User user, String projectRole) {
		Map<String, Object> entry = new LinkedHashMap<>();
		entry.put("userId", user.getId().toString());
		entry.put("projectRole", projectRole);
		return entry;
	}

	private MockHttpServletRequestBuilder postRequest(String json) {
		return post("/api/projects").contentType(MediaType.APPLICATION_JSON).content(json);
	}

	private MockHttpServletRequestBuilder putRequest(Project project, String json) {
		return put("/api/projects/" + project.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content(json);
	}

	private MockHttpServletRequestBuilder editorsRequest(Project project, List<String> editorIds)
			throws Exception {
		return put("/api/projects/" + project.getId() + "/editors")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("editorIds", editorIds));
	}

	/** Haengt ein echtes Bearer-Token an; {@code null} laesst die Anfrage anonym. */
	private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request, User user) {
		if (user == null) {
			return request;
		}
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/** Fuehrt ein {@code POST} aus, erwartet 201 und liefert die Antwort. */
	private JsonNode created(User user, String json) throws Exception {
		String response = mockMvc.perform(asUser(postRequest(json), user))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
		return objectMapper.readTree(response);
	}

	/** Fuehrt ein {@code PUT} aus, erwartet 200 und liefert die Antwort. */
	private JsonNode updated(User user, Project project, String json) throws Exception {
		return objectMapper.readTree(body(asUser(putRequest(project, json), user)));
	}

	private String body(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private List<String> texts(JsonNode array) {
		List<String> values = new ArrayList<>();
		array.forEach(node -> values.add(node.asText()));
		return values;
	}

	private List<String> memberIds(JsonNode response) {
		List<String> ids = new ArrayList<>();
		response.get("members").forEach(node -> ids.add(node.get("userId").asText()));
		return ids;
	}
}
