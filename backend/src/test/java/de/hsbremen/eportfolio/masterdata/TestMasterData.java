package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.UUID;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Baut Stammdaten-Entities fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil die Konstruktoren der Entities {@code protected}
 * sind und die {@code id} im Produktivcode von JPA kommt, dieselbe Begruendung
 * wie bei {@code TestUser}. Fuer Unit-Tests ohne Persistenzkontext muss sie
 * gesetzt sein, sonst laesst sich die Zuordnung Studiengang zu Fakultaet nicht
 * pruefen.
 */
public final class TestMasterData {

	public static Category category(String name) {
		Category category = new Category();
		ReflectionTestUtils.setField(category, "id", UUID.randomUUID());
		category.setName(name);
		return category;
	}

	public static Faculty faculty(String abbreviation, String name) {
		Faculty faculty = new Faculty();
		ReflectionTestUtils.setField(faculty, "id", UUID.randomUUID());
		faculty.setAbbreviation(abbreviation);
		faculty.setName(name);
		return faculty;
	}

	public static StudyProgram studyProgram(String abbreviation, String name, Faculty faculty) {
		StudyProgram studyProgram = new StudyProgram();
		ReflectionTestUtils.setField(studyProgram, "id", UUID.randomUUID());
		studyProgram.setAbbreviation(abbreviation);
		studyProgram.setName(name);
		studyProgram.setFaculty(faculty);
		return studyProgram;
	}

	/** Ein aktives Semester an der genannten Position (§3.18). */
	public static Semester semester(String name, int sortOrder) {
		Semester semester = new Semester();
		ReflectionTestUtils.setField(semester, "id", UUID.randomUUID());
		semester.setName(name);
		semester.setActive(true);
		semester.setSortOrder(sortOrder);
		return semester;
	}

	/**
	 * Wie {@link #semester(String, int)}, aber ohne vorbelegte ID: fuer Tests,
	 * die das Semester tatsaechlich speichern.
	 */
	public static Semester semesterWithoutId(String name, int sortOrder) {
		Semester semester = semester(name, sortOrder);
		ReflectionTestUtils.setField(semester, "id", null);
		return semester;
	}

	public static Module module(String abbreviation, String name, StudyProgram studyProgram) {
		Module module = new Module();
		ReflectionTestUtils.setField(module, "id", UUID.randomUUID());
		module.setAbbreviation(abbreviation);
		module.setName(name);
		module.setStudyProgram(studyProgram);
		return module;
	}


	/**
	 * Ein Schlagwort mit vorbelegter ID, fuer Unit-Tests ohne
	 * Persistenzkontext (§3.19).
	 */
	public static Tag tag(String name) {
		Tag tag = new Tag();
		ReflectionTestUtils.setField(tag, "id", UUID.randomUUID());
		tag.setName(name);
		return tag;
	}

	/**
	 * Wie {@link #faculty(String, String)}, aber ohne vorbelegte ID: fuer Tests,
	 * die die Fakultaet tatsaechlich speichern.
	 *
	 * <p><strong>Das Kuerzel gehoert dem Test.</strong> {@code faculty.abbreviation}
	 * ist unique, und die Entwicklungsdatenbank traegt bereits FK1 bis FK5 aus
	 * dem Seeder; ein zweites FK4 scheiterte erst beim Flush. Wer diese Methode
	 * benutzt, waehlt deshalb ein Kuerzel, das im Bestand nicht vorkommt.
	 */
	public static Faculty facultyWithoutId(String abbreviation, String name) {
		Faculty faculty = faculty(abbreviation, name);
		ReflectionTestUtils.setField(faculty, "id", null);
		return faculty;
	}

	/**
	 * Wie {@link #tag(String)}, aber ohne vorbelegte ID: fuer Tests, die das
	 * Schlagwort tatsaechlich speichern.
	 */
	public static Tag tagWithoutId(String name) {
		Tag tag = tag(name);
		ReflectionTestUtils.setField(tag, "id", null);
		return tag;
	}

	/**
	 * Wie {@link #studyProgram(String, String, Faculty)}, aber ohne vorbelegte ID:
	 * fuer Tests, die den Studiengang tatsaechlich speichern.
	 */
	public static StudyProgram studyProgramWithoutId(String abbreviation, String name, Faculty faculty) {
		StudyProgram studyProgram = studyProgram(abbreviation, name, faculty);
		ReflectionTestUtils.setField(studyProgram, "id", null);
		return studyProgram;
	}

	/**
	 * Wie {@link #module(String, String, StudyProgram)}, aber ohne vorbelegte ID:
	 * fuer Tests, die das Modul tatsaechlich speichern.
	 */
	public static Module moduleWithoutId(String abbreviation, String name, StudyProgram studyProgram) {
		Module module = module(abbreviation, name, studyProgram);
		ReflectionTestUtils.setField(module, "id", null);
		return module;
	}

	// --- Stammdatenkette fuer Integrationstests ----------------------------
	//
	// Viele Integrationstests brauchen irgendeine Fakultaet, irgendeinen
	// Studiengang, irgendein Modul, nur um die Pflichtfelder eines Projekts zu
	// fuellen. Frueher kamen die aus dem DevMasterDataSeeder. Der fuehrt seit
	// dem Umzug der Hierarchie in das Seeder-Skript nur noch Kategorien und
	// Semester (siehe DevMasterDataSeeder), und eine frische Datenbank haette
	// sonst gar keine.
	//
	// Die drei Methoden nehmen deshalb, was da ist, und legen nur an, wenn
	// nichts da ist. In einer benutzten Entwicklungsdatenbank verhalten sich die
	// Tests damit genau wie vorher; in einer leeren laufen sie trotzdem. Weil
	// alle betroffenen Tests @Transactional sind, bleibt eine so angelegte Zeile
	// nicht stehen.

	/** Irgendeine Fakultaet, angelegt falls die Tabelle leer ist. */
	public static Faculty anyFaculty(FacultyRepository repository) {
		List<Faculty> existing = repository.findAllByOrderByNameAsc();
		if (!existing.isEmpty()) {
			return existing.getFirst();
		}
		// Das Kuerzel ist unique und darf keiner echten Fakultaet gehoeren.
		// Ohne Sonderzeichen, damit die Sortierung der Datenbank und die von
		// Java nicht auseinanderlaufen (siehe AdminDashboardIntegrationTest).
		return repository.saveAndFlush(facultyWithoutId("FKT0", "Fakultaet fuer Tests"));
	}

	/** Irgendein Studiengang, angelegt falls die Fakultaet noch keinen hat. */
	public static StudyProgram anyStudyProgram(FacultyRepository facultyRepository,
			StudyProgramRepository repository) {
		Faculty faculty = anyFaculty(facultyRepository);
		List<StudyProgram> existing = repository.findByFacultyIdOrderByNameAsc(faculty.getId());
		if (!existing.isEmpty()) {
			return existing.getFirst();
		}
		return repository.saveAndFlush(
				studyProgramWithoutId("SGT0", "Studiengang fuer Tests", faculty));
	}

	/**
	 * Irgendein Modul, angelegt falls der Studiengang noch keines hat.
	 *
	 * <p>Geliefert wird das erste nach Name, also gegebenenfalls das Sammelmodul
	 * (§3.9). Fuer die Pflichtfelder eines Projekts ist das gleichwertig; wer ein
	 * Fachmodul braucht, legt es sich selbst an.
	 */
	public static Module anyModule(FacultyRepository facultyRepository,
			StudyProgramRepository studyProgramRepository, ModuleRepository repository) {
		StudyProgram studyProgram = anyStudyProgram(facultyRepository, studyProgramRepository);
		List<Module> existing = repository.findByStudyProgramIdOrderByNameAsc(studyProgram.getId());
		if (!existing.isEmpty()) {
			return existing.getFirst();
		}
		return repository.saveAndFlush(moduleWithoutId("MODT0", "Modul fuer Tests", studyProgram));
	}

	/**
	 * Das Schlagwort mit diesem Namen, angelegt falls es fehlt (§3.19).
	 *
	 * <p>Anders als bei den uebrigen Stammdaten reicht ein blankes Speichern
	 * hier nicht: {@code tag} ist ueber {@code lower(name)} eindeutig, und die
	 * Entwicklungsdatenbank traegt den Bestand, den die Migration aus den
	 * vorhandenen Projekten uebernommen hat. Ein zweites &bdquo;react&ldquo;
	 * scheiterte an {@code uq_tag_name_lower}, und zwar erst beim Flush,
	 * mitten im {@code @BeforeEach}.
	 *
	 * <p><strong>Wer danach auf einen Namen zusichert, waehlt ihn so, dass er
	 * dem Test gehoert</strong> (etwa mit einem Zusatz wie {@code -test} oder
	 * einem gewuerfelten Teil). Sonst entscheidet die Schreibweise einer
	 * fremden Zeile ueber das Ergebnis: gibt es bereits
	 * &bdquo;React&ldquo;, liefert diese Methode genau die, und eine
	 * Zusicherung auf &bdquo;react&ldquo; schluege fehl.
	 */
	public static Tag existingOrNewTag(TagRepository repository, String name) {
		return repository.findByNameNormalized(name)
				.orElseGet(() -> repository.saveAndFlush(tagWithoutId(name)));
	}

	private TestMasterData() {
	}
}
