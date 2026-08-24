package de.hsbremen.eportfolio.top10;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.NominationTier;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.Top10Action;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
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
 * Der oeffentliche Endpoint {@code GET /api/top10} und die Nominierung aus §6.1
 * gegen die echte Datenbank (KAN-24).
 *
 * <p>Schwerpunkt sind die drei Zusagen, an denen dieses Modul haengt: die Liste
 * ist geordnet, sie zeigt ausschliesslich veroeffentlichte Projekte (§3.11.1
 * Regel 1), und ein Projekt bekommt hoechstens eine offene Nominierung
 * (Regel 2). Geprueft wird jeweils nicht nur die Antwort, sondern auch der
 * Bestand in der Datenbank; eine Liste, die richtig aussieht, waehrend die
 * Tabelle etwas anderes fuehrt, waere kein bestandener Fall.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck. Die Anmeldung laeuft
 * ueber echte Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe
 * Filterkette durchlaeuft wie in Produktion.
 *
 * <p>Die Admin-Endpoints stehen in {@code Top10AdminIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class Top10IntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private Top10EntryRepository entryRepository;

	@Autowired
	private Top10NominationRepository nominationRepository;

	@Autowired
	private Top10AuditEntryRepository auditRepository;

	private User author;

	private User student;

	private User editor;

	private User admin;

	private Project published;

	private Project draft;

	@BeforeEach
	void buildData() {
		// Die Tests laufen im Profil dev gegen die Entwicklungsdatenbank, in der
		// noch anderes stehen kann. Die Top-10 ist aber eine einzige globale
		// Liste; ein Restbestand aus einem frueheren Lauf wuerde jede
		// Positionspruefung verfaelschen. Deshalb wird sie hier geleert, was der
		// Rollback am Ende wieder zuruecknimmt.
		entryRepository.deleteAll();
		entryRepository.flush();

		author = save(Role.STUDENT);
		student = save(Role.STUDENT);
		editor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		published = project(ProjectStatus.PUBLISHED, "Veroeffentlicht");
		draft = project(ProjectStatus.DRAFT, "Entwurf");
	}

	// ==================================================================
	// GET /api/top10
	// ==================================================================

	@Nested
	@DisplayName("GET /api/top10")
	class PublicList {

		@Test
		@DisplayName("Ohne Token abrufbar und leer, solange nichts kuratiert wurde")
		void emptyWithoutToken() throws Exception {
			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(0));
		}

		@Test
		@DisplayName("Aufsteigend nach Platz, je Eintrag position, addedAt und die Projektkachel")
		void orderedByPosition() throws Exception {
			Project second = project(ProjectStatus.PUBLISHED, "Zweiter");
			Project third = project(ProjectStatus.PUBLISHED, "Dritter");

			// Absichtlich in verkehrter Reihenfolge angelegt: die Ordnung darf
			// nicht zufaellig aus der Einfuegereihenfolge stammen.
			entry(third, 3);
			entry(published, 1);
			entry(second, 2);

			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(3))
					.andExpect(jsonPath("$[0].position").value(1))
					.andExpect(jsonPath("$[0].project.title").value("Veroeffentlicht"))
					.andExpect(jsonPath("$[0].addedAt").isNotEmpty())
					.andExpect(jsonPath("$[1].position").value(2))
					.andExpect(jsonPath("$[1].project.title").value("Zweiter"))
					.andExpect(jsonPath("$[2].position").value(3))
					.andExpect(jsonPath("$[2].project.title").value("Dritter"));
		}

		@Test
		@DisplayName("Ein Eintrag zu einem nicht veroeffentlichten Projekt erscheint nicht "
				+ "(zweite Sperre gegen das Sichtbarkeitsleck aus §3.11.1)")
		void hidesUnpublished() throws Exception {
			entry(published, 1);
			// Am Dienst vorbei geschrieben: ueber die API kann dieser Zustand gar
			// nicht entstehen, weil ein Projekt beim Verlassen von PUBLISHED
			// seinen Platz raeumt. Genau darum steht der Filter in der Abfrage.
			entry(draft, 2);

			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].position").value(1));

			assertThat(entryRepository.findAll()).hasSize(2);
		}
	}

	// ==================================================================
	// Entzug beim Verlassen von PUBLISHED
	// ==================================================================

	/**
	 * Seit Contract v72 sperrt die kuratierte Liste den Weg aus
	 * {@code PUBLISHED} heraus (§4.1). Bis v71 war es umgekehrt: der Uebergang
	 * entzog den Platz still mit, und damit nahm ein einziges Zurueckgeben
	 * einen kuratierten Beitrag aus der oeffentlichen Auswahl.
	 */
	@Nested
	@DisplayName("Ruecknahme eines Top-10-Projekts nach REVISION (§4.1, v72)")
	class Withdrawal {

		@Test
		@DisplayName("Solange das Projekt in der Liste steht: 409 RESOURCE_IN_USE")
		void refusedWhileInTheList() throws Exception {
			entry(published, 1);

			mockMvc.perform(as(admin, post("/api/projects/" + published.getId()
							+ "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Zurueck in die Ueberarbeitung.\"}"))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			// Nichts angefasst: weder Status noch Liste.
			assertThat(projectRepository.findById(published.getId()))
					.get()
					.extracting(Project::getStatus)
					.isEqualTo(ProjectStatus.PUBLISHED);
			assertThat(entryRepository.findByProjectId(published.getId())).isPresent();
		}

		@Test
		@DisplayName("Erst aus der Liste nehmen, dann geht der Uebergang")
		void possibleOnceOutOfTheList() throws Exception {
			Project other = project(ProjectStatus.PUBLISHED, "Nachbar");
			entry(other, 3);

			mockMvc.perform(as(admin, post("/api/projects/" + published.getId()
							+ "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Zurueck in die Ueberarbeitung.\"}"))
					.andExpect(status().isOk());

			assertThat(projectRepository.findById(published.getId()))
					.get()
					.extracting(Project::getStatus)
					.isEqualTo(ProjectStatus.REVISION);
			// Der Nachbar bleibt unberuehrt auf seinem Platz.
			assertThat(entryRepository.findByProjectId(other.getId()))
					.get()
					.extracting(Top10Entry::getPosition)
					.isEqualTo(3);
		}

		@Test
		@DisplayName("Offene Nominierungen fallen mit, angenommene bleiben Protokoll")
		void withdrawsOpenNominationsAndKeepsDecidedOnes() throws Exception {
			Top10Nomination accepted = nominationRepository.saveAndFlush(
					TestTop10.decided(published, editor, admin, NominationStatus.ACCEPTED));
			Project second = project(ProjectStatus.PUBLISHED, "Zweiter");
			Top10Nomination open = nominationRepository.saveAndFlush(
					TestTop10.pending(second, editor, NominationTier.TOP_5));

			mockMvc.perform(as(admin, post("/api/projects/" + second.getId()
							+ "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Zurueck in die Ueberarbeitung.\"}"))
					.andExpect(status().isOk());

			// Der offene Vorschlag waere unerfuellbar und im Weg zugleich
			// (§3.11.1 Regeln 1 und 2), er faellt deshalb mit.
			assertThat(nominationRepository.findById(open.getId()))
					.get()
					.satisfies(entry -> {
						assertThat(entry.getStatus()).isEqualTo(NominationStatus.WITHDRAWN);
						assertThat(entry.getDecidedBy().getId()).isEqualTo(admin.getId());
						assertThat(entry.getDecidedAt()).isNotNull();
					});

			// Der angenommene gehoert zu einem anderen Projekt und bleibt
			// ohnehin; dass er angenommen wurde, bleibt wahr (§3.11).
			assertThat(nominationRepository.findById(accepted.getId()))
					.get()
					.extracting(Top10Nomination::getStatus)
					.isEqualTo(NominationStatus.ACCEPTED);
		}

		@Test
		@DisplayName("Danach ist das Projekt wieder frei fuer einen neuen Vorschlag")
		void freeForANewNominationAfterwards() throws Exception {
			Project second = project(ProjectStatus.PUBLISHED, "Zweiter");
			nominationRepository.saveAndFlush(
					TestTop10.pending(second, editor, NominationTier.TOP_5));

			mockMvc.perform(as(admin, post("/api/projects/" + second.getId()
							+ "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Zurueck in die Ueberarbeitung.\"}"))
					.andExpect(status().isOk());

			// §3.11.1 Regel 2 spricht von der offenen Nominierung; die gibt es
			// jetzt nicht mehr. Nominierbar ist das Projekt trotzdem erst
			// wieder, wenn es veroeffentlicht ist (Regel 1).
			assertThat(nominationRepository.existsByProjectIdAndStatus(
					second.getId(), NominationStatus.PENDING)).isFalse();
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/top10-nomination
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/top10-nomination")
	class Nominating {

		@Test
		@DisplayName("Redaktion nominiert ein veroeffentlichtes Projekt: 201 und Stand PENDING")
		void editorNominates() throws Exception {
			nominate(editor, published, "{\"proposedTier\":\"TOP_5\"}")
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.status").value("PENDING"))
					.andExpect(jsonPath("$.proposedTier").value("TOP_5"))
					// Der Platz gehoert seit Contract v68 der Administration und
					// entsteht erst beim Annehmen.
					.andExpect(jsonPath("$.proposedPosition").doesNotExist())
					.andExpect(jsonPath("$.nominatedBy.id").value(editor.getId().toString()))
					.andExpect(jsonPath("$.decidedBy").doesNotExist())
					.andExpect(jsonPath("$.decidedAt").doesNotExist())
					.andExpect(jsonPath("$.project.title").value("Veroeffentlicht"));

			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(1);
		}

		@Test
		@DisplayName("Ohne Body 400: die Stufe ist seit Contract v68 Pflicht (§3.11.1 Regel 4)")
		void rejectsMissingBody() throws Exception {
			mockMvc.perform(as(editor, post(path(published))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Ohne proposedTier 400, auch mit sonst gueltigem Body")
		void rejectsMissingTier() throws Exception {
			nominate(editor, published, "{}")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Eine unbekannte Stufe ergibt 400 (§2.13)")
		void rejectsUnknownTier() throws Exception {
			nominate(editor, published, "{\"proposedTier\":\"TOP_3\"}")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Alle drei Stufen aus §2.13 werden angenommen und in der Antwort gefuehrt")
		void acceptsEveryTier() throws Exception {
			for (NominationTier tier : NominationTier.values()) {
				Project candidate = project(ProjectStatus.PUBLISHED, "Fuer " + tier);

				nominate(editor, candidate, "{\"proposedTier\":\"" + tier + "\"}")
						.andExpect(status().isCreated())
						.andExpect(jsonPath("$.proposedTier").value(tier.name()));
			}
		}

		@Test
		@DisplayName("Ohne Token 401, weil §5 fuer PUBLIC ein Kreuz traegt")
		void unauthenticated() throws Exception {
			mockMvc.perform(post(path(published))
							.contentType(MediaType.APPLICATION_JSON)
							.content(DEFAULT_NOMINATION_BODY))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Studierende duerfen nicht nominieren: 403 (§5)")
		void studentForbidden() throws Exception {
			nominate(student, published, null)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			// Auch die Autor:in des Projekts nicht: die Matrixzeile fragt nach der
			// Rolle und nicht nach der Beziehung zum Projekt.
			nominate(author, published, null)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Unbekannte Projekt-ID ergibt 404 und nicht 403 (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(editor, post("/api/projects/" + UUID.randomUUID()
							+ "/top10-nomination"))
							.contentType(MediaType.APPLICATION_JSON)
							.content(DEFAULT_NOMINATION_BODY))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ein nicht veroeffentlichtes Projekt ergibt 409 PROJECT_NOT_PUBLISHED "
				+ "(§3.11.1 Regel 1)")
		void notPublished() throws Exception {
			for (ProjectStatus status : List.of(ProjectStatus.DRAFT, ProjectStatus.SUBMITTED,
					ProjectStatus.APPROVED, ProjectStatus.REVISION)) {

				Project candidate = project(status, "Im Status " + status);
				nominate(editor, candidate, null)
						.andExpect(status().isConflict())
						.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_PUBLISHED"));

				assertThat(nominationRepository.findByProjectId(candidate.getId())).isEmpty();
			}
		}

		@Test
		@DisplayName("Eine zweite offene Nominierung zum selben Projekt ergibt 409 "
				+ "RESOURCE_IN_USE (§3.11.1 Regel 2)")
		void secondOpenNomination() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());

			nominate(admin, published, null)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(1);
		}

		@Test
		@DisplayName("Ein Projekt, das bereits in der Top-10 steht, laesst sich nicht nominieren: "
				+ "409 RESOURCE_IN_USE (§3.11.1 Regel 2)")
		void alreadyInTheList() throws Exception {
			entry(published, 1);

			nominate(editor, published, null)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Nach einer Ablehnung ist dasselbe Projekt wieder nominierbar: Regel 2 "
				+ "spricht von der offenen Nominierung")
		void renominationAfterRejection() throws Exception {
			nominationRepository.saveAndFlush(
					TestTop10.decided(published, editor, admin, NominationStatus.REJECTED));

			nominate(editor, published, null).andExpect(status().isCreated());

			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(2);
		}
	}

	// ==================================================================
	// GET /api/top10-nominations?nominatedBy=me
	// ==================================================================

	@Nested
	@DisplayName("GET /api/top10-nominations?nominatedBy=me")
	class OwnNominations {

		@Test
		@DisplayName("Liefert allein die eigenen Vorschlaege, neueste zuerst")
		void onlyOwn() throws Exception {
			Project second = project(ProjectStatus.PUBLISHED, "Zweites");
			Project third = project(ProjectStatus.PUBLISHED, "Drittes");

			nominate(editor, published, "{\"proposedTier\":\"TOP_1\"}")
					.andExpect(status().isCreated());
			nominate(editor, second, "{\"proposedTier\":\"TOP_5\"}")
					.andExpect(status().isCreated());
			// Der Vorschlag einer anderen Person darf hier nicht auftauchen.
			nominate(admin, third, null).andExpect(status().isCreated());

			own(editor, null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(2))
					.andExpect(jsonPath("$[0].project.title").value("Zweites"))
					.andExpect(jsonPath("$[0].proposedTier").value("TOP_5"))
					.andExpect(jsonPath("$[1].project.title").value("Veroeffentlicht"))
					.andExpect(jsonPath("$[1].proposedTier").value("TOP_1"))
					.andExpect(jsonPath("$[0].nominatedBy.id").value(editor.getId().toString()));
		}

		@Test
		@DisplayName("Ein fremdes Redaktionskonto sieht die Vorschlaege nicht")
		void foreignEditorSeesNothing() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());

			User otherEditor = save(Role.EDITOR);
			own(otherEditor, null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(0));
		}

		@Test
		@DisplayName("Der Filter status grenzt auf einen Stand ein (§2.8)")
		void filtersByStatus() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			nominationRepository.saveAndFlush(
					TestTop10.decided(project(ProjectStatus.PUBLISHED, "Abgelehnt"), editor,
							admin, NominationStatus.REJECTED));

			own(editor, NominationStatus.PENDING.name())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].status").value("PENDING"));

			own(editor, NominationStatus.REJECTED.name())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].status").value("REJECTED"));
		}

		@Test
		@DisplayName("Ein anderer Wert als \"me\" ergibt 400, ebenso ein fehlender Parameter")
		void onlyMeAllowed() throws Exception {
			mockMvc.perform(as(editor, get("/api/top10-nominations")
							.param("nominatedBy", editor.getId().toString())))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			mockMvc.perform(as(editor, get("/api/top10-nominations")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ein unbekannter Wert von status ergibt 400 (§2.8)")
		void rejectsUnknownStatus() throws Exception {
			own(editor, "GIBTSNICHT")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Studierende bekommen 403, auch mit korrektem Parameter (§5)")
		void studentForbidden() throws Exception {
			own(student, null)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Ohne Token 401 und keine leere Liste")
		void unauthenticated() throws Exception {
			mockMvc.perform(get("/api/top10-nominations").param("nominatedBy", "me"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		@Test
		@DisplayName("Ein Admin sieht ueber diesen Pfad ebenfalls nur die eigenen Vorschlaege; "
				+ "den vollstaendigen Spiegel fuehrt /api/admin/top10-nominations")
		void adminSeesOnlyOwn() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());

			own(admin, null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(0));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	/** Der kleinste gueltige Nominierungskoerper seit Contract v68 (§2.13). */
	private static final String DEFAULT_NOMINATION_BODY = "{\"proposedTier\":\"TOP_10\"}";

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	/**
	 * Ein Projekt der Autor:in im gewuenschten Status. Die Metadaten aus §3.3
	 * bleiben leer: fuer die Top-10 zaehlt allein der Status.
	 */
	private Project project(ProjectStatus status, String title) {
		return projectRepository.saveAndFlush(TestProject.withoutId(author, status, title));
	}

	// ==================================================================
	// POST /api/top10-nominations/{id}/withdraw
	// ==================================================================

	/**
	 * Das Zurueckziehen aus §3.11.1 (Contract v70, KAN-37). Geprueft werden die
	 * beiden Reichweiten aus §5 (eigener Vorschlag gegen jeden Vorschlag), die
	 * Standsgrenze je Rolle und die Nebenwirkung auf die kuratierte Liste.
	 */
	@Nested
	@DisplayName("POST /api/top10-nominations/{id}/withdraw")
	class WithdrawingNomination {

		@Test
		@DisplayName("Die Redaktion zieht ihren eigenen offenen Vorschlag zurueck")
		void ownPending() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			Top10Nomination nomination = onlyNominationOf(published);

			withdraw(editor, nomination.getId())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("WITHDRAWN"))
					.andExpect(jsonPath("$.decidedBy.id").value(editor.getId().toString()))
					.andExpect(jsonPath("$.decidedAt").isNotEmpty());

			// Nicht nur die Antwort: der Stand steht auch in der Tabelle, und der
			// Check-Constraint aus der Migration laesst ihn zu.
			assertThat(onlyNominationOf(published).getStatus())
					.isEqualTo(NominationStatus.WITHDRAWN);
		}

		@Test
		@DisplayName("Danach laesst sich dasselbe Projekt erneut nominieren (§3.11.1 Regel 2)")
		void renominationAfterWithdrawal() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			withdraw(editor, onlyNominationOf(published).getId()).andExpect(status().isOk());

			nominate(editor, published, null).andExpect(status().isCreated());
			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(2);
		}

		@Test
		@DisplayName("Einen fremden Vorschlag zieht die Redaktion nicht zurueck")
		void foreignNominationForbidden() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			User otherEditor = save(Role.EDITOR);

			withdraw(otherEditor, onlyNominationOf(published).getId())
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Die Administration zieht auch einen fremden offenen Vorschlag zurueck "
				+ "(§3.11.1, v70)")
		void adminWithdrawsForeignPending() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			Top10Nomination nomination = onlyNominationOf(published);

			/*
			 * §5 fuehrt die Zeile „Nominierung zurueckziehen" fuer EDITOR mit
			 * (✓) und fuer ADMIN mit ✓: die Redaktion nur den eigenen Vorschlag,
			 * die Administration jeden. Getestet war bisher nur der angenommene
			 * Vorschlag; der offene ist der haeufigere Fall.
			 */
			withdraw(admin, nomination.getId())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("WITHDRAWN"))
					.andExpect(jsonPath("$.decidedBy.id").value(admin.getId().toString()));

			assertThat(onlyNominationOf(published).getStatus())
					.isEqualTo(NominationStatus.WITHDRAWN);
			// Ein offener Vorschlag hatte keinen Platz, also wird auch keiner frei.
			assertThat(entryRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Einen angenommenen Vorschlag zieht die Redaktion nicht mehr zurueck")
		void editorCannotWithdrawAccepted() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			Top10Nomination nomination = onlyNominationOf(published);
			accept(nomination.getId(), 3).andExpect(status().isOk());

			withdraw(editor, nomination.getId())
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("NOMINATION_ALREADY_DECIDED"));
		}

		@Test
		@DisplayName("Die Administration zieht einen angenommenen zurueck; der Platz wird frei")
		void adminWithdrawsAcceptedAndFreesTheSlot() throws Exception {
			Project other = project(ProjectStatus.PUBLISHED, "Nachbar");
			entry(other, 5);

			nominate(editor, published, null).andExpect(status().isCreated());
			Top10Nomination nomination = onlyNominationOf(published);
			accept(nomination.getId(), 3).andExpect(status().isOk());

			withdraw(admin, nomination.getId())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("WITHDRAWN"))
					.andExpect(jsonPath("$.decidedBy.id").value(admin.getId().toString()))
					// Der entschiedene Platz bleibt an der Nominierung stehen: sie
					// haelt fest, worauf einmal entschieden wurde (§3.11.1).
					.andExpect(jsonPath("$.proposedPosition").value(3));

			assertThat(entryRepository.findByProjectId(published.getId())).isEmpty();
			// Die uebrigen ruecken nicht nach, der freie Platz bleibt frei.
			assertThat(entryRepository.findByProjectId(other.getId()))
					.get()
					.extracting(Top10Entry::getPosition)
					.isEqualTo(5);
		}

		@Test
		@DisplayName("Der frei gewordene Platz steht als REMOVED im Protokoll (§3.17)")
		void auditRecordsTheRemoval() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			Top10Nomination nomination = onlyNominationOf(published);
			accept(nomination.getId(), 2).andExpect(status().isOk());

			withdraw(admin, nomination.getId()).andExpect(status().isOk());

			assertThat(auditRepository.findAll())
					.filteredOn(row -> row.getAction() == Top10Action.REMOVED
							&& row.getProject() != null
							&& row.getProject().getId().equals(published.getId()))
					.singleElement()
					.satisfies(row -> {
						assertThat(row.getPreviousPosition()).isEqualTo(2);
						assertThat(row.getNewPosition()).isNull();
						assertThat(row.getAdmin().getId()).isEqualTo(admin.getId());
					});
		}

		@Test
		@DisplayName("Einen abgelehnten Vorschlag zieht auch die Administration nicht zurueck")
		void adminCannotWithdrawRejected() throws Exception {
			Top10Nomination rejected = nominationRepository.saveAndFlush(
					TestTop10.decided(published, editor, admin, NominationStatus.REJECTED));

			withdraw(admin, rejected.getId())
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("NOMINATION_ALREADY_DECIDED"));
		}

		@Test
		@DisplayName("Ein zweites Zurueckziehen ergibt 409")
		void secondWithdrawal() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());
			UUID id = onlyNominationOf(published).getId();

			withdraw(editor, id).andExpect(status().isOk());
			withdraw(editor, id)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("NOMINATION_ALREADY_DECIDED"));
		}

		@Test
		@DisplayName("Eine unbekannte ID ergibt 404 und nicht 403")
		void unknownNomination() throws Exception {
			withdraw(editor, UUID.randomUUID())
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ohne Anmeldung 401")
		void unauthenticated() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());

			mockMvc.perform(post("/api/top10-nominations/"
							+ onlyNominationOf(published).getId() + "/withdraw"))
					.andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("Ein Studierendenkonto bekommt 403")
		void studentForbidden() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());

			withdraw(student, onlyNominationOf(published).getId())
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}
	}

	/**
	 * Ein Platz in der Liste, am Dienst vorbei geschrieben. Der Zeitstempel liegt
	 * bewusst in der Vergangenheit, damit sich ein spaeter neu vergebener
	 * {@code addedAt} davon unterscheiden laesst.
	 */
	private Top10Entry entry(Project project, int position) {
		return entryRepository.saveAndFlush(TestTop10.entry(project, position,
				Instant.now().minus(7, ChronoUnit.DAYS)));
	}

	private String path(Project project) {
		return "/api/projects/" + project.getId() + "/top10-nomination";
	}

	/**
	 * {@code GET /api/top10-nominations?nominatedBy=me} (§6.1, seit Contract
	 * v68). Der Parameter steht immer auf {@code me}; die Faelle mit anderem
	 * oder fehlendem Wert bauen ihre Anfrage selbst.
	 */
	private ResultActions own(User user, String status) throws Exception {
		MockHttpServletRequestBuilder request = as(user, get("/api/top10-nominations"))
				.param("nominatedBy", "me");
		if (status != null) {
			request = request.param("status", status);
		}
		return mockMvc.perform(request);
	}

	/**
	 * Nominiert mit dem angegebenen Koerper; {@code null} steht fuer den
	 * gueltigen Standardkoerper.
	 *
	 * <p>Seit Contract v68 ist der Body Pflicht: die Stufe ist die einzige
	 * Angabe des Vorschlags. Wuerde {@code null} weiterhin „gar kein Koerper"
	 * heissen, endeten alle Faelle, die eigentlich 401, 403, 404 oder 409
	 * pruefen, vorher in einem 400 aus der Koerperbindung.
	 */
	private ResultActions nominate(User user, Project project, String body) throws Exception {
		return mockMvc.perform(as(user, post(path(project)))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body == null ? DEFAULT_NOMINATION_BODY : body));
	}

	/**
	 * {@code POST /api/top10-nominations/{id}/withdraw} (§6.1, seit Contract
	 * v70), ohne Koerper.
	 */
	private ResultActions withdraw(User user, UUID nominationId) throws Exception {
		return mockMvc.perform(
				as(user, post("/api/top10-nominations/" + nominationId + "/withdraw")));
	}

	/**
	 * Nimmt einen Vorschlag ueber den Admin-Endpoint an. Der Umweg ueber die API
	 * statt ueber {@code TestTop10.decided} ist Absicht: nur so entstehen
	 * Nominierung, {@code Top10Entry} und Protokollzeile so, wie sie in
	 * Produktion zusammengehoeren, und genau daran haengt der Fall
	 * „angenommenen Vorschlag zurueckziehen".
	 */
	private ResultActions accept(UUID nominationId, int position) throws Exception {
		return mockMvc.perform(
				as(admin, post("/api/admin/top10-nominations/" + nominationId + "/accept"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"position\":" + position + "}"));
	}

	/** Die einzige Nominierung zu einem Projekt; scheitert, wenn es mehrere gibt. */
	private Top10Nomination onlyNominationOf(Project project) {
		List<Top10Nomination> found = nominationRepository.findByProjectId(project.getId());
		assertThat(found).hasSize(1);
		return found.get(0);
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
