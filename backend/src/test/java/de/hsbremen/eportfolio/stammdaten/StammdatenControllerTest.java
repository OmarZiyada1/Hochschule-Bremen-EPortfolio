package de.hsbremen.eportfolio.stammdaten;

import static org.mockito.ArgumentMatchers.any;
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
import de.hsbremen.eportfolio.common.error.ApiFehlerSchreiber;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.config.CorsEigenschaften;
import de.hsbremen.eportfolio.config.SecurityConfig;
import de.hsbremen.eportfolio.stammdaten.dto.FakultaetAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.KategorieAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.ModulAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.StudiengangAntwort;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Tests der HTTP-Schicht der Stammdaten-Endpoints ueber die volle Filterkette:
 * Erreichbarkeit ohne Token (PUBLIC, §5), Bindung der Filterparameter und das
 * Fehlerformat aus §6.2.
 *
 * <p>Bewusst ein {@code @WebMvcTest} ohne Datenbank — die fachliche Seite deckt
 * {@link StammdatenServiceTest} ab, das Zusammenspiel mit echten Daten
 * {@link StammdatenIntegrationTest}.
 */
@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = StammdatenController.class)
@Import({SecurityConfig.class, JwtAuthentifizierungsFilter.class, RestAuthentifizierungsEinstieg.class,
		RestZugriffVerweigertHandler.class, ApiFehlerSchreiber.class, GlobalExceptionHandler.class,
		StammdatenControllerTest.Testkonfiguration.class})
class StammdatenControllerTest {

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
	private StammdatenService stammdatenService;

	/** Wird vom {@link JwtAuthentifizierungsFilter} gebraucht, hier aber nie befragt. */
	@MockitoBean
	private UserRepository userRepository;

	// --- Erreichbarkeit ohne Token (PUBLIC, §5) ----------------------------

	@Test
	@DisplayName("GET /api/kategorien: 200 ohne Token")
	void kategorienOhneToken() throws Exception {
		UUID id = UUID.randomUUID();
		when(stammdatenService.kategorien()).thenReturn(List.of(new KategorieAntwort(id, "Praxisprojekt")));

		mockMvc.perform(get("/api/kategorien"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$[0].id").value(id.toString()))
				.andExpect(jsonPath("$[0].name").value("Praxisprojekt"));
	}

	@Test
	@DisplayName("GET /api/fakultaeten: 200 ohne Token, mit Kuerzel")
	void fakultaetenOhneToken() throws Exception {
		UUID id = UUID.randomUUID();
		when(stammdatenService.fakultaeten())
				.thenReturn(List.of(new FakultaetAntwort(id, "Elektrotechnik und Informatik", "FK4")));

		mockMvc.perform(get("/api/fakultaeten"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].kuerzel").value("FK4"))
				.andExpect(jsonPath("$[0].name").value("Elektrotechnik und Informatik"));
	}

	@Test
	@DisplayName("GET /api/studiengaenge: 200 ohne Token, mit fakultaetId")
	void studiengaengeOhneToken() throws Exception {
		UUID id = UUID.randomUUID();
		UUID fakultaetId = UUID.randomUUID();
		when(stammdatenService.studiengaenge(null))
				.thenReturn(List.of(new StudiengangAntwort(id, "Informatik", "INF", fakultaetId)));

		mockMvc.perform(get("/api/studiengaenge"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].fakultaetId").value(fakultaetId.toString()))
				.andExpect(jsonPath("$[0].kuerzel").value("INF"));
	}

	@Test
	@DisplayName("GET /api/module: 200 ohne Token, mit studiengangId")
	void moduleOhneToken() throws Exception {
		UUID id = UUID.randomUUID();
		UUID studiengangId = UUID.randomUUID();
		when(stammdatenService.module(null))
				.thenReturn(List.of(new ModulAntwort(id, "Softwaretechnik", "SWT", studiengangId)));

		mockMvc.perform(get("/api/module"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].studiengangId").value(studiengangId.toString()))
				.andExpect(jsonPath("$[0].name").value("Softwaretechnik"));
	}

	// --- Filterparameter ---------------------------------------------------

	@Test
	@DisplayName("?fakultaet=<uuid> wird an den Service durchgereicht")
	void studiengaengeMitFilter() throws Exception {
		UUID fakultaetId = UUID.randomUUID();
		when(stammdatenService.studiengaenge(fakultaetId)).thenReturn(List.of());

		mockMvc.perform(get("/api/studiengaenge").param("fakultaet", fakultaetId.toString()))
				.andExpect(status().isOk());

		verify(stammdatenService).studiengaenge(fakultaetId);
	}

	@Test
	@DisplayName("Ohne ?fakultaet kommt null beim Service an, nicht etwa ein Default")
	void studiengaengeOhneFilterParameter() throws Exception {
		when(stammdatenService.studiengaenge(null)).thenReturn(List.of());

		mockMvc.perform(get("/api/studiengaenge")).andExpect(status().isOk());

		verify(stammdatenService).studiengaenge(isNull());
	}

	@Test
	@DisplayName("?studiengang=<uuid> wird an den Service durchgereicht")
	void moduleMitFilter() throws Exception {
		UUID studiengangId = UUID.randomUUID();
		when(stammdatenService.module(studiengangId)).thenReturn(List.of());

		mockMvc.perform(get("/api/module").param("studiengang", studiengangId.toString()))
				.andExpect(status().isOk());

		verify(stammdatenService).module(studiengangId);
	}

	@Test
	@DisplayName("Leere Liste ist 200 mit [], nicht 404")
	void leereListe() throws Exception {
		when(stammdatenService.module(any())).thenReturn(List.of());

		mockMvc.perform(get("/api/module").param("studiengang", UUID.randomUUID().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$").isEmpty());
	}

	// --- Fehlerformat ------------------------------------------------------

	@Test
	@DisplayName("Ungueltige UUID im Filter: 400 im Envelope aus §6.2")
	void filterKeineUuid() throws Exception {
		mockMvc.perform(get("/api/studiengaenge").param("fakultaet", "keine-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.fehlercode").value("VALIDIERUNG_FEHLGESCHLAGEN"))
				.andExpect(jsonPath("$.zeitpunkt").exists())
				.andExpect(jsonPath("$.pfad").value("/api/studiengaenge"))
				// Der eingeschickte Wert darf nicht in der Antwort auftauchen.
				.andExpect(jsonPath("$.meldung").value(
						org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("keine-uuid"))));
	}
}
