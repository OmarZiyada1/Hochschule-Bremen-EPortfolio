package de.hsbremen.eportfolio.projekt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AngemeldeterBenutzer;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.benutzer.TestUser;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.BlockTyp;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.error.Fehlercodes;
import de.hsbremen.eportfolio.reaktion.ReaktionRepository;
import de.hsbremen.eportfolio.reaktion.TestReaktion;
import de.hsbremen.eportfolio.stammdaten.DevStammdatenSeeder;
import de.hsbremen.eportfolio.stammdaten.FakultaetRepository;
import de.hsbremen.eportfolio.stammdaten.Kategorie;
import de.hsbremen.eportfolio.stammdaten.KategorieRepository;
import de.hsbremen.eportfolio.stammdaten.Modul;
import de.hsbremen.eportfolio.stammdaten.ModulRepository;
import de.hsbremen.eportfolio.stammdaten.Studiengang;
import de.hsbremen.eportfolio.stammdaten.StudiengangRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
class ProjektLeseIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private DevStammdatenSeeder seeder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjektRepository projektRepository;

	@Autowired
	private ProjektmitgliedRepository projektmitgliedRepository;

	@Autowired
	private ProjektStatusHistorieRepository statusHistorieRepository;

	@Autowired
	private BlockRepository blockRepository;

	@Autowired
	private ReaktionRepository reaktionRepository;

	@Autowired
	private KategorieRepository kategorieRepository;

	@Autowired
	private FakultaetRepository fakultaetRepository;

	@Autowired
	private StudiengangRepository studiengangRepository;

	@Autowired
	private ModulRepository modulRepository;

	/** Klammert die Projekte dieses Laufs von allem ab, was sonst in der DB steht. */
	private String semester;

	private User autor;

	private User mitglied;

	private User fremderStudi;

	private User zugewiesenerRedakteur;

	private User andererRedakteur;

	private User admin;

	private Projekt entwurfDesAutors;

	private Projekt veroeffentlichtesProjekt;

	private Projekt eingereichtesFremdprojekt;

	private Projekt fremderEntwurfMitMitglied;

	private Kategorie kategorie;

	private Studiengang studiengang;

	private Modul modul;

	@BeforeEach
	void datenAufbauen() {
		seeder.run(new DefaultApplicationArguments());
		semester = "KAN16 " + UUID.randomUUID();

		autor = speichere(Rolle.STUDIERENDE);
		mitglied = speichere(Rolle.STUDIERENDE);
		fremderStudi = speichere(Rolle.STUDIERENDE);
		zugewiesenerRedakteur = speichere(Rolle.REDAKTEUR);
		andererRedakteur = speichere(Rolle.REDAKTEUR);
		admin = speichere(Rolle.ADMIN);

		kategorie = kategorieRepository.findAllByOrderByNameAsc().getFirst();
		UUID fk4 = fakultaetRepository.findByKuerzel("FK4").orElseThrow().getId();
		studiengang = studiengangRepository.findByFakultaetIdAndName(fk4, "Informatik").orElseThrow();
		modul = modulRepository.findByStudiengangIdOrderByNameAsc(studiengang.getId()).getFirst();

		entwurfDesAutors = neuesProjekt(autor, ProjektStatus.ENTWURF, "Alpha Entwurf");

		veroeffentlichtesProjekt = neuesProjekt(autor, ProjektStatus.VEROEFFENTLICHT, "Beta Portfolio");
		veroeffentlichtesProjekt.setKurzbeschreibung("Ein Teaser ueber Barrierefreiheit");
		veroeffentlichtesProjekt.setKategorie(kategorie);
		veroeffentlichtesProjekt.setFakultaet(studiengang.getFakultaet());
		veroeffentlichtesProjekt.setStudiengang(studiengang);
		veroeffentlichtesProjekt.setModul(modul);
		veroeffentlichtesProjekt.setProjekttyp(Projekttyp.THESIS);
		veroeffentlichtesProjekt.setAbschluss(Abschluss.BACHELOR);
		veroeffentlichtesProjekt.setVeroeffentlichtAm(Instant.now().truncatedTo(ChronoUnit.SECONDS));
		// Die bestehende Sammlung fuellen statt sie zu ersetzen: das Projekt ist
		// bereits gespeichert, seine Tag-Sammlung wird also von Hibernate
		// verwaltet.
		veroeffentlichtesProjekt.getTags().addAll(List.of("ux", "react"));
		veroeffentlichtesProjekt = projektRepository.saveAndFlush(veroeffentlichtesProjekt);

		eingereichtesFremdprojekt = neuesProjekt(fremderStudi, ProjektStatus.EINGEREICHT, "Gamma Review");
		eingereichtesFremdprojekt.getRedakteure().add(zugewiesenerRedakteur);
		eingereichtesFremdprojekt = projektRepository.saveAndFlush(eingereichtesFremdprojekt);

		fremderEntwurfMitMitglied = neuesProjekt(fremderStudi, ProjektStatus.ENTWURF, "Delta Gruppenarbeit");
		Projektmitglied zuordnung = projektmitgliedRepository.saveAndFlush(
				TestProjekt.mitgliedOhneId(fremderEntwurfMitMitglied, mitglied, "Frontend"));
		// Die Zeile steht in der Datenbank, aber die Sammlung des bereits
		// verwalteten Projekts kennt sie noch nicht. Test und Endpoint teilen
		// sich hier einen Persistenzkontext; in Produktion faellt das nicht an,
		// weil jeder Request seinen eigenen hat und die Sammlung frisch laedt.
		// Der ProjektBerechtigungService liest genau diese Sammlung, deshalb
		// wird sie hier nachgezogen.
		fremderEntwurfMitMitglied.getMitglieder().add(zuordnung);
	}

	// ==================================================================
	// GET /api/projekte: Sichtbarkeit (§5)
	// ==================================================================

	@Nested
	@DisplayName("Liste: rollenabhaengige Sichtbarkeit")
	class Sichtbarkeit {

		@Test
		@DisplayName("PUBLIC sieht ausschliesslich veroeffentlichte Projekte")
		void publicSiehtNurVeroeffentlichtes() throws Exception {
			assertThat(idsDerListe(null)).containsExactly(veroeffentlichtesProjekt.getId());
		}

		@Test
		@DisplayName("Studierende sehen zusaetzlich die eigenen Projekte, nicht die fremden Entwuerfe")
		void autorSiehtEigenes() throws Exception {
			assertThat(idsDerListe(autor)).containsExactlyInAnyOrder(
					veroeffentlichtesProjekt.getId(),
					entwurfDesAutors.getId());
		}

		@Test
		@DisplayName("Projektmitglieder sehen den fremden Entwurf, an dem sie mitarbeiten (§3.13)")
		void mitgliedSiehtGruppenarbeit() throws Exception {
			assertThat(idsDerListe(mitglied)).containsExactlyInAnyOrder(
					veroeffentlichtesProjekt.getId(),
					fremderEntwurfMitMitglied.getId());
		}

		@Test
		@DisplayName("Redaktion sieht alle Projekte in allen Status, auch nicht zugewiesene")
		void redaktionSiehtAlles() throws Exception {
			assertThat(idsDerListe(andererRedakteur)).containsExactlyInAnyOrder(
					veroeffentlichtesProjekt.getId(),
					entwurfDesAutors.getId(),
					eingereichtesFremdprojekt.getId(),
					fremderEntwurfMitMitglied.getId());
		}

		@Test
		@DisplayName("Admin sieht alle Projekte in allen Status")
		void adminSiehtAlles() throws Exception {
			assertThat(idsDerListe(admin)).hasSize(4);
		}

		@Test
		@DisplayName("Ein Filter kann die Sichtbarkeitsschranke nicht aufweichen")
		void filterOeffnetNichts() throws Exception {
			// PUBLIC fragt gezielt nach Entwuerfen: die Antwort bleibt leer,
			// statt den Entwurf des Autors herauszugeben.
			assertThat(idsDerListe(null, "status", "ENTWURF")).isEmpty();
			assertThat(idsDerListe(null, "autor", autor.getId().toString()))
					.containsExactly(veroeffentlichtesProjekt.getId());
		}
	}

	// ==================================================================
	// GET /api/projekte: „Meine Reviews" (§6.1)
	// ==================================================================

	@Nested
	@DisplayName("Liste: redakteur=me")
	class MeineReviews {

		@Test
		@DisplayName("Liefert genau die zugewiesenen Projekte")
		void nurZugewiesene() throws Exception {
			assertThat(idsDerListe(zugewiesenerRedakteur, "redakteur", "me"))
					.containsExactly(eingereichtesFremdprojekt.getId());
		}

		@Test
		@DisplayName("Eine Redakteur:in ohne Zuweisung bekommt eine leere Liste, obwohl sie alles lesen darf")
		void ohneZuweisungLeer() throws Exception {
			assertThat(idsDerListe(andererRedakteur)).hasSize(4);
			assertThat(idsDerListe(andererRedakteur, "redakteur", "me")).isEmpty();
		}

		@Test
		@DisplayName("Dieselbe Wirkung ueber die ausgeschriebene Redakteurs-ID")
		void ueberId() throws Exception {
			assertThat(idsDerListe(admin, "redakteur", zugewiesenerRedakteur.getId().toString()))
					.containsExactly(eingereichtesFremdprojekt.getId());
		}

		@Test
		@DisplayName("Ohne Anmeldung ergibt \"me\" 401 und keine leere Liste")
		void ohneAnmeldung() throws Exception {
			mockMvc.perform(get("/api/projekte").param("redakteur", "me"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.NICHT_AUTHENTIFIZIERT));
		}

		@Test
		@DisplayName("Weder \"me\" noch UUID: 400 im Envelope, ohne den eingeschickten Wert")
		void unbrauchbarerWert() throws Exception {
			mockMvc.perform(alsBenutzer(get("/api/projekte").param("redakteur", "irgendwas"), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN))
					.andExpect(jsonPath("$.meldung", not(containsString("irgendwas"))));
		}
	}

	// ==================================================================
	// GET /api/projekte: Filter (§6.1)
	// ==================================================================

	@Nested
	@DisplayName("Liste: Filter und Suche")
	class Filter {

		@Test
		@DisplayName("Stammdatenfilter greifen einzeln")
		void stammdatenfilter() throws Exception {
			UUID erwartet = veroeffentlichtesProjekt.getId();

			assertThat(idsDerListe(admin, "kategorie", kategorie.getId().toString()))
					.containsExactly(erwartet);
			assertThat(idsDerListe(admin, "fakultaet", studiengang.getFakultaet().getId().toString()))
					.containsExactly(erwartet);
			assertThat(idsDerListe(admin, "studiengang", studiengang.getId().toString()))
					.containsExactly(erwartet);
			assertThat(idsDerListe(admin, "modul", modul.getId().toString()))
					.containsExactly(erwartet);
			assertThat(idsDerListe(admin, "abschluss", "BACHELOR")).containsExactly(erwartet);
			assertThat(idsDerListe(admin, "typ", "THESIS")).containsExactly(erwartet);
		}

		@Test
		@DisplayName("Mehrere Filter werden mit UND verknuepft")
		void kombination() throws Exception {
			assertThat(idsDerListe(admin, "typ", "THESIS", "abschluss", "BACHELOR", "q", "Beta"))
					.containsExactly(veroeffentlichtesProjekt.getId());

			// Ein Filter, der nicht passt, macht die Kombination leer.
			assertThat(idsDerListe(admin, "typ", "THESIS", "abschluss", "MASTER")).isEmpty();
		}

		@Test
		@DisplayName("q sucht in Titel und Kurzbeschreibung, unabhaengig von der Schreibweise")
		void suchtext() throws Exception {
			assertThat(idsDerListe(admin, "q", "beta portfolio"))
					.containsExactly(veroeffentlichtesProjekt.getId());
			assertThat(idsDerListe(admin, "q", "BARRIEREFREIHEIT"))
					.containsExactly(veroeffentlichtesProjekt.getId());
			assertThat(idsDerListe(admin, "q", "gamma"))
					.containsExactly(eingereichtesFremdprojekt.getId());
		}

		@Test
		@DisplayName("Platzhalter im Suchbegriff werden maskiert und wirken nicht als Joker")
		void platzhalterMaskiert() throws Exception {
			assertThat(idsDerListe(admin, "q", "%")).isEmpty();
			assertThat(idsDerListe(admin, "q", "_")).isEmpty();
		}

		@Test
		@DisplayName("Ein leerer Parameter wirkt wie ein fehlender")
		void leererParameter() throws Exception {
			assertThat(idsDerListe(admin, "q", "")).hasSize(4);
		}

		@Test
		@DisplayName("Unbekannte Filter-ID ergibt eine leere Liste, kein 404")
		void unbekannteFilterId() throws Exception {
			mockMvc.perform(alsBenutzer(listenAnfrage("kategorie", UUID.randomUUID().toString()), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.inhalt").isEmpty());
		}
	}

	// ==================================================================
	// GET /api/projekte: Seitenformat und Sortierung (§6.6, §1)
	// ==================================================================

	@Nested
	@DisplayName("Liste: Paginierung und Sortierung")
	class Seiten {

		@Test
		@DisplayName("Das Seitenformat traegt die fuenf Felder aus §6.6")
		void seitenformat() throws Exception {
			mockMvc.perform(alsBenutzer(listenAnfrage("page", "1", "size", "3"), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.seite").value(1))
					.andExpect(jsonPath("$.groesse").value(3))
					.andExpect(jsonPath("$.gesamtElemente").value(4))
					.andExpect(jsonPath("$.gesamtSeiten").value(2))
					.andExpect(jsonPath("$.inhalt.length()").value(1))
					// Springs Page-Felder duerfen nicht durchschlagen (§6.6).
					.andExpect(jsonPath("$.pageable").doesNotExist())
					.andExpect(jsonPath("$.totalElements").doesNotExist());
		}

		@Test
		@DisplayName("Ueber alle Seiten kommt jedes Projekt genau einmal")
		void blaetternOhneLuecken() throws Exception {
			List<UUID> ersteSeite = idsDerListe(admin, "page", "0", "size", "2");
			List<UUID> zweiteSeite = idsDerListe(admin, "page", "1", "size", "2");

			assertThat(ersteSeite).hasSize(2);
			assertThat(zweiteSeite).hasSize(2);
			assertThat(ersteSeite).doesNotContainAnyElementsOf(zweiteSeite);
		}

		@Test
		@DisplayName("sort=titel,asc ordnet nach Titel")
		void sortierungNachTitel() throws Exception {
			assertThat(titelDerListe(admin, "sort", "titel,asc"))
					.containsExactly("Alpha Entwurf", "Beta Portfolio", "Delta Gruppenarbeit", "Gamma Review");
		}

		@Test
		@DisplayName("sort=titel,desc dreht die Reihenfolge um")
		void sortierungAbsteigend() throws Exception {
			assertThat(titelDerListe(admin, "sort", "titel,desc"))
					.containsExactly("Gamma Review", "Delta Gruppenarbeit", "Beta Portfolio", "Alpha Entwurf");
		}

		@Test
		@DisplayName("Nicht erlaubtes Sortierfeld: 400 statt 500, und kein Zugriff auf fremde Pfade")
		void unerlaubtesSortierfeld() throws Exception {
			mockMvc.perform(alsBenutzer(listenAnfrage("sort", "autor.passwortHash,asc"), admin))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN));
		}
	}

	// ==================================================================
	// GET /api/projekte/{id}
	// ==================================================================

	@Nested
	@DisplayName("Detail: Fehlerpolitik nach §6.3.1")
	class DetailFehler {

		@Test
		@DisplayName("Unbekannte ID: 404 PROJEKT_NICHT_GEFUNDEN")
		void unbekannteId() throws Exception {
			UUID id = UUID.randomUUID();

			mockMvc.perform(get("/api/projekte/" + id))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.PROJEKT_NICHT_GEFUNDEN));
		}

		@Test
		@DisplayName("Fremder Entwurf ohne Anmeldung: 401 NICHT_AUTHENTIFIZIERT")
		void fremderEntwurfOhneToken() throws Exception {
			mockMvc.perform(get("/api/projekte/" + entwurfDesAutors.getId()))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.status").value(401))
					.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.NICHT_AUTHENTIFIZIERT));
		}

		@Test
		@DisplayName("Fremder Entwurf mit Token einer unbeteiligten Person: 403 KEINE_BERECHTIGUNG")
		void fremderEntwurfOhneLeserecht() throws Exception {
			mockMvc.perform(alsBenutzer(get("/api/projekte/" + entwurfDesAutors.getId()), fremderStudi))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.status").value(403))
					.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.KEINE_BERECHTIGUNG));
		}

		@Test
		@DisplayName("Die Autor:in bekommt ihren eigenen Entwurf")
		void eigenerEntwurf() throws Exception {
			mockMvc.perform(alsBenutzer(get("/api/projekte/" + entwurfDesAutors.getId()), autor))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.titel").value("Alpha Entwurf"));
		}

		@Test
		@DisplayName("Ein veroeffentlichtes Projekt ist auch ohne Token lesbar")
		void veroeffentlichtesOhneToken() throws Exception {
			mockMvc.perform(get("/api/projekte/" + veroeffentlichtesProjekt.getId()))
					.andExpect(status().isOk());
		}
	}

	@Nested
	@DisplayName("Detail: Inhalt der Antwort")
	class DetailInhalt {

		@Test
		@DisplayName("Metadaten, Bezuege, version und Zeitstempel")
		void metadaten() throws Exception {
			mockMvc.perform(get("/api/projekte/" + veroeffentlichtesProjekt.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.id").value(veroeffentlichtesProjekt.getId().toString()))
					.andExpect(jsonPath("$.titel").value("Beta Portfolio"))
					.andExpect(jsonPath("$.status").value("VEROEFFENTLICHT"))
					.andExpect(jsonPath("$.projekttyp").value("THESIS"))
					.andExpect(jsonPath("$.abschluss").value("BACHELOR"))
					.andExpect(jsonPath("$.semester").value(semester))
					.andExpect(jsonPath("$.kategorie.id").value(kategorie.getId().toString()))
					.andExpect(jsonPath("$.studiengang.kuerzel").value(studiengang.getKuerzel()))
					.andExpect(jsonPath("$.modul.id").value(modul.getId().toString()))
					.andExpect(jsonPath("$.autor.id").value(autor.getId().toString()))
					.andExpect(jsonPath("$.version").exists())
					.andExpect(jsonPath("$.erstelltAm").exists())
					.andExpect(jsonPath("$.aktualisiertAm").exists())
					.andExpect(jsonPath("$.veroeffentlichtAm").exists())
					// Tags kommen alphabetisch, damit die Antwort stabil ist.
					.andExpect(jsonPath("$.tags[0]").value("react"))
					.andExpect(jsonPath("$.tags[1]").value("ux"));
		}

		@Test
		@DisplayName("Bloecke kommen nach reihenfolge geordnet, mit unveraendertem inhalt")
		void bloeckeGeordnet() throws Exception {
			blockRepository.saveAndFlush(TestProjekt.blockOhneId(veroeffentlichtesProjekt,
					BlockTyp.TEXT, 1, prosemirror("paragraph", "zweiter")));
			blockRepository.saveAndFlush(TestProjekt.blockOhneId(veroeffentlichtesProjekt,
					BlockTyp.UEBERSCHRIFT, 0, prosemirror("heading", "erster")));

			mockMvc.perform(get("/api/projekte/" + veroeffentlichtesProjekt.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.blocks.length()").value(2))
					.andExpect(jsonPath("$.blocks[0].typ").value("UEBERSCHRIFT"))
					.andExpect(jsonPath("$.blocks[0].reihenfolge").value(0))
					.andExpect(jsonPath("$.blocks[0].schemaVersion").value(1))
					.andExpect(jsonPath("$.blocks[0].inhalt.type").value("heading"))
					.andExpect(jsonPath("$.blocks[1].typ").value("TEXT"))
					.andExpect(jsonPath("$.blocks[1].reihenfolge").value(1));
		}

		@Test
		@DisplayName("Mitglieder erscheinen mit userId, Namen und Rolle im Projekt (§3.13)")
		void mitglieder() throws Exception {
			mockMvc.perform(alsBenutzer(
							get("/api/projekte/" + fremderEntwurfMitMitglied.getId()), mitglied))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.mitglieder.length()").value(1))
					.andExpect(jsonPath("$.mitglieder[0].userId").value(mitglied.getId().toString()))
					.andExpect(jsonPath("$.mitglieder[0].rolleImProjekt").value("Frontend"));
		}

		@Test
		@DisplayName("reaktionAnzahl ist die Zahl der Reaktionen (§3.10)")
		void reaktionAnzahl() throws Exception {
			reaktionRepository.saveAndFlush(
					TestReaktion.ohneId(veroeffentlichtesProjekt, mitglied));
			reaktionRepository.saveAndFlush(
					TestReaktion.ohneId(veroeffentlichtesProjekt, fremderStudi));

			mockMvc.perform(get("/api/projekte/" + veroeffentlichtesProjekt.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.reaktionAnzahl").value(2));

			// Dieselbe Zahl in der Kachel; Projekte ohne Reaktion zaehlen als 0.
			mockMvc.perform(alsBenutzer(listenAnfrage("sort", "titel,asc"), admin))
					.andExpect(jsonPath("$.inhalt[0].reaktionAnzahl").value(0))
					.andExpect(jsonPath("$.inhalt[1].reaktionAnzahl").value(2));
		}

		@Test
		@DisplayName("Weder passwortHash noch hsbEmail stehen irgendwo in der Antwort (§3.1)")
		void keineSensiblenFelder() throws Exception {
			String detail = koerper(get("/api/projekte/" + veroeffentlichtesProjekt.getId()));
			String liste = koerper(alsBenutzer(listenAnfrage(), admin));

			assertThat(detail).doesNotContain("passwortHash", "hsbEmail", autor.getHsbEmail());
			assertThat(liste).doesNotContain("passwortHash", "hsbEmail", autor.getHsbEmail());
		}
	}

	@Nested
	@DisplayName("Detail: redakteure und Statushistorie (§3.12, §5 Fussnote 7)")
	class Projektinterna {

		@BeforeEach
		void historieAnlegen() {
			statusHistorieRepository.saveAndFlush(TestProjekt.historieOhneId(
					veroeffentlichtesProjekt, null, ProjektStatus.ENTWURF, autor, Instant.now()));
			veroeffentlichtesProjekt.getRedakteure().add(zugewiesenerRedakteur);
			projektRepository.saveAndFlush(veroeffentlichtesProjekt);
		}

		@Test
		@DisplayName("Fuer PUBLIC stehen beide Felder auf null, nicht auf der leeren Liste")
		void publicSiehtNichts() throws Exception {
			mockMvc.perform(get("/api/projekte/" + veroeffentlichtesProjekt.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.redakteure").value(nullValue()))
					.andExpect(jsonPath("$.statusHistorie").value(nullValue()));
		}

		@Test
		@DisplayName("Unbeteiligte Angemeldete sehen sie ebenfalls nicht")
		void unbeteiligteSehenNichts() throws Exception {
			mockMvc.perform(alsBenutzer(
							get("/api/projekte/" + veroeffentlichtesProjekt.getId()), fremderStudi))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.redakteure").value(nullValue()))
					.andExpect(jsonPath("$.statusHistorie").value(nullValue()));
		}

		@Test
		@DisplayName("Die Autor:in sieht Zuweisung und Verlauf")
		void autorSiehtBeides() throws Exception {
			mockMvc.perform(alsBenutzer(
							get("/api/projekte/" + veroeffentlichtesProjekt.getId()), autor))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.redakteure.length()").value(1))
					.andExpect(jsonPath("$.redakteure[0].id")
							.value(zugewiesenerRedakteur.getId().toString()))
					.andExpect(jsonPath("$.statusHistorie.length()").value(1))
					.andExpect(jsonPath("$.statusHistorie[0].vonStatus").doesNotExist())
					.andExpect(jsonPath("$.statusHistorie[0].nachStatus").value("ENTWURF"))
					.andExpect(jsonPath("$.statusHistorie[0].geaendertVon.id")
							.value(autor.getId().toString()));
		}

		@Test
		@DisplayName("Die zugewiesene Redaktion sieht sie, eine nicht zugewiesene nicht")
		void nurZugewieseneRedaktion() throws Exception {
			mockMvc.perform(alsBenutzer(
							get("/api/projekte/" + veroeffentlichtesProjekt.getId()), zugewiesenerRedakteur))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.statusHistorie.length()").value(1));

			// Lesen darf sie das Projekt trotzdem, nur die Interna nicht.
			mockMvc.perform(alsBenutzer(
							get("/api/projekte/" + veroeffentlichtesProjekt.getId()), andererRedakteur))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.titel").value("Beta Portfolio"))
					.andExpect(jsonPath("$.statusHistorie").value(nullValue()));
		}

		@Test
		@DisplayName("Der Admin sieht sie bei jedem Projekt")
		void adminSiehtBeides() throws Exception {
			mockMvc.perform(alsBenutzer(
							get("/api/projekte/" + veroeffentlichtesProjekt.getId()), admin))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.redakteure.length()").value(1))
					.andExpect(jsonPath("$.statusHistorie.length()").value(1));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User speichere(Rolle rolle) {
		return userRepository.saveAndFlush(TestUser.aktivOhneId(rolle, "nicht-relevant"));
	}

	private Projekt neuesProjekt(User besitzer, ProjektStatus status, String titel) {
		Projekt projekt = TestProjekt.ohneId(besitzer, status, titel);
		projekt.setSemester(semester);
		return projektRepository.saveAndFlush(projekt);
	}

	private JsonNode prosemirror(String typ, String text) {
		return objectMapper.createObjectNode()
				.put("type", typ)
				.put("text", text);
	}

	/**
	 * Listenanfrage, immer auf das Semester dieses Laufs eingegrenzt und mit
	 * einer Seitengroesse, die alle Testprojekte aufnimmt.
	 *
	 * <p>Die Parameter laufen ueber eine Map und nicht direkt in den Builder,
	 * damit ein Aufruf {@code listenAnfrage("size", "3")} die Vorgabe wirklich
	 * ersetzt. Zweimal {@code size} im selben Request wuerde Spring nicht
	 * zusammenfuehren, sondern den ersten Wert nehmen, und der Test pruefte
	 * dann etwas anderes als gemeint.
	 *
	 * @param zusatz Paare aus Parametername und Wert
	 */
	private MockHttpServletRequestBuilder listenAnfrage(String... zusatz) {
		Map<String, String> parameter = new LinkedHashMap<>();
		parameter.put("semester", semester);
		parameter.put("size", "50");
		for (int i = 0; i + 1 < zusatz.length; i += 2) {
			parameter.put(zusatz[i], zusatz[i + 1]);
		}

		MockHttpServletRequestBuilder anfrage = get("/api/projekte");
		for (Map.Entry<String, String> eintrag : parameter.entrySet()) {
			anfrage = anfrage.param(eintrag.getKey(), eintrag.getValue());
		}
		return anfrage;
	}

	/** Haengt ein echtes Bearer-Token an; {@code null} laesst die Anfrage anonym. */
	private MockHttpServletRequestBuilder alsBenutzer(MockHttpServletRequestBuilder anfrage, User user) {
		if (user == null) {
			return anfrage;
		}
		String token = jwtService.erzeugeToken(AngemeldeterBenutzer.aus(user));
		return anfrage.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	private List<UUID> idsDerListe(User user, String... zusatz) throws Exception {
		return feldDerListe(user, "id", zusatz).stream().map(UUID::fromString).toList();
	}

	private List<String> titelDerListe(User user, String... zusatz) throws Exception {
		return feldDerListe(user, "titel", zusatz);
	}

	/**
	 * Liest ein Feld aus jeder Kachel der Antwort, in der gelieferten
	 * Reihenfolge.
	 *
	 * <p>Bewusst mit einer Schleife ueber die Elemente und nicht mit
	 * {@code findValuesAsText}: das durchsucht den Baum rekursiv und wuerde
	 * unter „id" auch die IDs von Kategorie, Fakultaet und Autor:in einsammeln.
	 */
	private List<String> feldDerListe(User user, String feld, String... zusatz) throws Exception {
		JsonNode antwort = objectMapper.readTree(koerper(alsBenutzer(listenAnfrage(zusatz), user)));

		List<String> werte = new ArrayList<>();
		for (JsonNode kachel : antwort.get("inhalt")) {
			werte.add(kachel.get(feld).asText());
		}
		return werte;
	}

	/**
	 * Fuehrt die Anfrage aus, erwartet 200 und liefert den Koerper. Bewusst mit
	 * ausdruecklichem UTF-8, damit Umlaute in Titeln nicht am Zeichensatz der
	 * Testantwort scheitern.
	 */
	private String koerper(MockHttpServletRequestBuilder anfrage) throws Exception {
		return mockMvc.perform(anfrage)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}
}
