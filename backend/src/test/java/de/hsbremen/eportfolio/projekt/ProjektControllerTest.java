package de.hsbremen.eportfolio.projekt;

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

import de.hsbremen.eportfolio.auth.JwtAuthentifizierungsFilter;
import de.hsbremen.eportfolio.auth.JwtEigenschaften;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.auth.RestAuthentifizierungsEinstieg;
import de.hsbremen.eportfolio.auth.RestZugriffVerweigertHandler;
import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.dto.SeiteAntwort;
import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import de.hsbremen.eportfolio.common.error.ApiFehlerSchreiber;
import de.hsbremen.eportfolio.common.error.Fehlercodes;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.common.error.RessourceNichtGefundenException;
import de.hsbremen.eportfolio.common.error.ValidierungException;
import de.hsbremen.eportfolio.config.CorsEigenschaften;
import de.hsbremen.eportfolio.config.SecurityConfig;
import de.hsbremen.eportfolio.projekt.dto.ProjektFilterAnfrage;
import de.hsbremen.eportfolio.projekt.dto.ProjektKachelAntwort;
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
 * echte Daten, prueft {@link ProjektLeseIntegrationTest}. Hier geht es
 * ausschliesslich darum, dass die Werte richtig ankommen und die Ausnahmen im
 * richtigen Envelope wieder herauskommen.
 */
@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = ProjektController.class)
@Import({SecurityConfig.class, JwtAuthentifizierungsFilter.class, RestAuthentifizierungsEinstieg.class,
		RestZugriffVerweigertHandler.class, ApiFehlerSchreiber.class, GlobalExceptionHandler.class,
		ProjektControllerTest.Testkonfiguration.class})
class ProjektControllerTest {

	@TestConfiguration
	static class Testkonfiguration {

		@Bean
		JwtEigenschaften jwtEigenschaften() {
			return new JwtEigenschaften("a".repeat(88), Duration.ofHours(8), "eportfolio");
		}

		@Bean
		JwtService jwtService(JwtEigenschaften eigenschaften) {
			return new JwtService(eigenschaften);
		}

		@Bean
		CorsEigenschaften corsEigenschaften() {
			return new CorsEigenschaften(null);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private ProjektLeseService projektLeseService;

	/** Wird vom {@link JwtAuthentifizierungsFilter} gebraucht, hier aber nie befragt. */
	@MockitoBean
	private UserRepository userRepository;

	// --- Erreichbarkeit ohne Token (PUBLIC, §5) ----------------------------

	@Test
	@DisplayName("GET /api/projekte: 200 ohne Token, Antwort im Seitenformat aus §6.6")
	void listeOhneToken() throws Exception {
		when(projektLeseService.liste(isNull(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projekte"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.inhalt").isArray())
				.andExpect(jsonPath("$.seite").value(0))
				.andExpect(jsonPath("$.groesse").value(20))
				.andExpect(jsonPath("$.gesamtElemente").value(0))
				.andExpect(jsonPath("$.gesamtSeiten").value(0));
	}

	@Test
	@DisplayName("Ohne Token kommt null als Benutzer beim Dienst an, das ist der PUBLIC-Fall")
	void ohneTokenIstBenutzerNull() throws Exception {
		when(projektLeseService.liste(any(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projekte")).andExpect(status().isOk());

		verify(projektLeseService).liste(isNull(), any(ProjektFilterAnfrage.class), any(Pageable.class));
	}

	@Test
	@DisplayName("GET /api/projekte/{id}: 200 ohne Token")
	void detailOhneToken() throws Exception {
		UUID id = UUID.randomUUID();
		when(projektLeseService.detail(isNull(), eq(id))).thenReturn(null);

		mockMvc.perform(get("/api/projekte/" + id)).andExpect(status().isOk());

		verify(projektLeseService).detail(isNull(), eq(id));
	}

	// --- Bindung der Filterparameter (§6.1) --------------------------------

	@Test
	@DisplayName("Alle elf Filter kommen unveraendert beim Dienst an")
	void alleFilterWerdenDurchgereicht() throws Exception {
		UUID kategorie = UUID.randomUUID();
		UUID fakultaet = UUID.randomUUID();
		UUID studiengang = UUID.randomUUID();
		UUID modul = UUID.randomUUID();
		UUID autor = UUID.randomUUID();
		when(projektLeseService.liste(any(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projekte")
						.param("kategorie", kategorie.toString())
						.param("fakultaet", fakultaet.toString())
						.param("studiengang", studiengang.toString())
						.param("modul", modul.toString())
						.param("abschluss", "MASTER")
						.param("typ", "THESIS")
						.param("semester", "WS 2025/26")
						.param("q", "Portfolio")
						.param("status", "VEROEFFENTLICHT")
						.param("autor", autor.toString())
						.param("redakteur", "me"))
				.andExpect(status().isOk());

		ProjektFilterAnfrage filter = gefangenerFilter();
		assertThat(filter.kategorie()).isEqualTo(kategorie);
		assertThat(filter.fakultaet()).isEqualTo(fakultaet);
		assertThat(filter.studiengang()).isEqualTo(studiengang);
		assertThat(filter.modul()).isEqualTo(modul);
		assertThat(filter.abschluss()).isEqualTo(Abschluss.MASTER);
		assertThat(filter.typ()).isEqualTo(Projekttyp.THESIS);
		assertThat(filter.semester()).isEqualTo("WS 2025/26");
		assertThat(filter.q()).isEqualTo("Portfolio");
		assertThat(filter.status()).isEqualTo(ProjektStatus.VEROEFFENTLICHT);
		assertThat(filter.autor()).isEqualTo(autor);
		assertThat(filter.redakteur()).isEqualTo("me");
	}

	@Test
	@DisplayName("Ohne Filterparameter ist jedes Feld null, nicht etwa ein Default")
	void ohneFilterAllesNull() throws Exception {
		when(projektLeseService.liste(any(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projekte")).andExpect(status().isOk());

		ProjektFilterAnfrage filter = gefangenerFilter();
		assertThat(filter.kategorie()).isNull();
		assertThat(filter.abschluss()).isNull();
		assertThat(filter.q()).isNull();
		assertThat(filter.redakteur()).isNull();
	}

	// --- Paginierung und Sortierung (§1) -----------------------------------

	@Test
	@DisplayName("Ohne page und size gelten 0 und 20, sortiert nach aktualisiertAm absteigend")
	void standardPaginierung() throws Exception {
		when(projektLeseService.liste(any(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/projekte")).andExpect(status().isOk());

		Pageable seitenwunsch = gefangenerSeitenwunsch();
		assertThat(seitenwunsch.getPageNumber()).isZero();
		assertThat(seitenwunsch.getPageSize()).isEqualTo(20);
		assertThat(seitenwunsch.getSort().getOrderFor("aktualisiertAm"))
				.isNotNull()
				.extracting(Sort.Order::getDirection)
				.isEqualTo(Sort.Direction.DESC);
	}

	@Test
	@DisplayName("?page, ?size und ?sort=<feld>,<richtung> werden gebunden")
	void paginierungUeberschreiben() throws Exception {
		when(projektLeseService.liste(any(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(), 2, 5, 0, 0));

		mockMvc.perform(get("/api/projekte")
						.param("page", "2")
						.param("size", "5")
						.param("sort", "titel,asc"))
				.andExpect(status().isOk());

		Pageable seitenwunsch = gefangenerSeitenwunsch();
		assertThat(seitenwunsch.getPageNumber()).isEqualTo(2);
		assertThat(seitenwunsch.getPageSize()).isEqualTo(5);
		assertThat(seitenwunsch.getSort().getOrderFor("titel"))
				.isNotNull()
				.extracting(Sort.Order::getDirection)
				.isEqualTo(Sort.Direction.ASC);
	}

	// --- Fehlerformat (§6.2, §6.3.1) ---------------------------------------

	@Test
	@DisplayName("Ungueltige UUID im Filter: 400 im Envelope, ohne den eingeschickten Wert")
	void filterKeineUuid() throws Exception {
		mockMvc.perform(get("/api/projekte").param("kategorie", "keine-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN))
				.andExpect(jsonPath("$.zeitpunkt").exists())
				.andExpect(jsonPath("$.pfad").value("/api/projekte"))
				.andExpect(jsonPath("$.meldung", not(containsString("keine-uuid"))));
	}

	@Test
	@DisplayName("Unbekannter Enum-Wert: 400 im Envelope")
	void filterUnbekanntesEnum() throws Exception {
		mockMvc.perform(get("/api/projekte").param("abschluss", "DIPLOM"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN))
				.andExpect(jsonPath("$.meldung", not(containsString("DIPLOM"))));
	}

	@Test
	@DisplayName("Ungueltige Projekt-ID im Pfad: 400 im Envelope")
	void detailKeineUuid() throws Exception {
		mockMvc.perform(get("/api/projekte/keine-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN));
	}

	@Test
	@DisplayName("Unerlaubtes Sortierfeld: 400 im Envelope")
	void unerlaubtesSortierfeld() throws Exception {
		when(projektLeseService.liste(any(), any(), any()))
				.thenThrow(new ValidierungException(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN,
						"Nach diesem Feld kann nicht sortiert werden."));

		mockMvc.perform(get("/api/projekte").param("sort", "autor.passwortHash,asc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN));
	}

	@Test
	@DisplayName("Unbekannte Projekt-ID: 404 PROJEKT_NICHT_GEFUNDEN im Envelope (§6.3.1)")
	void detailNichtGefunden() throws Exception {
		UUID id = UUID.randomUUID();
		when(projektLeseService.detail(any(), eq(id)))
				.thenThrow(RessourceNichtGefundenException.fuerProjekt(id));

		mockMvc.perform(get("/api/projekte/" + id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.PROJEKT_NICHT_GEFUNDEN))
				.andExpect(jsonPath("$.pfad").value("/api/projekte/" + id));
	}

	@Test
	@DisplayName("Vorhandenes Projekt ohne Anmeldung: 401 NICHT_AUTHENTIFIZIERT (§6.3.1)")
	void detailOhneAnmeldung() throws Exception {
		UUID id = UUID.randomUUID();
		when(projektLeseService.detail(any(), eq(id)))
				.thenThrow(new AuthenticationCredentialsNotFoundException("Anmeldung erforderlich."));

		mockMvc.perform(get("/api/projekte/" + id))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.NICHT_AUTHENTIFIZIERT));
	}

	@Test
	@DisplayName("Vorhandenes Projekt ohne Leserecht: 403 KEINE_BERECHTIGUNG (§6.3.1)")
	void detailOhneLeserecht() throws Exception {
		UUID id = UUID.randomUUID();
		when(projektLeseService.detail(any(), eq(id)))
				.thenThrow(new AccessDeniedException("Keine Leseberechtigung."));

		mockMvc.perform(get("/api/projekte/" + id))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.KEINE_BERECHTIGUNG));
	}

	@Test
	@DisplayName("\"redakteur=me\" ohne Anmeldung: 401 im Envelope")
	void redakteurMeOhneAnmeldung() throws Exception {
		when(projektLeseService.liste(any(), any(), any()))
				.thenThrow(new AuthenticationCredentialsNotFoundException(
						"Der Filter \"redakteur=me\" setzt eine Anmeldung voraus."));

		mockMvc.perform(get("/api/projekte").param("redakteur", "me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.NICHT_AUTHENTIFIZIERT));
	}

	@Test
	@DisplayName("Unbrauchbares Token: 401 TOKEN_UNGUELTIG aus dem Filter, nicht 200 als PUBLIC")
	void kaputtesToken() throws Exception {
		mockMvc.perform(get("/api/projekte").header("Authorization", "Bearer kaputt"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value(Fehlercodes.TOKEN_UNGUELTIG));
	}

	// --- Antwortinhalt -----------------------------------------------------

	@Test
	@DisplayName("Die Kachel liefert genau die Felder aus §6.1")
	void kachelfelder() throws Exception {
		UUID id = UUID.randomUUID();
		ProjektKachelAntwort kachel = new ProjektKachelAntwort(
				id, "Titel", "Teaser", "/api/dateien/1", ProjektStatus.VEROEFFENTLICHT,
				Projekttyp.THESIS, Abschluss.BACHELOR, "WS 2025/26",
				null, null, null, null, List.of("react", "ux"), 3, null);
		when(projektLeseService.liste(any(), any(), any()))
				.thenReturn(new SeiteAntwort<>(List.of(kachel), 0, 20, 1, 1));

		mockMvc.perform(get("/api/projekte"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.inhalt[0].id").value(id.toString()))
				.andExpect(jsonPath("$.inhalt[0].titel").value("Titel"))
				.andExpect(jsonPath("$.inhalt[0].status").value("VEROEFFENTLICHT"))
				.andExpect(jsonPath("$.inhalt[0].projekttyp").value("THESIS"))
				.andExpect(jsonPath("$.inhalt[0].abschluss").value("BACHELOR"))
				.andExpect(jsonPath("$.inhalt[0].semester").value("WS 2025/26"))
				.andExpect(jsonPath("$.inhalt[0].tags[0]").value("react"))
				.andExpect(jsonPath("$.inhalt[0].reaktionAnzahl").value(3));
	}

	// --- Hilfsmittel -------------------------------------------------------

	private ProjektFilterAnfrage gefangenerFilter() {
		ArgumentCaptor<ProjektFilterAnfrage> fang = ArgumentCaptor.forClass(ProjektFilterAnfrage.class);
		verify(projektLeseService).liste(any(), fang.capture(), any());
		return fang.getValue();
	}

	private Pageable gefangenerSeitenwunsch() {
		ArgumentCaptor<Pageable> fang = ArgumentCaptor.forClass(Pageable.class);
		verify(projektLeseService).liste(any(), any(), fang.capture());
		return fang.getValue();
	}
}
