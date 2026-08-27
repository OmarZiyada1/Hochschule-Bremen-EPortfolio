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

	/**
	 * Kennzeichnet das Sammelmodul des Studiengangs (§3.9, seit Contract v84).
	 *
	 * <p>Am Namen zu erkennen, welche Zeile das Sammelmodul ist, waere bruechig:
	 * er ist ueber {@code PATCH /api/admin/modules/{id}} frei aenderbar, und
	 * weder Datenbank noch Dienst halten ihn eindeutig.
	 */
	@Column(nullable = false)
	private boolean collective;

	protected Module() {
		// Von JPA benoetigt.
	}

	/**
	 * Das Sammelmodul eines Studiengangs (§3.9, seit Contract v84).
	 *
	 * <p><strong>Eine Fabrik statt zweier Aufrufstellen mit derselben Regel.</strong>
	 * Angelegt wird die Zeile vom {@code MasterDataAdminService} beim Anlegen des
	 * Studiengangs und vom {@code DevMasterDataSeeder}; die Namensbildung stuende
	 * sonst zweimal da und liefe auseinander. Ein drittes Mal steht sie
	 * unvermeidlich in der Migration {@code V202608262015__module_collective.sql},
	 * die den Bestand nachtraegt; deren Kommentar verweist hierher.
	 *
	 * <p><strong>Warum „Studiengang" im Namen steht.</strong> „Module aus dem
	 * Medieninformatik" waere grammatisch falsch: die Namen der Studiengaenge
	 * haben verschiedene Geschlechter, und der Name ist eine gespeicherte
	 * Zeichenkette und keine i18n-Ressource, laesst sich also nachtraeglich nur
	 * per Migration korrigieren.
	 */
	public static Module collectiveFor(StudyProgram studyProgram) {
		Module module = new Module();
		module.setStudyProgram(studyProgram);
		module.setName(cut("Module aus dem Studiengang " + studyProgram.getName(), 255));
		module.setAbbreviation(cut(studyProgram.getAbbreviation() + "-ALLG", 64));
		module.setCollective(true);
		return module;
	}

	private static String cut(String value, int max) {
		return value.length() <= max ? value : value.substring(0, max);
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

	public boolean isCollective() {
		return collective;
	}

	public void setCollective(boolean collective) {
		this.collective = collective;
	}
}
