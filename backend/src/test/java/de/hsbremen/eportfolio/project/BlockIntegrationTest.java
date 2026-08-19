package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
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
 * Die beiden Block-Endpoints aus §6.1 gegen die echte Datenbank: Inhalt lesen
 * und der Autosave-Pfad, jeweils mit den Rechten aus §5 und §6.1, den
 * Statusregeln aus §4.1, der Versionspruefung aus §6.4 und der Fehlerpolitik aus
 * §6.3.1.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert. Die Anmeldung laeuft ueber echte
 * Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe Filterkette
 * durchlaeuft wie in Produktion.
 *
 * <p>Die gueltigen Beispielinhalte je Blocktyp kommen aus
 * {@link BlockValidationServiceTest#VALID_CONTENT}: sie werden an einer Stelle
 * gepflegt, damit Unit- und Integrationstest nicht mit unterschiedlichen
 * Vorstellungen davon laufen, wie ein gueltiger Block aussieht.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BlockIntegrationTest {

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
	private ProjectMemberRepository projectMemberRepository;

	@Autowired
	private BlockRepository blockRepository;

	@PersistenceContext
	private EntityManager entityManager;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User admin;

	/** Entwurf der Autor:in, mit {@code member} als Mitglied und einer Redaktion. */
	private Project draft;

	@BeforeEach
	void buildData() {
		author = save(Role.STUDENT);
		member = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		draft = TestProject.withoutId(author, ProjectStatus.DRAFT, "Gruppenarbeit");
		draft.getEditors().add(assignedEditor);
		draft = projectRepository.saveAndFlush(draft);
		// Wie in den uebrigen Projekt-Tests: die Zeile steht in der Datenbank,
		// die Sammlung des bereits verwalteten Projekts kennt sie noch nicht.
		draft.getMembers().add(projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(draft, member, "Frontend")));
	}

	// ==================================================================
	// GET /api/projects/{id}/blocks
	// ==================================================================

	@Nested
	@DisplayName("GET /api/projects/{id}/blocks")
	class Reading {

		@Test
		@DisplayName("Veroeffentlichtes Projekt ohne Token: 200, geordnet nach orderIndex, mit "
				+ "version")
		void publishedIsPublic() throws Exception {
			Project published = projectRepository.saveAndFlush(
					TestProject.withoutId(author, ProjectStatus.PUBLISHED, "Schon oeffentlich"));
			// Absichtlich in umgekehrter Reihenfolge gespeichert: die Antwort
			// darf nicht von der Einfuegereihenfolge abhaengen.
			blockRepository.saveAndFlush(TestProject.blockWithoutId(
					published, BlockType.DIVIDER, 1, content(BlockType.DIVIDER)));
			blockRepository.saveAndFlush(TestProject.blockWithoutId(
					published, BlockType.HEADING, 0, content(BlockType.HEADING)));

			JsonNode response = readBlocks(published, null);

			assertThat(types(response)).containsExactly("HEADING", "DIVIDER");
			assertThat(orderIndexes(response)).containsExactly(0, 1);
			assertThat(response.get("version").asLong()).isEqualTo(published.getVersion());
		}

		@Test
		@DisplayName("Ein Projekt ohne Bloecke antwortet mit leerer Liste, nicht mit 404")
		void emptyContent() throws Exception {
			JsonNode response = readBlocks(draft, author);

			assertThat(response.get("blocks")).isEmpty();
			assertThat(response.get("version").asLong()).isZero();
		}

		@Test
		@DisplayName("Projektseite und Admin sehen den Entwurf, die zugewiesene Redaktion erst "
				+ "ab der Einreichung (§5 Fussnote 11, v42)")
		void projectSideAndStaffMayRead() throws Exception {
			for (User user : List.of(author, member, admin)) {
				assertThat(readBlocks(draft, user).get("blocks")).isEmpty();
			}

			// Zugewiesen, aber noch DRAFT: der Entwurf bleibt Privatsache der
			// Projektseite.
			mockMvc.perform(asUser(blocksRequest(draft), assignedEditor))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Fremder Entwurf ohne Token: 401, angemeldet ohne Leserecht: 403, unbekannte "
				+ "ID: 404 (§6.3.1)")
		void errorPolicy() throws Exception {
			mockMvc.perform(blocksRequest(draft))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(asUser(blocksRequest(draft), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			mockMvc.perform(asUser(get(blocksPath(UUID.randomUUID())), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}
	}

	// ==================================================================
	// PUT /api/projects/{id}/blocks: der Autosave-Pfad
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/projects/{id}/blocks: Speichern")
	class Saving {

		@Test
		@DisplayName("Round-Trip ueber alle vierzehn Blocktypen: gespeichert und unveraendert "
				+ "wieder gelesen")
		void roundTripOverEveryBlockType() throws Exception {
			List<Map<String, Object>> requested = new ArrayList<>();
			BlockType[] types = BlockType.values();
			for (int i = 0; i < types.length; i++) {
				requested.add(blockEntry(null, types[i], i));
			}

			JsonNode saved = save(author, draft, 0L, requested);

			assertThat(types(saved))
					.containsExactly(Arrays.stream(types).map(Enum::name).toArray(String[]::new));
			assertThat(orderIndexes(saved)).containsExactlyElementsOf(indexes(types.length));

			// content geht unveraendert heraus: es ist der ProseMirror-Knoten des
			// Editors (§2.5). Jede Umformung waere eine zweite Schemadefinition.
			for (int i = 0; i < types.length; i++) {
				assertThat(saved.get("blocks").get(i).get("content"))
						.isEqualTo(content(types[i]));
			}

			// Und dasselbe noch einmal ueber den Lesepfad.
			JsonNode reread = readBlocks(draft, author);
			assertThat(reread.get("blocks")).isEqualTo(saved.get("blocks"));
		}

		/**
		 * Die aktuelle Schemaversion ist seit Contract v51 die 2 und nicht mehr
		 * die 1 (§2.10, in dessen Text nachgetragen mit v56; der Spaltendefault
		 * bleibt bewusst die 1 und beschreibt den Bestand davor): was ueber
		 * diesen Endpoint hereinkommt, ist gerade gegen die
		 * geltende Validierung geprueft worden und liegt damit in der aktuellen
		 * Form vor.
		 */
		@Test
		@DisplayName("schemaVersion: ohne Angabe gilt die aktuelle Version, ein hoeherer "
				+ "mitgeschickter Wert wird uebernommen")
		void schemaVersionDefaultsToCurrent() throws Exception {
			Map<String, Object> withVersion = blockEntry(null, BlockType.TEXT, 1);
			withVersion.put("schemaVersion", 3);

			JsonNode saved = save(author, draft, 0L,
					List.of(blockEntry(null, BlockType.HEADING, 0), withVersion));

			assertThat(saved.get("blocks").get(0).get("schemaVersion").asInt())
					.isEqualTo(BlockSchemaMigration.CURRENT_VERSION);
			assertThat(saved.get("blocks").get(1).get("schemaVersion").asInt()).isEqualTo(3);
		}

		/**
		 * Ein aus Contract v50 stammender Block wird beim Lesen in die aktuelle
		 * Form gebracht (§2.10). Die Zeile selbst bleibt unangetastet: die
		 * Migration laeuft im Lesepfad, nicht als Rueckschreiben.
		 */
		@Test
		@DisplayName("Ein Block der Schemaversion 1 kommt migriert aus dem GET zurueck")
		void oldSchemaVersionIsMigratedOnRead() throws Exception {
			ObjectNode attrs = objectMapper.createObjectNode();
			attrs.set("fileIds", objectMapper.createArrayNode()
					.add("3f1c9a52-0c1e-4a1f-9a3e-2f1d5c7b8e10"));
			Block stored = TestProject.blockWithoutId(draft, BlockType.GALLERY, 0,
					node("galleryBlock", attrs));
			stored.setSchemaVersion(1);
			blockRepository.saveAndFlush(stored);
			UUID storedId = stored.getId();
			entityManager.flush();
			entityManager.clear();

			JsonNode response = readBlocks(draft, author);
			JsonNode block = response.get("blocks").get(0);

			assertThat(block.get("schemaVersion").asInt())
					.isEqualTo(BlockSchemaMigration.CURRENT_VERSION);
			JsonNode items = block.path("content").path("attrs").path("items");
			assertThat(items).hasSize(1);
			assertThat(items.get(0).path("fileId").asText())
					.isEqualTo("3f1c9a52-0c1e-4a1f-9a3e-2f1d5c7b8e10");
			assertThat(items.get(0).path("alt").asText()).isEmpty();
			assertThat(block.path("content").path("attrs").has("fileIds")).isFalse();

			// Die gespeicherte Zeile bleibt, wie sie war.
			entityManager.clear();
			Block reloaded = blockRepository.findById(storedId).orElseThrow();
			assertThat(reloaded.getSchemaVersion()).isEqualTo(1);
			assertThat(reloaded.getContent().path("attrs").has("fileIds")).isTrue();
		}

		@Test
		@DisplayName("Der Upsert erhaelt vorhandene IDs: derselbe Block behaelt seine UUID, "
				+ "nicht mehr enthaltene verschwinden")
		void upsertKeepsExistingIds() throws Exception {
			JsonNode first = save(author, draft, 0L, List.of(
					blockEntry(null, BlockType.HEADING, 0),
					blockEntry(null, BlockType.TEXT, 1),
					blockEntry(null, BlockType.DIVIDER, 2)));

			UUID headingId = id(first, 0);
			UUID textId = id(first, 1);
			UUID dividerId = id(first, 2);

			// Zweiter Autosave-Takt: der Text aendert sich, der Trenner faellt
			// weg, ein Zitat kommt hinzu.
			Map<String, Object> changedText = blockEntry(textId, BlockType.TEXT, 1);
			changedText.put("content", node("paragraph", objectMapper.createObjectNode()
					.put("textAlign", "center")));

			JsonNode second = save(author, draft, first.get("version").asLong(), List.of(
					blockEntry(headingId, BlockType.HEADING, 0),
					changedText,
					blockEntry(null, BlockType.QUOTE, 2)));

			assertThat(id(second, 0)).isEqualTo(headingId);
			assertThat(id(second, 1)).isEqualTo(textId);
			assertThat(id(second, 2)).isNotIn(headingId, textId, dividerId);
			assertThat(second.get("blocks").get(1).get("content").get("attrs").get("textAlign")
					.asText()).isEqualTo("center");

			// Der geloeschte Block ist wirklich weg, nicht nur aus der Antwort.
			assertThat(blockRepository.findById(dividerId)).isEmpty();
			assertThat(blockRepository.findByProjectIdOrderByOrderIndexAsc(draft.getId()))
					.hasSize(3);
		}

		@Test
		@DisplayName("Zwei Bloecke tauschen die Plaetze: der Zwischenzustand traegt, weil der "
				+ "Unique-Constraint deferrable ist (§3.4)")
		void swappingTwoBlocksIsAllowed() throws Exception {
			JsonNode first = save(author, draft, 0L, List.of(
					blockEntry(null, BlockType.HEADING, 0),
					blockEntry(null, BlockType.TEXT, 1)));

			UUID headingId = id(first, 0);
			UUID textId = id(first, 1);

			JsonNode swapped = save(author, draft, first.get("version").asLong(), List.of(
					blockEntry(textId, BlockType.TEXT, 0),
					blockEntry(headingId, BlockType.HEADING, 1)));

			assertThat(id(swapped, 0)).isEqualTo(textId);
			assertThat(id(swapped, 1)).isEqualTo(headingId);

			// Der Test rollt am Ende zurueck und wuerde die aufgeschobene
			// Pruefung damit nie ausloesen. Diese Zeile zieht sie vor: sie
			// prueft alle deferred Constraints sofort und faellt um, falls in
			// der Tabelle noch zwei Bloecke denselben orderIndex tragen.
			entityManager.flush();
			entityManager.createNativeQuery("set constraints all immediate").executeUpdate();
		}

		@Test
		@DisplayName("Eine leere Liste loescht den gesamten Inhalt")
		void emptyListClearsContent() throws Exception {
			JsonNode first = save(author, draft, 0L, List.of(
					blockEntry(null, BlockType.HEADING, 0),
					blockEntry(null, BlockType.TEXT, 1)));

			JsonNode cleared = save(author, draft, first.get("version").asLong(), List.of());

			assertThat(cleared.get("blocks")).isEmpty();
			assertThat(blockRepository.findByProjectIdOrderByOrderIndexAsc(draft.getId()))
					.isEmpty();
		}

		@Test
		@DisplayName("Jeder Autosave erhoeht version und updatedAt, obwohl sich nur Bloecke "
				+ "aendern")
		void versionAndTimestampMoveWithTheContent() throws Exception {
			Instant before = draft.getUpdatedAt();

			JsonNode first = save(author, draft, 0L, List.of(blockEntry(null, BlockType.TEXT, 0)));
			assertThat(first.get("version").asLong()).isEqualTo(1L);

			JsonNode second = save(author, draft, 1L, List.of(
					blockEntry(id(first, 0), BlockType.TEXT, 0),
					blockEntry(null, BlockType.DIVIDER, 1)));
			assertThat(second.get("version").asLong()).isEqualTo(2L);

			// Ohne das Nachziehen von updatedAt fiele ein Projekt, an dem lange
			// geschrieben wurde, in der Standardsortierung von GET /api/projects
			// nach hinten.
			assertThat(draft.getUpdatedAt()).isAfterOrEqualTo(before);
			assertThat(draft.getVersion()).isEqualTo(2L);
		}

		@Test
		@DisplayName("Auch ein Projektmitglied darf speichern (§3.13)")
		void memberMaySave() throws Exception {
			JsonNode saved = save(member, draft, 0L, List.of(blockEntry(null, BlockType.TEXT, 0)));

			assertThat(saved.get("blocks")).hasSize(1);
		}
	}

	// ==================================================================
	// PUT: Rechte, Status und Version
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/projects/{id}/blocks: Rechte, Status und Version")
	class Guarding {

		@Test
		@DisplayName("Nur die Projektseite schreibt: Redaktion, Admin und Fremde bekommen 403 "
				+ "(§6.1)")
		void onlyTheProjectSideMayWrite() throws Exception {
			for (User user : List.of(assignedEditor, admin, otherStudent)) {
				mockMvc.perform(asUser(saveRequest(draft, 0L,
								List.of(blockEntry(null, BlockType.TEXT, 0))), user))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@Test
		@DisplayName("Ein eingereichtes Projekt ist gesperrt: 409 PROJECT_STATUS_NOT_EDITABLE "
				+ "(§4.1)")
		void submittedIsLocked() throws Exception {
			Project submitted = projectRepository.saveAndFlush(
					TestProject.withoutId(author, ProjectStatus.SUBMITTED, "In Pruefung"));

			mockMvc.perform(asUser(saveRequest(submitted, 0L,
							List.of(blockEntry(null, BlockType.TEXT, 0))), author))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
		}

		@Test
		@DisplayName("Unbeteiligte bekommen auch bei gesperrtem Status 403 und nicht 409: der "
				+ "Status eines fremden Projekts geht sie nichts an")
		void outsidersNeverLearnTheStatus() throws Exception {
			Project submitted = projectRepository.saveAndFlush(
					TestProject.withoutId(author, ProjectStatus.SUBMITTED, "In Pruefung"));

			mockMvc.perform(asUser(saveRequest(submitted, 0L, List.of()), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Veraltete version: 409 PROJECT_VERSION_CONFLICT (§6.4)")
		void staleVersion() throws Exception {
			mockMvc.perform(asUser(saveRequest(draft, 7L,
							List.of(blockEntry(null, BlockType.TEXT, 0))), author))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_VERSION_CONFLICT"));

			assertThat(blockRepository.findByProjectIdOrderByOrderIndexAsc(draft.getId()))
					.isEmpty();
		}

		@Test
		@DisplayName("Ohne Token: 401, unbekannte Projekt-ID: 404")
		void anonymousAndUnknownProject() throws Exception {
			mockMvc.perform(saveRequest(draft, 0L, List.of()))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(asUser(put(blocksPath(UUID.randomUUID()))
							.contentType(MediaType.APPLICATION_JSON)
							.content(body(0L, List.of())), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}
	}

	// ==================================================================
	// PUT: die 400er aus §6.2
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/projects/{id}/blocks: Validierung")
	class Rejecting {

		@Test
		@DisplayName("Unbekannter Blocktyp: 400 BLOCK_TYPE_UNKNOWN")
		void unknownBlockType() throws Exception {
			Map<String, Object> entry = blockEntry(null, BlockType.TEXT, 0);
			entry.put("type", "TASKLIST");

			expect400(entry, "BLOCK_TYPE_UNKNOWN");
		}

		@Test
		@DisplayName("content passt nicht zum type: 400 BLOCK_CONTENT_INVALID")
		void contentDoesNotMatchType() throws Exception {
			Map<String, Object> entry = blockEntry(null, BlockType.TEXT, 0);
			entry.put("content", content(BlockType.HEADING));

			expect400(entry, "BLOCK_CONTENT_INVALID");
		}

		@Test
		@DisplayName("Gesperrte Einbettungsquelle: 400 EMBED_PROVIDER_NOT_ALLOWED (§2.5)")
		void blockedEmbedProvider() throws Exception {
			Map<String, Object> entry = blockEntry(null, BlockType.EMBED, 0);
			entry.put("content", node("embedBlock", objectMapper.createObjectNode()
					.put("provider", "irgendwo")
					.put("embedUrl", "https://beliebig.example.org/eingebettet")));

			expect400(entry, "EMBED_PROVIDER_NOT_ALLOWED");
		}

		@Test
		@DisplayName("Luecke in orderIndex: 400 VALIDATION_FAILED")
		void gapInOrderIndex() throws Exception {
			mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(
							blockEntry(null, BlockType.HEADING, 0),
							blockEntry(null, BlockType.TEXT, 2))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Doppelter orderIndex: 400 VALIDATION_FAILED, nicht erst der "
				+ "Datenbankfehler")
		void duplicateOrderIndex() throws Exception {
			mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(
							blockEntry(null, BlockType.HEADING, 0),
							blockEntry(null, BlockType.TEXT, 0))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("orderIndex beginnt nicht bei 0: 400 VALIDATION_FAILED")
		void orderIndexDoesNotStartAtZero() throws Exception {
			mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(
							blockEntry(null, BlockType.HEADING, 1))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Eine id aus einem fremden Projekt: 400, der fremde Block bleibt, wo er ist")
		void foreignBlockId() throws Exception {
			Project other = projectRepository.saveAndFlush(
					TestProject.withoutId(otherStudent, ProjectStatus.DRAFT, "Fremder Entwurf"));
			Block foreign = blockRepository.saveAndFlush(TestProject.blockWithoutId(
					other, BlockType.TEXT, 0, content(BlockType.TEXT)));

			expect400(blockEntry(foreign.getId(), BlockType.TEXT, 0), "VALIDATION_FAILED");

			assertThat(blockRepository.findById(foreign.getId()))
					.get()
					.extracting(block -> block.getProject().getId())
					.isEqualTo(other.getId());
		}

		@Test
		@DisplayName("Dieselbe id zweimal in einer Liste: 400 VALIDATION_FAILED")
		void duplicateBlockId() throws Exception {
			JsonNode first = save(author, draft, 0L,
					List.of(blockEntry(null, BlockType.TEXT, 0)));
			UUID textId = id(first, 0);

			mockMvc.perform(asUser(saveRequest(draft, first.get("version").asLong(), List.of(
							blockEntry(textId, BlockType.TEXT, 0),
							blockEntry(textId, BlockType.TEXT, 1))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Fehlende version und fehlende blocks: je 400 VALIDATION_FAILED")
		void missingFields() throws Exception {
			mockMvc.perform(asUser(rawRequest(draft, "{\"blocks\":[]}"), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			mockMvc.perform(asUser(rawRequest(draft, "{\"version\":0}"), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Pflichtfelder eines einzelnen Blocks werden mitgeprueft: 400 statt eines "
				+ "Fehlers aus dem Persistenzlayer")
		void nestedFieldsAreValidated() throws Exception {
			Map<String, Object> withoutType = blockEntry(null, BlockType.TEXT, 0);
			withoutType.remove("type");

			Map<String, Object> withoutOrderIndex = blockEntry(null, BlockType.TEXT, 0);
			withoutOrderIndex.remove("orderIndex");

			Map<String, Object> negativeOrderIndex = blockEntry(null, BlockType.TEXT, 0);
			negativeOrderIndex.put("orderIndex", -1);

			for (Map<String, Object> entry
					: List.of(withoutType, withoutOrderIndex, negativeOrderIndex)) {
				mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(entry)), author))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
			}
		}

		@Test
		@DisplayName("Unlesbarer Body antwortet im Envelope aus §6.2 und nicht in Springs "
				+ "eigenem Format")
		void unreadableBodyStaysInTheEnvelope() throws Exception {
			mockMvc.perform(asUser(rawRequest(draft, "{\"version\": 0, \"blocks\": ["), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.timestamp").exists())
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.path").value(blocksPath(draft.getId())));
		}

		/**
		 * Der Angriffsfall aus Befund C3 am ganzen Weg: ein Skript-Link im
		 * zweiten von drei Bloecken. Ohne die Mark-Pruefung liefe er durch,
		 * laege dauerhaft in der Datenbank und erschiene auf der oeffentlichen
		 * Projektdetailseite, die ohne Anmeldung erreichbar ist.
		 *
		 * <p>Geprueft wird zusaetzlich, dass danach nichts halb geschrieben
		 * ist: die Pruefung laeuft ueber die gesamte Liste, bevor die erste
		 * Zeile faellt, und {@code project.version} bewegt sich nicht.
		 */
		@Test
		@DisplayName("Skript-Link im zweiten von drei Bloecken: 400 im Envelope, Blockliste "
				+ "und version unveraendert")
		void hostileLinkIsRejectedAcrossTheWholeRequest() throws Exception {
			Map<String, Object> withScript = blockEntry(null, BlockType.TEXT, 1);
			withScript.put("content", paragraphWithLink("javascript:alert(document.cookie)"));

			mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(
							blockEntry(null, BlockType.HEADING, 0),
							withScript,
							blockEntry(null, BlockType.QUOTE, 2))), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("BLOCK_CONTENT_INVALID"))
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.timestamp").exists())
					.andExpect(jsonPath("$.path").value(blocksPath(draft.getId())));

			assertThat(blockRepository.findByProjectIdOrderByOrderIndexAsc(draft.getId()))
					.isEmpty();
			assertThat(draft.getVersion()).isZero();
		}

		/**
		 * Dasselbe Dokument mit {@code https} geht durch, und der Link steht
		 * unveraendert in der gespeicherten Struktur: der Server filtert, er
		 * schreibt nicht um (§3.4).
		 */
		@Test
		@DisplayName("Derselbe Aufbau mit https: 200, der Link steht unveraendert in der "
				+ "gespeicherten Struktur")
		void safeLinkSurvivesTheRoundTrip() throws Exception {
			String href = "https://www.hs-bremen.de/fk4";
			Map<String, Object> withLink = blockEntry(null, BlockType.TEXT, 1);
			withLink.put("content", paragraphWithLink(href));

			mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(
							blockEntry(null, BlockType.HEADING, 0),
							withLink,
							blockEntry(null, BlockType.QUOTE, 2))), author))
					.andExpect(status().isOk());

			entityManager.flush();
			entityManager.clear();

			String stored = mockMvc.perform(asUser(blocksRequest(draft), author))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
			JsonNode blocks = objectMapper.readTree(stored);

			JsonNode mark = blocks.path("blocks").get(1).path("content").path("content").get(0)
					.path("marks").get(0);
			assertThat(mark.path("type").asText()).isEqualTo("link");
			assertThat(mark.path("attrs").path("href").asText()).isEqualTo(href);
		}

		@Test
		@DisplayName("Ein ungueltiger Block am Ende laesst nichts halb Gespeichertes zurueck")
		void nothingIsWrittenBeforeTheListIsChecked() throws Exception {
			Map<String, Object> broken = blockEntry(null, BlockType.IMAGE, 1);
			broken.put("content", node("imageBlock", objectMapper.createObjectNode()
					.put("alt", "ohne fileId")));

			mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(
							blockEntry(null, BlockType.HEADING, 0),
							broken)), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("BLOCK_CONTENT_INVALID"));

			assertThat(blockRepository.findByProjectIdOrderByOrderIndexAsc(draft.getId()))
					.isEmpty();
			assertThat(draft.getVersion()).isZero();
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	private static String blocksPath(UUID projectId) {
		return "/api/projects/" + projectId + "/blocks";
	}

	private JsonNode content(BlockType type) {
		return BlockValidationServiceTest.VALID_CONTENT.get(type);
	}

	private JsonNode node(String nodeType, JsonNode attrs) {
		return objectMapper.createObjectNode().put("type", nodeType).set("attrs", attrs);
	}

	/**
	 * Ein Absatz mit einem Textknoten, der ein {@code link}-Mark auf diese
	 * Adresse traegt: die Form, in der Tiptap einen Link schickt (§2.5, Links
	 * sind Marks und keine Bloecke).
	 */
	private JsonNode paragraphWithLink(String href) {
		ObjectNode mark = objectMapper.createObjectNode().put("type", "link");
		mark.set("attrs", objectMapper.createObjectNode().put("href", href));

		ObjectNode text = objectMapper.createObjectNode()
				.put("type", "text").put("text", "hier klicken");
		text.set("marks", objectMapper.createArrayNode().add(mark));

		ObjectNode paragraph = objectMapper.createObjectNode().put("type", "paragraph");
		paragraph.set("attrs", objectMapper.createObjectNode().put("textAlign", "left"));
		paragraph.set("content", objectMapper.createArrayNode().add(text));
		return paragraph;
	}

	/**
	 * Ein Block im Request-Format. {@code id} bleibt bei {@code null} weg, weil
	 * das Weglassen die Bedeutung „neuer Block" hat und nicht mit einem
	 * ausdruecklichen {@code null} verwechselt werden soll.
	 */
	private Map<String, Object> blockEntry(UUID id, BlockType type, int orderIndex) {
		Map<String, Object> entry = new LinkedHashMap<>();
		if (id != null) {
			entry.put("id", id.toString());
		}
		entry.put("type", type.name());
		entry.put("orderIndex", orderIndex);
		entry.put("content", content(type));
		return entry;
	}

	private String body(Long version, List<Map<String, Object>> blocks) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		fields.put("version", version);
		fields.put("blocks", blocks);
		return objectMapper.writeValueAsString(fields);
	}

	private MockHttpServletRequestBuilder blocksRequest(Project project) {
		return get(blocksPath(project.getId()));
	}

	private MockHttpServletRequestBuilder saveRequest(Project project, Long version,
			List<Map<String, Object>> blocks) throws Exception {
		return rawRequest(project, body(version, blocks));
	}

	private MockHttpServletRequestBuilder rawRequest(Project project, String json) {
		return put(blocksPath(project.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json);
	}

	/** Haengt ein echtes Bearer-Token an; {@code null} laesst die Anfrage anonym. */
	private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request, User user) {
		if (user == null) {
			return request;
		}
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	private JsonNode readBlocks(Project project, User user) throws Exception {
		return objectMapper.readTree(ok(asUser(blocksRequest(project), user)));
	}

	private JsonNode save(User user, Project project, Long version,
			List<Map<String, Object>> blocks) throws Exception {
		return objectMapper.readTree(ok(asUser(saveRequest(project, version, blocks), user)));
	}

	private String ok(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	/** Ein einzelner fehlerhafter Block, jeweils als einzige Zeile der Liste. */
	private void expect400(Map<String, Object> entry, String errorCode) throws Exception {
		mockMvc.perform(asUser(saveRequest(draft, 0L, List.of(entry)), author))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value(errorCode));
	}

	private UUID id(JsonNode response, int index) {
		return UUID.fromString(response.get("blocks").get(index).get("id").asText());
	}

	private List<String> types(JsonNode response) {
		List<String> values = new ArrayList<>();
		response.get("blocks").forEach(block -> values.add(block.get("type").asText()));
		return values;
	}

	private List<Integer> orderIndexes(JsonNode response) {
		List<Integer> values = new ArrayList<>();
		response.get("blocks").forEach(block -> values.add(block.get("orderIndex").asInt()));
		return values;
	}

	private List<Integer> indexes(int count) {
		List<Integer> values = new ArrayList<>();
		for (int i = 0; i < count; i++) {
			values.add(i);
		}
		return values;
	}
}
