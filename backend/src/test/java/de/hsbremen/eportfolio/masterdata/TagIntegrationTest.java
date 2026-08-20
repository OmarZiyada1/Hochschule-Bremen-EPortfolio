package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Schlagwoerter als Stammdatenzeile (§3.19, §6.1) gegen die echte Datenbank
 * (KAN-75).
 *
 * <p>Drei Zusagen stehen im Mittelpunkt. Erstens die Eindeutigkeit ueber
 * {@code lower(name)}: eine abweichende Schreibweise trifft das vorhandene Tag
 * und legt kein zweites an, und sie wird mit <em>dessen</em> Anzeigenamen
 * gespeichert. Zweitens die Vorschlagsliste: sortiert nach Verwendungszahl,
 * begrenzbar, filterbar und ohne Token erreichbar. Drittens die
 * Unveraendertheit der Projekt-Antworten: {@code tags} bleibt eine sortierte
 * Liste von Namen (§3.3).
 *
 * <p>Alle Tags dieses Tests tragen einen je Lauf gewuerfelten Namensteil, sonst
 * kollidierte der Unique-Index mit frueheren Laeufen. Die Listenpruefungen
 * filtern deshalb ueber diesen Marker und nicht ueber die Laenge der
 * Gesamtliste.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Transactional
class TagIntegrationTest {

	private static final String PATH = "/api/tags";

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
	private TagRepository tagRepository;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@PersistenceContext
	private EntityManager entityManager;

	/** Je Lauf eindeutig, damit der Unique-Index nicht mit Altbestand kollidiert. */
	private String marker;

	private User author;

	private Project draft;

	@BeforeEach
	void buildData() {
		marker = UUID.randomUUID().toString().substring(0, 8);
		author = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		draft = projectRepository.saveAndFlush(
				TestProject.withoutId(author, ProjectStatus.DRAFT, "Schlagwortprobe"));
	}

	// ==================================================================
	// GET /api/tags (PUBLIC, §6.1)
	// ==================================================================

	@Nested
	@DisplayName("Vorschlagsliste (§6.1, PUBLIC)")
	class Suggestions {

		@Test
		@DisplayName("Ohne Token 200; sortiert nach Verwendungszahl, bei Gleichstand nach Name")
		void publicAndOrderedByUsage() throws Exception {
			// "haeufig" traegt zwei Projekte, die beiden anderen je eines. Damit
			// entscheidet erst die Zahl und danach der Name.
			Project second = projectRepository.saveAndFlush(
					TestProject.withoutId(author, ProjectStatus.DRAFT, "Zweites"));
			assign(draft, "zzz-haeufig-" + marker, "aaa-selten-" + marker);
			assign(second, "zzz-haeufig-" + marker, "mmm-selten-" + marker);

			// Ueber den Marker gefiltert, nicht ueber die ganze Liste: die
			// Vorgabe von 20 Treffern und der vorhandene Bestand entschieden sonst
			// darueber, ob die drei Tags dieses Laufs ueberhaupt vorkommen.
			List<String> namesInOrder = ownNames(readAll(PATH + "?q=" + marker));

			assertThat(namesInOrder).containsExactly(
					"zzz-haeufig-" + marker,
					"aaa-selten-" + marker,
					"mmm-selten-" + marker);
			assertThat(usageOf(readAll(PATH + "?q=" + marker), "zzz-haeufig-" + marker))
					.isEqualTo(2);
		}

		@Test
		@DisplayName("Ein Tag ohne Projekt bleibt stehen und rutscht mit 0 ans Ende")
		void unusedTagsStayWithZero() throws Exception {
			assign(draft, "genutzt-" + marker);
			tagRepository.saveAndFlush(TestMasterData.tagWithoutId("verwaist-" + marker));

			List<String> namesInOrder = ownNames(readAll(PATH + "?q=" + marker));

			assertThat(namesInOrder).containsExactly("genutzt-" + marker, "verwaist-" + marker);
			assertThat(usageOf(readAll(PATH + "?q=" + marker), "verwaist-" + marker)).isZero();
		}

		@Test
		@DisplayName("q filtert ohne Ruecksicht auf Gross- und Kleinschreibung, an jeder Stelle")
		void queryFiltersCaseInsensitively() throws Exception {
			assign(draft, "Nachhaltigkeit-" + marker, "Robotik-" + marker);

			// Mit dem Marker gesucht, sonst entschiede die Vorgabe von 20 Treffern
			// und der Fremdbestand der Entwicklungsdatenbank darueber, ob der
			// eigene Tag ueberhaupt in der Antwort steht.
			List<String> hits = ownNames(readAll(PATH + "?q=HALTIGKEIT-" + marker));

			assertThat(hits).containsExactly("Nachhaltigkeit-" + marker);
		}

		@Test
		@DisplayName("q durchlaeuft dieselbe Normalform wie ein eingehendes Schlagwort")
		void queryIsNormalizedLikeAWrittenTag() throws Exception {
			assign(draft, "Green IT-" + marker);

			// Zwei Leerzeichen getippt, eines gespeichert: ohne dieselbe
			// Normalform auf beiden Wegen bliebe der Treffer aus, und die
			// Combobox boete das Wort als neu an. Der Wert geht als echter
			// Parameter hinaus und nicht in der Adresse, sonst entschiede die
			// Kodierung der Leerzeichen ueber das Ergebnis.
			String body = mockMvc.perform(get(PATH).param("q", "green  it-" + marker))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
			List<JsonNode> rows = new ArrayList<>();
			objectMapper.readTree(body).forEach(rows::add);

			assertThat(ownNames(rows)).containsExactly("Green IT-" + marker);
		}

		@Test
		@DisplayName("Die Platzhalter von like sind entwertet: q=% findet nicht alles")
		void wildcardsInQueryAreEscaped() throws Exception {
			assign(draft, "Nachhaltigkeit-" + marker);

			assertThat(ownNames(readAll(PATH + "?q=%25"))).isEmpty();
		}

		@Test
		@DisplayName("limit begrenzt die Trefferzahl, ein Wert ausserhalb ergibt 400")
		void limitBoundsTheResult() throws Exception {
			assign(draft, "eins-" + marker, "zwei-" + marker, "drei-" + marker);

			assertThat(readAll(PATH + "?limit=2&q=-" + marker)).hasSize(2);

			for (String outOfRange : List.of("0", "-1", "101")) {
				mockMvc.perform(get(PATH).param("limit", outOfRange))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
						.andExpect(jsonPath("$.path").value(PATH));
			}
		}

		@Test
		@DisplayName("Name und Verwendungszahl kommen in einer Abfrage, kein N+1")
		void oneQueryForNamesAndCounts() throws Exception {
			// Fuenf Tags an zwei Projekten: waere die Zaehlung eine Abfrage je
			// Zeile, wuechse die Zahl mit der Laenge der Liste. Genau das ist
			// die Zusage, die hier haelt.
			Project second = projectRepository.saveAndFlush(
					TestProject.withoutId(author, ProjectStatus.DRAFT, "Zweites"));
			assign(draft, "a-" + marker, "b-" + marker, "c-" + marker);
			assign(second, "a-" + marker, "d-" + marker, "e-" + marker);

			entityManager.flush();
			entityManager.clear();
			Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class)
					.getStatistics();
			statistics.clear();

			assertThat(readAll(PATH + "?q=" + marker)).hasSize(5);

			assertThat(statistics.getPrepareStatementCount())
					.as("Eine Abfrage fuer Namen und Zaehlung zusammen")
					.isEqualTo(1);
		}

		@Test
		@DisplayName("Ohne limit kommen hoechstens 20 Vorschlaege")
		void defaultLimitIsTwenty() throws Exception {
			List<String> viele = new ArrayList<>();
			for (int i = 0; i < 25; i++) {
				viele.add("massen-%02d-%s".formatted(i, marker));
			}
			viele.forEach(name -> tagRepository.save(TestMasterData.tagWithoutId(name)));
			tagRepository.flush();

			assertThat(readAll(PATH + "?q=massen-")).hasSizeLessThanOrEqualTo(20);
		}
	}

	// ==================================================================
	// Schreibweg (§3.19, PUT /api/projects/{id})
	// ==================================================================

	@Nested
	@DisplayName("Schreibweg (§3.19)")
	class Writing {

		@Test
		@DisplayName("Der Unique-Index steht auf lower(name): eine abweichende Schreibweise "
				+ "laesst sich nicht direkt einfuegen")
		void uniqueIndexIsOnLowerName() {
			tagRepository.saveAndFlush(TestMasterData.tagWithoutId("Nachhaltigkeit-" + marker));

			// Vorbei am Schreibweg, direkt auf die Tabelle: hier entscheidet
			// allein uq_tag_name_lower. Ein gewoehnliches unique (name) liesse
			// diese Zeile durch, und die Tabelle traege danach zwei Schreibweisen
			// desselben Worts.
			assertThatThrownBy(() -> tagRepository.saveAndFlush(
					TestMasterData.tagWithoutId("nachhaltigkeit-" + marker)))
					.isInstanceOf(DataIntegrityViolationException.class);
		}

		@Test
		@DisplayName("Eine abweichende Schreibweise trifft das vorhandene Tag und legt kein zweites an")
		void differentSpellingReusesTheExistingRow() throws Exception {
			String existing = "Nachhaltigkeit-" + marker;
			assign(draft, existing);
			long before = tagRepository.count();

			JsonNode updated = update(draft, "tags", List.of("nachhaltigkeit-" + marker));

			assertThat(texts(updated.get("tags")))
					.as("Gespeichert wird der vorhandene Anzeigename, nicht die getippte Schreibweise")
					.containsExactly(existing);
			assertThat(tagRepository.count())
					.as("Keine zweite Zeile fuer dieselbe Schreibweise")
					.isEqualTo(before);
		}

		@Test
		@DisplayName("Ein unbekanntes Wort legt genau eine Zeile an, in der getippten Schreibweise")
		void unknownTagCreatesExactlyOneRow() throws Exception {
			long before = tagRepository.count();

			JsonNode updated = update(draft, "tags", List.of("  Green   IT-" + marker + "  "));

			assertThat(texts(updated.get("tags")))
					.as("Getrimmt und mit zusammengezogenen inneren Leerzeichen")
					.containsExactly("Green IT-" + marker);
			assertThat(tagRepository.count()).isEqualTo(before + 1);
			assertThat(tagRepository.findByNameNormalized("green it-" + marker)).isPresent();
		}

		@Test
		@DisplayName("Zwei Schreibweisen desselben Worts in einem Aufruf ergeben einen Tag")
		void twoSpellingsInOneRequestCollapse() throws Exception {
			long before = tagRepository.count();

			JsonNode updated = update(draft, "tags",
					List.of("robotik-" + marker, "Robotik-" + marker));

			// Aufgeloest wird in sortierter Reihenfolge, deshalb gewinnt hier die
			// Grossschreibung, und zwar unabhaengig davon, wie der Request sie
			// aufzaehlt.
			assertThat(texts(updated.get("tags"))).containsExactly("Robotik-" + marker);
			assertThat(tagRepository.count()).isEqualTo(before + 1);
		}

		@Test
		@DisplayName("Ein leerer Wert ergibt 400 und legt keine Stammdatenzeile an")
		void blankValuesAreRejected() throws Exception {
			long before = tagRepository.count();

			// Die Abweisung kommt aus der Bean-Validation am Request
			// (@NotBlank je Eintrag) und nicht erst aus dem Schreibweg. Das ist
			// die Zusage aus §3.3, die §3.19 unveraendert laesst; der Filter in
			// applyTags ist die Vorsorge dahinter und nicht der Torwaechter.
			mockMvc.perform(as(author, putRequest(draft, json(
							"version", draft.getVersion(),
							"title", "Leeres Schlagwort",
							"tags", List.of("Robotik-" + marker, "   ")))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(tagRepository.count())
					.as("Die abgewiesene Anfrage legt auch das gueltige Wort nicht an")
					.isEqualTo(before);
		}

		@Test
		@DisplayName("Ein sechster Tag ergibt 400 VALIDATION_FAILED")
		void sixthTagIsRejected() throws Exception {
			List<String> sechs = List.of("a-" + marker, "b-" + marker, "c-" + marker,
					"d-" + marker, "e-" + marker, "f-" + marker);
			long before = tagRepository.count();

			mockMvc.perform(as(author, putRequest(draft, json(
							"version", draft.getVersion(),
							"title", "Zu viele Schlagwoerter",
							"tags", sechs))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(tagRepository.count())
					.as("Die abgewiesene Anfrage legt keine Stammdaten an")
					.isEqualTo(before);
		}

		@Test
		@DisplayName("tags bleibt in der Projekt-Antwort eine sortierte Liste von Namen")
		void projectResponsesKeepTheirShape() throws Exception {
			JsonNode updated = update(draft, "tags",
					List.of("zeta-" + marker, "alpha-" + marker));

			assertThat(texts(updated.get("tags")))
					.containsExactly("alpha-" + marker, "zeta-" + marker);

			JsonNode detail = objectMapper.readTree(mockMvc
					.perform(as(author, get("/api/projects/" + draft.getId())))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
			assertThat(texts(detail.get("tags")))
					.containsExactly("alpha-" + marker, "zeta-" + marker);
		}

		@Test
		@DisplayName("tags: [] leert die Zuordnung, laesst die Stammdatenzeile aber stehen")
		void emptyListClearsTheAssignmentOnly() throws Exception {
			assign(draft, "bleibt-" + marker);
			long before = tagRepository.count();

			JsonNode updated = update(draft, "tags", List.of());

			assertThat(updated.get("tags")).isEmpty();
			assertThat(tagRepository.count()).isEqualTo(before);
		}
	}

	// ------------------------------------------------------------------
	// Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Haengt Schlagwoerter unmittelbar an ein Projekt, ohne den Endpoint. Die
	 * Vorschlagsliste braucht einen Bestand, und der soll nicht davon abhaengen,
	 * dass der Schreibweg schon geprueft ist.
	 */
	private void assign(Project project, String... names) {
		Project managed = projectRepository.findById(project.getId()).orElseThrow();
		for (String name : names) {
			Tag tag = tagRepository.findByNameNormalized(name)
					.orElseGet(() -> tagRepository.saveAndFlush(TestMasterData.tagWithoutId(name)));
			managed.getTags().add(tag);
		}
		projectRepository.saveAndFlush(managed);
		// Der Endpoint liest in derselben Transaktion, aber ueber eigene
		// Abfragen; ohne den Flush stuenden die Zuordnungen noch im Schreibpuffer
		// und nicht in der Tabelle.
		entityManager.flush();
	}

	private List<JsonNode> readAll(String path) throws Exception {
		String body = mockMvc.perform(get(path))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		List<JsonNode> rows = new ArrayList<>();
		objectMapper.readTree(body).forEach(rows::add);
		return rows;
	}

	/** Nur die Tags dieses Laufs, in der Reihenfolge der Antwort. */
	private List<String> ownNames(List<JsonNode> rows) {
		return rows.stream()
				.map(row -> row.get("name").asText())
				.filter(name -> name.endsWith(marker))
				.toList();
	}

	private long usageOf(List<JsonNode> rows, String name) {
		return rows.stream()
				.filter(row -> name.equals(row.get("name").asText()))
				.mapToLong(row -> row.get("usageCount").asLong())
				.findFirst()
				.orElseThrow();
	}

	private JsonNode update(Project project, String field, Object value) throws Exception {
		Project managed = projectRepository.findById(project.getId()).orElseThrow();
		String body = mockMvc.perform(as(author, putRequest(managed, json(
						"version", managed.getVersion(),
						"title", managed.getTitle(),
						field, value))))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		return objectMapper.readTree(body);
	}

	private List<String> texts(JsonNode array) {
		List<String> values = new ArrayList<>();
		array.forEach(node -> values.add(node.asText()));
		return values;
	}

	private String json(Object... pairs) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		for (int i = 0; i + 1 < pairs.length; i += 2) {
			fields.put((String) pairs[i], pairs[i + 1]);
		}
		return objectMapper.writeValueAsString(fields);
	}

	private MockHttpServletRequestBuilder putRequest(Project project, String body) {
		return put("/api/projects/" + project.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
