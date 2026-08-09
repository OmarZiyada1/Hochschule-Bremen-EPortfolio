package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Studiengaenge.
 *
 * <p>Die beiden Lesemethoden holen die Fakultaet per {@code @EntityGraph} mit.
 * {@code StudyProgramResponse} braucht deren ID; ohne den Fetch-Join laedt
 * Hibernate den LAZY-Proxy je Zeile einzeln nach und aus einem Endpoint werden
 * bei fuenf Fakultaeten sechs Abfragen (N+1).
 */
public interface StudyProgramRepository extends JpaRepository<StudyProgram, UUID> {

	/** Alle Studiengaenge nach Name aufsteigend (§6.1). */
	@EntityGraph(attributePaths = "faculty")
	List<StudyProgram> findAllByOrderByNameAsc();

	/** Studiengaenge einer Fakultaet, nach Name aufsteigend: Filter aus §6.1. */
	@EntityGraph(attributePaths = "faculty")
	List<StudyProgram> findByFacultyIdOrderByNameAsc(UUID facultyId);

	/**
	 * Suche ueber den fachlichen Schluessel innerhalb einer Fakultaet. Die
	 * Tabelle hat darauf keinen Unique-Index; fuer den
	 * {@link DevMasterDataSeeder} ist das Paar aus Fakultaet und Name trotzdem
	 * eindeutig genug, um einen zweiten Lauf ohne Duplikate zu ueberstehen.
	 */
	Optional<StudyProgram> findByFacultyIdAndName(UUID facultyId, String name);

	/**
	 * Haengt an dieser Fakultaet noch ein Studiengang? Sperrt das Loeschen der
	 * Fakultaet mit 409 {@code RESOURCE_IN_USE} (§6.1, KAN-25).
	 *
	 * <p>Die Fremdschluesselspalte ist {@code not null}: ohne diese Pruefung
	 * scheiterte das {@code DELETE} an der Datenbank und ergaebe einen 500 statt
	 * der Auskunft, was der Loeschung im Weg steht.
	 */
	boolean existsByFacultyId(UUID facultyId);
}
