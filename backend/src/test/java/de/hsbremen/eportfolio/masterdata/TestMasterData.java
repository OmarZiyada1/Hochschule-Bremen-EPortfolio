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
