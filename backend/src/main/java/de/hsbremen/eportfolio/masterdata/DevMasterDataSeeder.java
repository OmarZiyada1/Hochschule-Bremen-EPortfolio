package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Legt Kategorien und Semester an, <strong>nur im Profil dev</strong>.
 *
 * <p>Ohne diese Daten haetten zwei der vier Endpoints aus §6.1 leere Listen,
 * und weder die Projektanlage noch die Filterleiste der Projektliste liessen
 * sich im Frontend ausprobieren.
 *
 * <p>Bewusst ein Seeder und keine Flyway-Migration, anders begruendet als beim
 * {@code DevTestUserSeeder}, wo es um einen Passworthash ging: Kategorien und
 * Semester sind hier <em>Beispieldaten</em>, keine gepflegte Referenzliste der
 * Hochschule. Eine Migration wuerde sie in jede Umgebung tragen, auch in die
 * produktive; dort gehoert stattdessen der echte Bestand hin, gepflegt ueber
 * die Administrationsseite oder einen Import.
 *
 * <p><strong>Die Hierarchie Fakultaet, Studiengang, Modul fuehrt dieser Seeder
 * nicht mehr.</strong> Sie stand hier als erfundenes Beispiel: die fuenf
 * Fakultaeten stimmten, die zwei bis drei Studiengaenge je Fakultaet und ihre
 * je zwei Module waren plausibel ausgedacht. Seither gibt es den echten
 * Bestand der Hochschule, 5 Fakultaeten mit 75 Studiengaengen und ihren
 * Modulen, erhoben aus der Confluence-Seite &bdquo;Fakultaeten-Hierarchie&ldquo;.
 * Er kommt aus dem Skript {@code stammdaten-seeder.sh} im Wurzelverzeichnis,
 * aufgerufen ueber {@code eportfolio.ps1}. Das ist der richtige Ort dafuer:
 * <ul>
 *   <li>Es ist eine <em>Datenlieferung</em> und kein Bestandteil des
 *       ausgelieferten Programms. Sie aendert sich, wenn die Hochschule ihre
 *       Studiengangsseiten aendert, und nicht, wenn sich der Code aendert.</li>
 *   <li>Sie ist gross. 75 Studiengaenge und rund 1900 Module als Java-Literale
 *       waeren eine Quelldatei, die niemand mehr liest.</li>
 *   <li>Sie muss sich wieder entfernen lassen. Ein {@code ApplicationRunner}
 *       kann anlegen, aber nicht aufraeumen; das Skript hat sein Gegenstueck
 *       {@code stammdaten-seeder-entfernen.sh}.</li>
 * </ul>
 * Wer eine Fakultaet oder einen Studiengang in einem Test braucht, nimmt
 * {@code TestMasterData.anyFaculty} bzw. {@code anyStudyProgram}; die nehmen,
 * was da ist, und legen nur sonst etwas an.
 *
 * <p><strong>Mehrfach ausfuehrbar:</strong> der Runner laeuft bei jedem Start,
 * die Entwicklungsdatenbank ueberlebt Neustarts. Jeder Datensatz wird deshalb
 * ueber seinen fachlichen Schluessel gesucht, bevor er angelegt wird:
 * {@code category.name} und {@code semester.name}. Vorhandene Zeilen bleiben
 * unangetastet, der Seeder ergaenzt und korrigiert nicht. Wer einen Namen in
 * dieser Datei aendert, bekommt daher einen zusaetzlichen Datensatz und nicht
 * den umbenannten alten.
 *
 * <p>Liegt im Paket {@code masterdata}, weil die Konstruktoren der Entities
 * bewusst {@code protected} sind (JPA). Die Entities aus KAN-4 bleiben dadurch
 * unveraendert.
 */
@Component
@Profile("dev")
public class DevMasterDataSeeder implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(DevMasterDataSeeder.class);

	/**
	 * Kategorien aus §3.6 bis §3.9. Bewusst eine kurze, allgemeine Liste: sie
	 * soll die Filterleiste fuellen, nicht eine fachliche Taxonomie vorwegnehmen.
	 */
	private static final List<String> CATEGORIES = List.of(
			"Abschlussarbeit",
			"Forschungsprojekt",
			"Interaktive Medien",
			"Lehrveranstaltung",
			"Praxisprojekt",
			"Semesterprojekt",
			"Studentische Initiative",
			"Wettbewerbsbeitrag");

	/**
	 * Vier Semester in fachlich richtiger Reihenfolge, aeltestes zuerst (§3.18).
	 *
	 * <p>Die Schreibweise ist die des Templates &bdquo;Semester&ldquo;. Ohne
	 * diese Liste haette das Metadaten-Formular keine Auswahl, und die
	 * Filtergruppe der Projektbibliothek bliebe leer.
	 */
	private static final List<String> SEMESTERS = List.of(
			"WiSe 2024/25",
			"SoSe 2025",
			"WiSe 2025/26",
			"SoSe 2026");

	private final CategoryRepository categoryRepository;

	private final SemesterRepository semesterRepository;

	public DevMasterDataSeeder(CategoryRepository categoryRepository,
			SemesterRepository semesterRepository) {
		this.categoryRepository = categoryRepository;
		this.semesterRepository = semesterRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		int created = 0;

		for (String name : CATEGORIES) {
			created += createCategory(name);
		}
		for (String name : SEMESTERS) {
			created += createSemester(name);
		}

		if (created > 0) {
			LOG.info("Dev-Stammdaten ergaenzt: {} neue Datensaetze.", created);
		}
	}

	private int createCategory(String name) {
		if (categoryRepository.findByName(name).isPresent()) {
			return 0;
		}

		Category category = new Category();
		category.setName(name);
		categoryRepository.save(category);
		return 1;
	}

	/**
	 * Legt ein Semester am Ende der Reihenfolge an, sofern der Name noch nicht
	 * vergeben ist.
	 *
	 * <p>Die Position wird berechnet und nicht aus der Position in
	 * {@link #SEMESTERS} genommen: auf einer Entwicklungsdatenbank hat die
	 * Migration aus KAN-65 moeglicherweise schon Semester aus den frueheren
	 * Freitexten angelegt, und feste Zahlen wuerden deren Reihenfolge
	 * durchsetzen.
	 */
	private int createSemester(String name) {
		if (semesterRepository.findByName(name).isPresent()) {
			return 0;
		}

		Semester semester = new Semester();
		semester.setName(name);
		semester.setActive(true);
		semester.setSortOrder(semesterRepository.findFirstByOrderBySortOrderDesc()
				.map(last -> last.getSortOrder() + 1)
				.orElse(1));
		semesterRepository.saveAndFlush(semester);
		return 1;
	}
}
