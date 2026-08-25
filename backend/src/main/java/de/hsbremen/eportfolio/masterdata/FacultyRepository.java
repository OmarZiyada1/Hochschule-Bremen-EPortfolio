package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Fakultaeten.
 */
public interface FacultyRepository extends JpaRepository<Faculty, UUID> {

	/** Alle Fakultaeten nach Name aufsteigend (§6.1). */
	List<Faculty> findAllByOrderByNameAsc();

	/**
	 * Alle Fakultaeten nach Kuerzel aufsteigend, im Bestand also FK1 bis FK5.
	 *
	 * <p>Fuer die Kennzahl {@code projectsByFaculty} des Admin-Dashboards (§6.1,
	 * Contract v76). Der Contract legt genau diese Reihenfolge fest, weil das
	 * Template die Balkenreihe so beschriftet; nach dem Namen sortiert stuende
	 * FK2 („Architektur, Bau und Umwelt") vor FK1 („Wirtschaftswissenschaften").
	 * Die Spalte ist unique, die Reihenfolge damit eindeutig.
	 */
	List<Faculty> findAllByOrderByAbbreviationAsc();

	/**
	 * Suche ueber das Kuerzel ({@code faculty.abbreviation} ist unique). Wird vom
	 * {@link DevMasterDataSeeder} gebraucht, damit ein zweiter Lauf nichts
	 * doppelt anlegt.
	 */
	Optional<Faculty> findByAbbreviation(String abbreviation);

	/**
	 * Ist dieses Kuerzel schon an eine <em>andere</em> Fakultaet vergeben? Ergibt
	 * beim Anlegen und Aendern 409 {@code RESOURCE_IN_USE} (§6.1, KAN-25).
	 *
	 * <p>Nur das Kuerzel, nicht der Name: unique ist in der Tabelle allein
	 * {@code faculty.abbreviation}. Zum exakten Vergleich siehe
	 * {@link CategoryRepository#existsByNameAndIdNot}.
	 */
	boolean existsByAbbreviationAndIdNot(String abbreviation, UUID id);
}
