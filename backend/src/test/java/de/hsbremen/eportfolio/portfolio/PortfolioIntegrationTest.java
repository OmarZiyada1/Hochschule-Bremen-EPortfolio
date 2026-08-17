package de.hsbremen.eportfolio.portfolio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectMemberRepository;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die drei Portfolio-Endpoints aus §6.1 gegen die echte Datenbank (KAN-22).
 *
 * <p>Zwei Zusagen stehen im Mittelpunkt. Erstens die Abgrenzung der beiden
 * E-Mail-Adressen aus §3.1: die private gehoert in das oeffentliche Profil, die
 * HSB-Adresse verlaesst den Server hier unter keinen Umstaenden. Geprueft wird
 * deshalb nicht nur das Feld, sondern der gesamte Antworttext, denn eine Adresse
 * schadet auch dann, wenn sie an unerwarteter Stelle im JSON auftaucht.
 * Zweitens das defensive Verhalten aus §3.2.1: eine fehlende Portfolio-Zeile
 * ergibt 200 mit leeren Feldern, und das anschliessende PUT legt sie an.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert. Die Anmeldung laeuft ueber echte
 * Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe Filterkette
 * durchlaeuft wie in Produktion; nur so sind die 401-Faelle hier
 * aussagekraeftig.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PortfolioIntegrationTest {

	/** Der Pfad des eigenen Profils, in der Einzahl und ohne ID (§6.1). */
	private static final String ME = "/api/portfolio/me";

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
	private PortfolioRepository portfolioRepository;

	@Autowired
	private PortfolioService portfolioService;

	/** Person mit gefuelltem Profil: der Normalfall des oeffentlichen Profils. */
	private User owner;

	/** Konto ohne Portfolio-Zeile, fuer den Ausnahmefall aus §3.2.1. */
	private User withoutRow;

	/** Zweite Autor:in, deren Projekte im fremden Profil nichts zu suchen haben. */
	private User otherAuthor;

	private Project publishedEarlier;

	private Project publishedLater;

	@BeforeEach
	void buildData() {
		owner = save(TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		withoutRow = save(TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		otherAuthor = save(TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));

		Portfolio portfolio = portfolioService.createFor(owner);
		portfolio.setBiography("Studiere Informatik im 5. Semester.");
		portfolio.setAvatarUrl("https://example.org/avatar.png");
		portfolioRepository.saveAndFlush(portfolio);

		publishedEarlier = project(owner, ProjectStatus.PUBLISHED, "Aeltere Arbeit",
				Instant.now().minus(30, ChronoUnit.DAYS));
		publishedLater = project(owner, ProjectStatus.PUBLISHED, "Neuere Arbeit",
				Instant.now().minus(2, ChronoUnit.DAYS));

		// Alles Folgende darf im Profil nicht auftauchen.
		project(owner, ProjectStatus.DRAFT, "Entwurf", null);
		project(owner, ProjectStatus.SUBMITTED, "Eingereicht", null);
		project(otherAuthor, ProjectStatus.PUBLISHED, "Fremde Arbeit", Instant.now());

		Project foreign = project(otherAuthor, ProjectStatus.PUBLISHED, "Gruppenarbeit", Instant.now());
		projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(foreign, owner, "Frontend"));
	}

	// ==================================================================
	// GET /api/portfolios/{userId}
	// ==================================================================

	@Nested
	@DisplayName("GET /api/portfolios/{userId}")
	class PublicProfile {

		@Test
		@DisplayName("Liefert ohne Anmeldung Person, Biografie und Avatar (§5: PUBLIC)")
		void readableWithoutToken() throws Exception {
			mockMvc.perform(get(path(owner)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.user.id").value(owner.getId().toString()))
					.andExpect(jsonPath("$.user.firstName").value(owner.getFirstName()))
					.andExpect(jsonPath("$.user.lastName").value(owner.getLastName()))
					.andExpect(jsonPath("$.biography").value("Studiere Informatik im 5. Semester."))
					.andExpect(jsonPath("$.avatarUrl").value("https://example.org/avatar.png"));
		}

		@Test
		@DisplayName("Die private E-Mail steht als Kontaktweg drin (§3.2)")
		void containsPrivateEmail() throws Exception {
			mockMvc.perform(get(path(owner)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.user.email").value(owner.getEmail()));
		}

		@Test
		@DisplayName("Weder hsbEmail noch passwordHash erscheinen irgendwo im Antworttext (§3.1)")
		void neverLeaksHsbEmailOrHash() throws Exception {
			String response = raw(get(path(owner)));

			assertThat(response)
					.doesNotContain(owner.getHsbEmail())
					.doesNotContain("hsbEmail")
					.doesNotContain("passwordHash");

			mockMvc.perform(get(path(owner)))
					.andExpect(jsonPath("$.user.hsbEmail").doesNotExist())
					.andExpect(jsonPath("$.user.passwordHash").doesNotExist());
		}

		@Test
		@DisplayName("Listet nur eigene veroeffentlichte Projekte, neueste zuerst (§3.2)")
		void listsOwnPublishedProjectsOnly() throws Exception {
			mockMvc.perform(get(path(owner)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.projects.length()").value(2))
					.andExpect(jsonPath("$.projects[0].id").value(publishedLater.getId().toString()))
					.andExpect(jsonPath("$.projects[1].id").value(publishedEarlier.getId().toString()));
		}

		@Test
		@DisplayName("Die Kacheln tragen das Profilbild der Autor:in (§6.1, KAN-34)")
		void cardsCarryAuthorAvatar() throws Exception {
			/*
			 * Das Bild haengt am Portfolio und nicht am Projekt (§3.2); die
			 * Kachel bekommt es ueber die Sammelabfrage des Lesedienstes.
			 * Ohne dieses Feld zeigte die Kachel neben dem Namen dauerhaft
			 * die Initialen, obwohl ein Bild hinterlegt ist.
			 */
			mockMvc.perform(get(path(owner)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.projects[0].author.avatarUrl")
							.value("https://example.org/avatar.png"))
					.andExpect(jsonPath("$.projects[1].author.avatarUrl")
							.value("https://example.org/avatar.png"));
		}

		@Test
		@DisplayName("Ohne hinterlegtes Bild bleibt das Feld der Kachel leer")
		void cardsOmitAvatarWithoutPortfolioRow() throws Exception {
			/* withoutRow hat kein Portfolio; die Kachel darf deshalb kein
			   avatarUrl fuehren statt eines erfundenen Werts. */
			mockMvc.perform(get(path(withoutRow)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.projects[*].author.avatarUrl").doesNotExist());
		}

		@Test
		@DisplayName("Eine blosse Projektmitgliedschaft zaehlt nicht zum eigenen Profil "
				+ "(Entscheidung aus der Klaerungsrunde zu KAN-22)")
		void ignoresMembership() throws Exception {
			String response = raw(get(path(owner)));

			assertThat(response).doesNotContain("Gruppenarbeit");
		}

		@Test
		@DisplayName("Ohne Portfolio-Zeile trotzdem 200, mit leeren Feldern (§3.2.1)")
		void missingRowStillAnswers() throws Exception {
			mockMvc.perform(get(path(withoutRow)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.user.id").value(withoutRow.getId().toString()))
					.andExpect(jsonPath("$.biography").doesNotExist())
					.andExpect(jsonPath("$.avatarUrl").doesNotExist())
					.andExpect(jsonPath("$.projects.length()").value(0));
		}

		@Test
		@DisplayName("Auch ein deaktiviertes Konto hat ein Profil (Entscheidung aus der "
				+ "Klaerungsrunde zu KAN-22)")
		void deactivatedAccountStillHasProfile() throws Exception {
			User deactivated = save(TestUser.withoutId(
					Role.STUDENT, UserStatus.DEACTIVATED, "nicht-relevant"));
			project(deactivated, ProjectStatus.PUBLISHED, "Arbeit von frueher", Instant.now());

			mockMvc.perform(get(path(deactivated)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.user.id").value(deactivated.getId().toString()))
					.andExpect(jsonPath("$.projects.length()").value(1));
		}

		@Test
		@DisplayName("Unbekannte Benutzer-ID ergibt 404 RESOURCE_NOT_FOUND")
		void unknownUser() throws Exception {
			mockMvc.perform(get("/api/portfolios/" + UUID.randomUUID()))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Eine ID, die keine UUID ist, ergibt 400 VALIDATION_FAILED")
		void malformedId() throws Exception {
			mockMvc.perform(get("/api/portfolios/keine-uuid"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}
	}

	// ==================================================================
	// GET /api/portfolio/me
	// ==================================================================

	@Nested
	@DisplayName("GET /api/portfolio/me")
	class OwnProfile {

		@Test
		@DisplayName("Liefert das eigene Profil samt mayEditPortfolio")
		void readsOwnProfile() throws Exception {
			mockMvc.perform(as(owner, get(ME)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").value("Studiere Informatik im 5. Semester."))
					.andExpect(jsonPath("$.avatarUrl").value("https://example.org/avatar.png"))
					.andExpect(jsonPath("$.mayEditPortfolio").value(true));
		}

		@Test
		@DisplayName("Ohne vorhandene Zeile 200 mit leeren Feldern und kein 404 (§3.2.1)")
		void missingRowIsNotAnError() throws Exception {
			mockMvc.perform(as(withoutRow, get(ME)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").doesNotExist())
					.andExpect(jsonPath("$.avatarUrl").doesNotExist())
					.andExpect(jsonPath("$.mayEditPortfolio").value(true));

			assertThat(portfolioRepository.findByUserId(withoutRow.getId())).isEmpty();
		}

		@Test
		@DisplayName("Ohne Token 401: \"me\" ist ohne Identitaet nicht aufloesbar")
		void unauthenticated() throws Exception {
			mockMvc.perform(get(ME))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		@Test
		@DisplayName("Zeigt ausschliesslich das eigene Profil, nie ein fremdes")
		void neverShowsForeignProfile() throws Exception {
			mockMvc.perform(as(otherAuthor, get(ME)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").doesNotExist());
		}

		@Test
		@DisplayName("Gibt keine E-Mail-Adresse aus: das eigene Profil ist die "
				+ "Bearbeitungsmaske, kein Personendatensatz")
		void containsNoAddresses() throws Exception {
			String response = raw(as(owner, get(ME)));

			assertThat(response)
					.doesNotContain(owner.getEmail())
					.doesNotContain(owner.getHsbEmail());
		}
	}

	// ==================================================================
	// PUT /api/portfolio/me
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/portfolio/me")
	class UpdatingOwnProfile {

		@Test
		@DisplayName("Aendert Biografie und Avatar und antwortet mit dem neuen Stand")
		void updates() throws Exception {
			update(owner, "Neue Biografie.", "https://example.org/neu.png")
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").value("Neue Biografie."))
					.andExpect(jsonPath("$.avatarUrl").value("https://example.org/neu.png"));

			Portfolio stored = portfolioRepository.findByUserId(owner.getId()).orElseThrow();
			assertThat(stored.getBiography()).isEqualTo("Neue Biografie.");
			assertThat(stored.getAvatarUrl()).isEqualTo("https://example.org/neu.png");
		}

		@Test
		@DisplayName("Legt die Zeile an, wenn sie fehlt (Upsert, §3.2.1)")
		void createsMissingRow() throws Exception {
			assertThat(portfolioRepository.findByUserId(withoutRow.getId())).isEmpty();

			update(withoutRow, "Erster Eintrag.", null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").value("Erster Eintrag."));

			assertThat(portfolioRepository.findByUserId(withoutRow.getId()))
					.get()
					.extracting(Portfolio::getBiography)
					.isEqualTo("Erster Eintrag.");
		}

		@Test
		@DisplayName("Ersetzt vollstaendig: ein fehlendes Feld leert den bisherigen Wert "
				+ "(Entscheidung aus der Klaerungsrunde zu KAN-22)")
		void replacesInsteadOfMerging() throws Exception {
			mockMvc.perform(as(owner, put(ME)
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"biography\":\"Nur die Biografie.\"}")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").value("Nur die Biografie."))
					.andExpect(jsonPath("$.avatarUrl").doesNotExist());

			assertThat(portfolioRepository.findByUserId(owner.getId()).orElseThrow().getAvatarUrl())
					.isNull();
		}

		@Test
		@DisplayName("Ein leerer Body loescht beide Felder")
		void emptyBodyClearsEverything() throws Exception {
			mockMvc.perform(as(owner, put(ME)
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").doesNotExist())
					.andExpect(jsonPath("$.avatarUrl").doesNotExist());
		}

		@Test
		@DisplayName("Betrifft nur das eigene Profil, fremde bleiben unveraendert")
		void leavesForeignProfilesUntouched() throws Exception {
			Portfolio foreign = portfolioService.createFor(otherAuthor);
			foreign.setBiography("Fremde Biografie.");
			portfolioRepository.saveAndFlush(foreign);

			update(owner, "Meine Biografie.", null).andExpect(status().isOk());

			assertThat(portfolioRepository.findByUserId(otherAuthor.getId()).orElseThrow()
					.getBiography()).isEqualTo("Fremde Biografie.");
		}

		@Test
		@DisplayName("Ohne Token 401")
		void unauthenticated() throws Exception {
			mockMvc.perform(put(ME)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("biography", "Von aussen.")))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(portfolioRepository.findByUserId(owner.getId()).orElseThrow().getBiography())
					.isEqualTo("Studiere Informatik im 5. Semester.");
		}

		@Test
		@DisplayName("Zu lange Biografie ergibt 400 VALIDATION_FAILED im Envelope aus §6.2")
		void biographyTooLong() throws Exception {
			update(owner, "x".repeat(5001), null)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.path").value("/api/portfolio/me"));
		}

		@Test
		@DisplayName("Zu lange avatarUrl ergibt 400 statt eines Datenbankfehlers")
		void avatarUrlTooLong() throws Exception {
			update(owner, null, "https://example.org/" + "x".repeat(1024))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Der neue Stand ist anschliessend ueber beide Lesewege sichtbar")
		void visibleAfterwards() throws Exception {
			update(owner, "Frisch geschrieben.", null).andExpect(status().isOk());

			mockMvc.perform(as(owner, get(ME)))
					.andExpect(jsonPath("$.biography").value("Frisch geschrieben."));
			mockMvc.perform(get(path(owner)))
					.andExpect(jsonPath("$.biography").value("Frisch geschrieben."));
		}
	}

	@Nested
	@DisplayName("Abgrenzung: das eigene Profil bleibt jeder Rolle offen")
	class EveryRoleKeepsItsProfile {

		/**
		 * Seit v33 verwehrt §5 einem Admin-Konto das Anlegen von Projekten
		 * (Fussnote 10). Die Zeile „Eigenes Portfolio bearbeiten" ist davon
		 * ausdruecklich nicht betroffen: Name, Biografie und Avatar pflegt auch
		 * ein Admin-Konto (§3.2). Der Test haelt die Grenze fest, damit die
		 * Sperre nicht spaeter auf das Profil ausgeweitet wird.
		 */
		@Test
		@DisplayName("Ein Admin-Konto liest und aendert sein Profil weiterhin: je 200 (§3.2)")
		void adminKeepsOwnProfile() throws Exception {
			User admin = save(TestUser.activeWithoutId(Role.ADMIN, "nicht-relevant"));

			mockMvc.perform(as(admin, get(ME)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.mayEditPortfolio").value(true));

			update(admin, "Verwalte das Portal.", null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.biography").value("Verwalte das Portal."));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(User user) {
		return userRepository.saveAndFlush(user);
	}

	/**
	 * Ein Projekt der gewuenschten Person und im gewuenschten Status. Der
	 * Zeitpunkt der Veroeffentlichung wird gesetzt, weil das Profil danach
	 * sortiert (§3.3).
	 */
	private Project project(User author, ProjectStatus status, String title, Instant publishedAt) {
		Project project = TestProject.withoutId(author, status, title);
		project.setPublishedAt(publishedAt);
		return projectRepository.saveAndFlush(project);
	}

	private String path(User user) {
		return "/api/portfolios/" + user.getId();
	}

	private ResultActions update(User user, String biography, String avatarUrl) throws Exception {
		return mockMvc.perform(as(user, put(ME)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("biography", biography, "avatarUrl", avatarUrl))));
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	private String raw(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	/** Baut einen JSON-Body; {@code null}-Werte bleiben als {@code null} darin stehen. */
	private String json(Object... pairs) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		for (int i = 0; i + 1 < pairs.length; i += 2) {
			fields.put((String) pairs[i], pairs[i + 1]);
		}
		return objectMapper.writeValueAsString(fields);
	}
}
