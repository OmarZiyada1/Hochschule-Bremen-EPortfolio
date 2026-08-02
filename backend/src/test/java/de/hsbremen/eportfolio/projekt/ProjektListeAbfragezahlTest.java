package de.hsbremen.eportfolio.projekt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.benutzer.TestUser;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.reaktion.ReaktionRepository;
import de.hsbremen.eportfolio.reaktion.TestReaktion;
import de.hsbremen.eportfolio.stammdaten.FakultaetRepository;
import de.hsbremen.eportfolio.stammdaten.KategorieRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Haelt fest, dass {@code GET /api/projekte} kein N+1-Verhalten zeigt: die Zahl
 * der Datenbankabfragen bleibt gleich, egal wie viele Projekte auf der Seite
 * stehen.
 *
 * <p>Das ist der technische Hinweis aus KAN-16 („N+1 im Blick behalten"), und
 * er laesst sich nur so festhalten. Ohne diesen Test wuerde ein spaeter
 * entfernter {@code @EntityGraph} oder ein zusaetzliches Feld in der Kachel,
 * das eine Beziehung nachlaedt, unbemerkt aus einer Abfrage je Seite eine je
 * Kachel machen. Funktional faellt das nicht auf, die Antwort bliebe richtig.
 *
 * <p>Gezaehlt wird ueber Hibernates {@link Statistics}, die dieser Test eigens
 * einschaltet. Vor jeder Messung wird der Persistenzkontext geleert, sonst
 * beantwortete Hibernate die Abfragen aus dem First-Level-Cache und die Messung
 * waere wertlos.
 *
 * <p>Geprueft wird die Gleichheit zweier Messungen und keine feste Zahl: die
 * absolute Zahl haengt daran, wie Spring Data die Zaehlabfrage baut, und wuerde
 * bei jedem Framework-Update wackeln, ohne dass sich fachlich etwas geaendert
 * haette.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Transactional
class ProjektListeAbfragezahlTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjektRepository projektRepository;

	@Autowired
	private ReaktionRepository reaktionRepository;

	@Autowired
	private KategorieRepository kategorieRepository;

	@Autowired
	private FakultaetRepository fakultaetRepository;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@PersistenceContext
	private EntityManager entityManager;

	private String semester;

	private User autor;

	private User reagierende;

	@BeforeEach
	void nutzerAnlegen() {
		semester = "KAN16-N1 " + UUID.randomUUID();
		autor = userRepository.saveAndFlush(TestUser.aktivOhneId(Rolle.STUDIERENDE, "nicht-relevant"));
		reagierende = userRepository.saveAndFlush(TestUser.aktivOhneId(Rolle.STUDIERENDE, "nicht-relevant"));
	}

	@Test
	@DisplayName("Zehn Kacheln kosten so viele Abfragen wie zwei")
	void abfragezahlWaechstNichtMitDerSeitengroesse() throws Exception {
		lege(2);
		long beiZwei = abfragenFuerListe(2);

		lege(8);
		long beiZehn = abfragenFuerListe(10);

		assertThat(beiZehn)
				.as("Die Kachelliste darf pro Projekt keine eigene Abfrage ausloesen")
				.isEqualTo(beiZwei);
	}

	// --- Hilfsmittel -------------------------------------------------------

	/**
	 * Legt Projekte an, die jede in der Kachel gezeigte Beziehung benutzen:
	 * Stammdatenbezuege, Tags und Reaktionen. Ohne sie liefe der Test ins
	 * Leere, weil es gar nichts nachzuladen gaebe.
	 */
	private void lege(int anzahl) {
		var kategorie = kategorieRepository.findAllByOrderByNameAsc().getFirst();
		var fakultaet = fakultaetRepository.findAllByOrderByNameAsc().getFirst();

		for (int i = 0; i < anzahl; i++) {
			Projekt projekt = TestProjekt.ohneId(autor, ProjektStatus.VEROEFFENTLICHT, "Projekt " + i);
			projekt.setSemester(semester);
			projekt.setKategorie(kategorie);
			projekt.setFakultaet(fakultaet);
			projekt.setVeroeffentlichtAm(Instant.now());
			projekt = projektRepository.saveAndFlush(projekt);

			projekt.getTags().addAll(List.of("tag-a", "tag-b"));
			projektRepository.saveAndFlush(projekt);

			reaktionRepository.saveAndFlush(TestReaktion.ohneId(projekt, reagierende));
		}
	}

	/** Ruft die Liste als PUBLIC ab und gibt die Zahl der dabei abgesetzten Abfragen zurueck. */
	private long abfragenFuerListe(int erwarteteKacheln) throws Exception {
		entityManager.flush();
		entityManager.clear();

		Statistics statistik = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistik.clear();

		mockMvc.perform(get("/api/projekte")
						.param("semester", semester)
						.param("size", "50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.inhalt.length()").value(erwarteteKacheln))
				// Gegenprobe, dass wirklich etwas nachzuladen war.
				.andExpect(jsonPath("$.inhalt[0].tags.length()").value(2))
				.andExpect(jsonPath("$.inhalt[0].reaktionAnzahl").value(1))
				.andExpect(jsonPath("$.inhalt[0].kategorie.name").exists());

		return statistik.getPrepareStatementCount();
	}
}
