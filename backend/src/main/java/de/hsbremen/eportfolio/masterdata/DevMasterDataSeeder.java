package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Legt Beispiel-Stammdaten an, <strong>nur im Profil dev</strong>.
 *
 * <p>Ohne diese Daten sind die vier Endpoints aus §6.1 leere Listen, und weder
 * die Projektanlage noch die Filterleiste der Projektliste lassen sich im
 * Frontend ausprobieren.
 *
 * <p>Bewusst ein Seeder und keine Flyway-Migration, anders begruendet als beim
 * {@code DevTestUserSeeder}, wo es um einen Passworthash ging: Fakultaeten,
 * Studiengaenge und Module sind hier <em>Beispieldaten</em>, keine gepflegte
 * Referenzliste der Hochschule. Die Fakultaeten stimmen, die Studiengaenge und
 * Module sind plausibel erfunden. Eine Migration wuerde sie in jede Umgebung
 * tragen, auch in die produktive; dort gehoert stattdessen der echte Bestand
 * hin, gepflegt ueber die Administrationsseite oder einen Import.
 *
 * <p><strong>Mehrfach ausfuehrbar:</strong> der Runner laeuft bei jedem Start,
 * die Entwicklungsdatenbank ueberlebt Neustarts. Jeder Datensatz wird deshalb
 * ueber seinen fachlichen Schluessel gesucht, bevor er angelegt wird:
 * {@code category.name}, {@code faculty.abbreviation} sowie Name plus
 * Elternschluessel bei Studiengang und Modul. Vorhandene Zeilen bleiben
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

	/**
	 * FK1 bis FK5 der Hochschule Bremen mit ihren offiziellen Kuerzeln. Die
	 * Fakultaetsnamen entsprechen dem oeffentlichen Stand der Hochschule, die
	 * Studiengaenge und Module darunter sind Beispiele.
	 */
	private static final List<FacultySeed> FACULTIES = List.of(
			faculty("FK1", "Wirtschaftswissenschaften",
					studyProgram("BW", "Betriebswirtschaft",
							module("BUB", "Buchführung und Bilanzierung"),
							module("MAR", "Marketing")),
					studyProgram("WIN", "Wirtschaftsinformatik",
							module("GPM", "Geschäftsprozessmanagement"),
							module("DBS", "Datenbanksysteme"))),

			faculty("FK2", "Architektur, Bau und Umwelt",
					studyProgram("ARC", "Architektur",
							module("EUK", "Entwerfen und Konstruieren"),
							module("BGE", "Baugeschichte")),
					studyProgram("BIW", "Bauingenieurwesen",
							module("TME", "Technische Mechanik"),
							module("WAB", "Wasserbau"))),

			faculty("FK3", "Gesellschaftswissenschaften",
					studyProgram("SOA", "Soziale Arbeit",
							module("SOP", "Sozialpädagogik"),
							module("RSA", "Recht in der Sozialen Arbeit")),
					studyProgram("AFW", "Angewandte Freizeitwissenschaft",
							module("FRP", "Freizeitpädagogik"),
							module("EVM", "Eventmanagement"))),

			faculty("FK4", "Elektrotechnik und Informatik",
					studyProgram("INF", "Informatik",
							module("GDP", "Grundlagen der Programmierung"),
							module("SWT", "Softwaretechnik")),
					studyProgram("MIN", "Medieninformatik",
							module("MMI", "Mensch-Maschine-Interaktion"),
							module("WEB", "Webtechnologien")),
					studyProgram("ELT", "Elektrotechnik",
							module("RET", "Regelungstechnik"),
							module("EMS", "Eingebettete Systeme"))),

			faculty("FK5", "Natur und Technik",
					studyProgram("BIO", "Biologie",
							module("ZBI", "Zellbiologie"),
							module("OEK", "Ökologie")),
					studyProgram("BNK", "Bionik",
							module("BME", "Biomechanik"),
							module("WKU", "Werkstoffkunde"))));

	private final CategoryRepository categoryRepository;

	private final FacultyRepository facultyRepository;

	private final StudyProgramRepository studyProgramRepository;

	private final ModuleRepository moduleRepository;

	private final SemesterRepository semesterRepository;

	public DevMasterDataSeeder(CategoryRepository categoryRepository, FacultyRepository facultyRepository,
			StudyProgramRepository studyProgramRepository, ModuleRepository moduleRepository,
			SemesterRepository semesterRepository) {
		this.categoryRepository = categoryRepository;
		this.facultyRepository = facultyRepository;
		this.studyProgramRepository = studyProgramRepository;
		this.moduleRepository = moduleRepository;
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
		for (FacultySeed seed : FACULTIES) {
			created += createFaculty(seed);
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

	private int createFaculty(FacultySeed seed) {
		int created = 0;

		Optional<Faculty> existing = facultyRepository.findByAbbreviation(seed.abbreviation());
		Faculty faculty;
		if (existing.isPresent()) {
			faculty = existing.get();
		}
		else {
			Faculty fresh = new Faculty();
			fresh.setAbbreviation(seed.abbreviation());
			fresh.setName(seed.name());
			faculty = facultyRepository.save(fresh);
			created++;
		}

		for (StudyProgramSeed studyProgram : seed.studyPrograms()) {
			created += createStudyProgram(faculty, studyProgram);
		}
		return created;
	}

	private int createStudyProgram(Faculty faculty, StudyProgramSeed seed) {
		int created = 0;

		Optional<StudyProgram> existing =
				studyProgramRepository.findByFacultyIdAndName(faculty.getId(), seed.name());
		StudyProgram studyProgram;
		if (existing.isPresent()) {
			studyProgram = existing.get();
		}
		else {
			StudyProgram fresh = new StudyProgram();
			fresh.setAbbreviation(seed.abbreviation());
			fresh.setName(seed.name());
			fresh.setFaculty(faculty);
			studyProgram = studyProgramRepository.save(fresh);
			created++;
		}

		for (ModuleSeed module : seed.modules()) {
			created += createModule(studyProgram, module);
		}
		created += createCollectiveModule(studyProgram);
		return created;
	}

	/**
	 * Das Sammelmodul (§3.9, seit Contract v84). Im Betrieb entsteht es als
	 * Nebenwirkung von {@code POST /api/admin/study-programs}; die Saatdaten
	 * gehen am Dienst vorbei und legen es deshalb selbst an, ueber dieselbe
	 * Fabrik, damit der Name nicht an zwei Stellen gebildet wird.
	 */
	private int createCollectiveModule(StudyProgram studyProgram) {
		if (moduleRepository.findByStudyProgramIdAndCollectiveTrue(studyProgram.getId())
				.isPresent()) {
			return 0;
		}
		moduleRepository.save(Module.collectiveFor(studyProgram));
		return 1;
	}

	private int createModule(StudyProgram studyProgram, ModuleSeed seed) {
		if (moduleRepository.findByStudyProgramIdAndName(studyProgram.getId(), seed.name()).isPresent()) {
			return 0;
		}

		Module module = new Module();
		module.setAbbreviation(seed.abbreviation());
		module.setName(seed.name());
		module.setStudyProgram(studyProgram);
		moduleRepository.save(module);
		return 1;
	}

	// --- Beschreibung der Saatdaten ----------------------------------------
	// Drei kleine Records plus je eine Fabrikmethode, damit die Datenliste oben
	// wie eine Tabelle lesbar bleibt und nicht in verschachtelten
	// List.of(new ...(...)) verschwindet.

	private static FacultySeed faculty(String abbreviation, String name, StudyProgramSeed... studyPrograms) {
		return new FacultySeed(abbreviation, name, List.of(studyPrograms));
	}

	private static StudyProgramSeed studyProgram(String abbreviation, String name, ModuleSeed... modules) {
		return new StudyProgramSeed(abbreviation, name, List.of(modules));
	}

	private static ModuleSeed module(String abbreviation, String name) {
		return new ModuleSeed(abbreviation, name);
	}

	private record FacultySeed(String abbreviation, String name, List<StudyProgramSeed> studyPrograms) {
	}

	private record StudyProgramSeed(String abbreviation, String name, List<ModuleSeed> modules) {
	}

	private record ModuleSeed(String abbreviation, String name) {
	}
}
