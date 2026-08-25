package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Studiengang, der einer Fakultaet zugeordnet ist.
 */
@Entity
@Table(name = "study_program")
public class StudyProgram extends BaseEntity {

	@Column(nullable = false, length = 255)
	private String name;

	// Seit Contract v81 (KAN-80) Pflicht: das Kuerzel steht auf der
	// Projektkachel und in den Projektdetails, eine leere Stelle waere dort
	// nicht sinnvoll zu fuellen.
	@Column(nullable = false, length = 64)
	private String abbreviation;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "faculty_id", nullable = false)
	private Faculty faculty;

	protected StudyProgram() {
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

	public Faculty getFaculty() {
		return faculty;
	}

	public void setFaculty(Faculty faculty) {
		this.faculty = faculty;
	}
}
