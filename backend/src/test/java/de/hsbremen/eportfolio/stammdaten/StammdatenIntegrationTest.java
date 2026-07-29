package de.hsbremen.eportfolio.stammdaten;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.stammdaten.dto.FakultaetAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.KategorieAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.ModulAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.StudiengangAntwort;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die vier Endpoints aus §6.1 gegen die echte Datenbank und die echten
 * Seed-Daten: Erreichbarkeit ohne Token, Sortierung, Filter und die
 * Mehrfachausfuehrbarkeit des {@link DevStammdatenSeeder}.
 *
 * <p>{@code @Transactional} sorgt dafuer, dass alles, was dieser Test anlegt,
 * hinterher zurueckgerollt wird — die Entwicklungsdatenbank bleibt so, wie sie
 * war. Die Endpoints laufen im selben Thread und damit in derselben
 * Transaktion; sie sehen die Seed-Daten deshalb auch ohne Commit.
 *
 * <p>Der Seeder wird in {@link #saatSicherstellen()} selbst aufgerufen, statt
 * sich darauf zu verlassen, dass Spring den {@code ApplicationRunner} beim
 * Hochfahren des Testkontexts ausgefuehrt hat. Weil er idempotent ist, kostet
 * das nichts und macht den Test unabhaengig davon.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class StammdatenIntegrationTest {

	/** Die fuenf Fakultaeten des Seeders in der erwarteten Reihenfolge (nach name). */
	private static final List<String> FAKULTAETEN_NACH_NAME = List.of(
			"Architektur, Bau und Umwelt",
			"Elektrotechnik und Informatik",
			"Gesellschaftswissenschaften",
			"Natur und Technik",
			"Wirtschaftswissenschaften");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private DevStammdatenSeeder seeder;

	@Autowired
	private KategorieRepository kategorieRepository;

	@Autowired
	private FakultaetRepository fakultaetRepository;

	@Autowired
	private StudiengangRepository studiengangRepository;

	@Autowired
	private ModulRepository modulRepository;

	@BeforeEach
	void saatSicherstellen() {
		seeder.run(new DefaultApplicationArguments());
	}

	// --- Seeder ------------------------------------------------------------

	@Test
	@DisplayName("Zweiter Seeder-Lauf legt nichts doppelt an")
	void seederIstIdempotent() {
		long kategorien = kategorieRepository.count();
		long fakultaeten = fakultaetRepository.count();
		long studiengaenge = studiengangRepository.count();
		long module = modulRepository.count();

		// Nach dem Lauf in saatSicherstellen() ist das bereits der zweite,
		// bei laufendem ApplicationRunner der dritte.
		seeder.run(new DefaultApplicationArguments());

		assertThat(kategorieRepository.count()).isEqualTo(kategorien);
		assertThat(fakultaetRepository.count()).isEqualTo(fakultaeten);
		assertThat(studiengangRepository.count()).isEqualTo(studiengaenge);
		assertThat(modulRepository.count()).isEqualTo(module);
	}

	@Test
	@DisplayName("Seeder legt FK1 bis FK5 genau einmal an")
	void seederLegtJedeFakultaetGenauEinmalAn() {
		seeder.run(new DefaultApplicationArguments());

		assertThat(fakultaetRepository.findAllByOrderByNameAsc())
				.extracting(Fakultaet::getKuerzel)
				.doesNotHaveDuplicates()
				.contains("FK1", "FK2", "FK3", "FK4", "FK5");
	}

	// --- Erreichbarkeit ohne Token -----------------------------------------

	@Test
	@DisplayName("Alle vier Endpoints antworten ohne Token mit 200 und Seed-Daten")
	void alleVierEndpointsOhneToken() throws Exception {
		assertThat(hole(get("/api/kategorien"), KategorieAntwort.class)).isNotEmpty();
		assertThat(hole(get("/api/fakultaeten"), FakultaetAntwort.class)).isNotEmpty();
		assertThat(hole(get("/api/studiengaenge"), StudiengangAntwort.class)).isNotEmpty();
		assertThat(hole(get("/api/module"), ModulAntwort.class)).isNotEmpty();
	}

	// --- Sortierung --------------------------------------------------------

	@Test
	@DisplayName("Fakultaeten kommen nach name sortiert")
	void fakultaetenSindSortiert() throws Exception {
		List<FakultaetAntwort> antwort = hole(get("/api/fakultaeten"), FakultaetAntwort.class);

		// Nur die Seed-Fakultaeten betrachten: in einer benutzten
		// Entwicklungsdatenbank koennen weitere Zeilen stehen.
		assertThat(antwort.stream()
				.map(FakultaetAntwort::name)
				.filter(FAKULTAETEN_NACH_NAME::contains)
				.toList())
				.containsExactlyElementsOf(FAKULTAETEN_NACH_NAME);
	}

	@Test
	@DisplayName("Module eines Studiengangs kommen nach name sortiert")
	void moduleSindSortiert() throws Exception {
		UUID informatik = studiengangId("FK4", "Informatik");

		List<ModulAntwort> antwort = hole(
				get("/api/module").param("studiengang", informatik.toString()), ModulAntwort.class);

		assertThat(antwort).extracting(ModulAntwort::name)
				.containsExactly("Grundlagen der Programmierung", "Softwaretechnik");
	}

	// --- Filter ------------------------------------------------------------

	@Test
	@DisplayName("?fakultaet liefert nur die Studiengaenge dieser Fakultaet")
	void studiengaengeGefiltert() throws Exception {
		UUID fk4 = fakultaetId("FK4");

		List<StudiengangAntwort> antwort = hole(
				get("/api/studiengaenge").param("fakultaet", fk4.toString()), StudiengangAntwort.class);

		assertThat(antwort).isNotEmpty();
		assertThat(antwort).extracting(StudiengangAntwort::fakultaetId).containsOnly(fk4);
		assertThat(antwort).extracting(StudiengangAntwort::name)
				.contains("Elektrotechnik", "Informatik", "Medieninformatik");

		// Gegenprobe: ohne Filter sind auch andere Fakultaeten dabei.
		assertThat(hole(get("/api/studiengaenge"), StudiengangAntwort.class))
				.extracting(StudiengangAntwort::fakultaetId)
				.contains(fakultaetId("FK1"));
	}

	@Test
	@DisplayName("?studiengang liefert nur die Module dieses Studiengangs")
	void moduleGefiltert() throws Exception {
		UUID medieninformatik = studiengangId("FK4", "Medieninformatik");

		List<ModulAntwort> antwort = hole(
				get("/api/module").param("studiengang", medieninformatik.toString()), ModulAntwort.class);

		assertThat(antwort).isNotEmpty();
		assertThat(antwort).extracting(ModulAntwort::studiengangId).containsOnly(medieninformatik);
		assertThat(antwort).extracting(ModulAntwort::name)
				.contains("Mensch-Maschine-Interaktion", "Webtechnologien");
	}

	@Test
	@DisplayName("Unbekannte Filter-ID: 200 mit leerer Liste, kein 404")
	void unbekannteFilterId() throws Exception {
		assertThat(hole(get("/api/studiengaenge").param("fakultaet", UUID.randomUUID().toString()),
				StudiengangAntwort.class)).isEmpty();
		assertThat(hole(get("/api/module").param("studiengang", UUID.randomUUID().toString()),
				ModulAntwort.class)).isEmpty();
	}

	// --- Zeichensatz -------------------------------------------------------

	@Test
	@DisplayName("Umlaute ueberstehen den Weg Java-Quelltext → Datenbank → JSON")
	void umlauteBleibenErhalten() throws Exception {
		UUID biologie = studiengangId("FK5", "Biologie");

		List<ModulAntwort> antwort = hole(
				get("/api/module").param("studiengang", biologie.toString()), ModulAntwort.class);

		assertThat(antwort).extracting(ModulAntwort::name).contains("Ökologie");
	}

	// --- Hilfsmittel -------------------------------------------------------

	private UUID fakultaetId(String kuerzel) {
		return fakultaetRepository.findByKuerzel(kuerzel).orElseThrow().getId();
	}

	private UUID studiengangId(String fakultaetKuerzel, String name) {
		return studiengangRepository.findByFakultaetIdAndName(fakultaetId(fakultaetKuerzel), name)
				.orElseThrow()
				.getId();
	}

	/**
	 * Fuehrt die Anfrage aus, erwartet 200 und liest den Koerper als Liste.
	 * Bewusst mit ausdruecklichem UTF-8 statt der Standardkodierung der
	 * Antwort — sonst wuerde der Umlauttest die Kodierung mitpruefen, die er
	 * eigentlich pruefen soll.
	 */
	private <T> List<T> hole(RequestBuilder anfrage, Class<T> typ) throws Exception {
		String koerper = mockMvc.perform(anfrage)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);

		return objectMapper.readValue(koerper,
				objectMapper.getTypeFactory().constructCollectionType(List.class, typ));
	}
}
