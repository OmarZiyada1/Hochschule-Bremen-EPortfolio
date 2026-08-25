package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Modul, das zu einem Studiengang gehoert.
 *
 * <p>Der Name kollidiert mit Jacksons {@code Module}, aber nur dort, wo beide
 * importiert werden, und das ist in Entity- und DTO-Paketen nicht der Fall
 * (docs/NAMENSSCHEMA.md §2).
 */
@Entity
public class Module extends BaseEntity {

	@Column(nullable = false, length = 255)
	private String name;

	// Seit Contract v81 (KAN-80) Pflicht, wie beim Studiengang. Angezeigt wird
	// das Modulkuerzel derzeit nirgends; gepflegt wird es trotzdem, damit die
	// Hierarchie Fakultaet, Studiengang, Modul durchgehend eines fuehrt.
	@Column(nullable = false, length = 64)
	private String abbreviation;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "study_program_id", nullable = false)
	private StudyProgram studyProgram;

	protected Module() {
		// Von JPA benoetigt.
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getAbbreviation() {
		return abbreviation;
	}

	public void setAbbreviation(String abbreviation) {
		this.abbreviation = abbreviation;
	}

	public StudyProgram getStudyProgram() {
		return studyProgram;
	}

	public void setStudyProgram(StudyProgram studyProgram) {
		this.studyProgram = studyProgram;
	}
}
