package de.hsbremen.eportfolio.masterdata;

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

	private TestMasterData() {
	}
}
