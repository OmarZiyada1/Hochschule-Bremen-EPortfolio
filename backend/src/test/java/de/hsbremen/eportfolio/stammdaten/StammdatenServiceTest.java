package de.hsbremen.eportfolio.stammdaten;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import de.hsbremen.eportfolio.stammdaten.dto.FakultaetAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.KategorieAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.ModulAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.StudiengangAntwort;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Fachliche Tests der vier Lesepfade aus §6.1: Abbildung Entity → DTO und die
 * Frage, welche Abfrage der Filter ausloest.
 *
 * <p>Die Repositories sind Mocks. Dass die Sortierung tatsaechlich greift, kann
 * hier nicht geprueft werden — sie steckt im Methodennamen der Abfrage und wird
 * von der Datenbank ausgefuehrt; dafuer ist {@link StammdatenIntegrationTest}
 * zustaendig. Geprueft wird hier, dass der Service <em>die sortierende</em>
 * Methode aufruft und die Reihenfolge nicht nachtraeglich umbaut.
 */
class StammdatenServiceTest {

	private KategorieRepository kategorieRepository;

	private FakultaetRepository fakultaetRepository;

	private StudiengangRepository studiengangRepository;

	private ModulRepository modulRepository;

	private StammdatenService service;

	@BeforeEach
	void setUp() {
		kategorieRepository = mock(KategorieRepository.class);
		fakultaetRepository = mock(FakultaetRepository.class);
		studiengangRepository = mock(StudiengangRepository.class);
		modulRepository = mock(ModulRepository.class);
		service = new StammdatenService(kategorieRepository, fakultaetRepository, studiengangRepository,
				modulRepository);
	}

	// --- Kategorien --------------------------------------------------------

	@Test
	@DisplayName("Kategorien kommen als DTO in der Reihenfolge der Abfrage")
	void kategorien() {
		Kategorie erste = TestStammdaten.kategorie("Abschlussarbeit");
		Kategorie zweite = TestStammdaten.kategorie("Praxisprojekt");
		when(kategorieRepository.findAllByOrderByNameAsc()).thenReturn(List.of(erste, zweite));

		List<KategorieAntwort> antwort = service.kategorien();

		assertThat(antwort).containsExactly(
				new KategorieAntwort(erste.getId(), "Abschlussarbeit"),
				new KategorieAntwort(zweite.getId(), "Praxisprojekt"));
	}

	// --- Fakultaeten -------------------------------------------------------

	@Test
	@DisplayName("Fakultaeten liefern Name und Kuerzel")
	void fakultaeten() {
		Fakultaet fk4 = TestStammdaten.fakultaet("FK4", "Elektrotechnik und Informatik");
		when(fakultaetRepository.findAllByOrderByNameAsc()).thenReturn(List.of(fk4));

		assertThat(service.fakultaeten()).containsExactly(
				new FakultaetAntwort(fk4.getId(), "Elektrotechnik und Informatik", "FK4"));
	}

	// --- Studiengaenge -----------------------------------------------------

	@Test
	@DisplayName("Ohne Filter: alle Studiengaenge, sortierte Abfrage")
	void studiengaengeOhneFilter() {
		Fakultaet fk4 = TestStammdaten.fakultaet("FK4", "Elektrotechnik und Informatik");
		Studiengang informatik = TestStammdaten.studiengang("INF", "Informatik", fk4);
		when(studiengangRepository.findAllByOrderByNameAsc()).thenReturn(List.of(informatik));

		List<StudiengangAntwort> antwort = service.studiengaenge(null);

		assertThat(antwort).containsExactly(
				new StudiengangAntwort(informatik.getId(), "Informatik", "INF", fk4.getId()));
		verify(studiengangRepository).findAllByOrderByNameAsc();
		verifyNoMoreInteractions(studiengangRepository);
	}

	@Test
	@DisplayName("Mit Filter: nur die Studiengaenge dieser Fakultaet werden abgefragt")
	void studiengaengeMitFilter() {
		Fakultaet fk4 = TestStammdaten.fakultaet("FK4", "Elektrotechnik und Informatik");
		Studiengang informatik = TestStammdaten.studiengang("INF", "Informatik", fk4);
		when(studiengangRepository.findByFakultaetIdOrderByNameAsc(fk4.getId()))
				.thenReturn(List.of(informatik));

		List<StudiengangAntwort> antwort = service.studiengaenge(fk4.getId());

		assertThat(antwort).extracting(StudiengangAntwort::fakultaetId).containsOnly(fk4.getId());
		verify(studiengangRepository).findByFakultaetIdOrderByNameAsc(fk4.getId());
		// Der Filter darf nicht bedeuten „alles laden und danach aussieben".
		verifyNoMoreInteractions(studiengangRepository);
	}

	@Test
	@DisplayName("Unbekannte Fakultaet: leere Liste statt 404")
	void studiengaengeUnbekannteFakultaet() {
		UUID unbekannt = UUID.randomUUID();
		when(studiengangRepository.findByFakultaetIdOrderByNameAsc(unbekannt)).thenReturn(List.of());

		assertThat(service.studiengaenge(unbekannt)).isEmpty();
	}

	// --- Module ------------------------------------------------------------

	@Test
	@DisplayName("Ohne Filter: alle Module, sortierte Abfrage")
	void moduleOhneFilter() {
		Fakultaet fk4 = TestStammdaten.fakultaet("FK4", "Elektrotechnik und Informatik");
		Studiengang informatik = TestStammdaten.studiengang("INF", "Informatik", fk4);
		Modul swt = TestStammdaten.modul("SWT", "Softwaretechnik", informatik);
		when(modulRepository.findAllByOrderByNameAsc()).thenReturn(List.of(swt));

		assertThat(service.module(null)).containsExactly(
				new ModulAntwort(swt.getId(), "Softwaretechnik", "SWT", informatik.getId()));
		verify(modulRepository).findAllByOrderByNameAsc();
		verifyNoMoreInteractions(modulRepository);
	}

	@Test
	@DisplayName("Mit Filter: nur die Module dieses Studiengangs werden abgefragt")
	void moduleMitFilter() {
		Fakultaet fk4 = TestStammdaten.fakultaet("FK4", "Elektrotechnik und Informatik");
		Studiengang informatik = TestStammdaten.studiengang("INF", "Informatik", fk4);
		Modul swt = TestStammdaten.modul("SWT", "Softwaretechnik", informatik);
		when(modulRepository.findByStudiengangIdOrderByNameAsc(informatik.getId())).thenReturn(List.of(swt));

		assertThat(service.module(informatik.getId()))
				.extracting(ModulAntwort::studiengangId)
				.containsOnly(informatik.getId());
		verify(modulRepository).findByStudiengangIdOrderByNameAsc(informatik.getId());
		verifyNoMoreInteractions(modulRepository);
	}

	@Test
	@DisplayName("Unbekannter Studiengang: leere Liste statt 404")
	void moduleUnbekannterStudiengang() {
		UUID unbekannt = UUID.randomUUID();
		when(modulRepository.findByStudiengangIdOrderByNameAsc(unbekannt)).thenReturn(List.of());

		assertThat(service.module(unbekannt)).isEmpty();
	}

	// --- Nullable Kuerzel --------------------------------------------------

	@Test
	@DisplayName("Fehlendes Kuerzel bleibt null und wird nicht zu einem leeren String")
	void kuerzelDarfFehlen() {
		Fakultaet fk4 = TestStammdaten.fakultaet("FK4", "Elektrotechnik und Informatik");
		Studiengang ohneKuerzel = TestStammdaten.studiengang(null, "Informatik", fk4);
		when(studiengangRepository.findAllByOrderByNameAsc()).thenReturn(List.of(ohneKuerzel));

		assertThat(service.studiengaenge(null)).singleElement()
				.extracting(StudiengangAntwort::kuerzel)
				.isNull();
	}
}
