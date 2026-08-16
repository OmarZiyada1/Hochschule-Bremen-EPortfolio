package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Semester (§3.18).
 *
 * <p>Anders als bei den vier uebrigen Stammdaten ordnet nicht der Name, sondern
 * {@code sortOrder}. Die Sortierung steht wie dort im Methodennamen und nicht
 * als {@code Sort}-Parameter beim Aufrufer, damit es fuer diesen Zweck genau
 * eine Methode gibt und niemand die unsortierte Variante erwischt.
 */
public interface SemesterRepository extends JpaRepository<Semester, UUID> {

	/** Alle Semester in der gepflegten Reihenfolge, fuer {@code GET /api/semesters}. */
	List<Semester> findAllByOrderBySortOrderAsc();

	/** Wie {@link #findAllByOrderBySortOrderAsc()}, eingeschraenkt auf den Filter {@code active}. */
	List<Semester> findAllByActiveOrderBySortOrderAsc(boolean active);

	/**
	 * Suche ueber den fachlichen Schluessel ({@code semester.name} ist unique).
	 * Wird vom {@link DevMasterDataSeeder} gebraucht, damit ein zweiter Lauf
	 * nichts doppelt anlegt.
	 */
	Optional<Semester> findByName(String name);

	/**
	 * Ist dieser Name schon an eine <em>andere</em> Zeile vergeben? Ergibt beim
	 * Anlegen und Aendern 409 {@code RESOURCE_IN_USE}.
	 *
	 * <p>Verglichen wird exakt und nicht ohne Ruecksicht auf Gross- und
	 * Kleinschreibung, aus demselben Grund wie bei
	 * {@link CategoryRepository#existsByNameAndIdNot}: genau so vergleicht der
	 * Unique-Index der Tabelle, und eine strengere Pruefung wiese einen Namen
	 * ab, den die Datenbank annehmen wuerde.
	 */
	boolean existsByNameAndIdNot(String name, UUID id);

	/**
	 * Das Semester am Ende der Reihenfolge. Ein neu angelegtes bekommt
	 * {@code sortOrder + 1} und steht damit unten in der Liste; leer ist das
	 * Ergebnis nur beim allerersten Semester.
	 */
	Optional<Semester> findFirstByOrderBySortOrderDesc();

	/**
	 * Die Nachbarzeile oberhalb, fuer {@code move} mit Richtung {@code UP}. Bei
	 * gleichem {@code sortOrder} zweier Zeilen bleibt die Ordnung stabil, weil
	 * die Abfrage streng kleiner vergleicht und damit nie die Zeile selbst
	 * trifft.
	 */
	Optional<Semester> findFirstBySortOrderLessThanOrderBySortOrderDesc(int sortOrder);

	/** Die Nachbarzeile unterhalb, fuer {@code move} mit Richtung {@code DOWN}. */
	Optional<Semester> findFirstBySortOrderGreaterThanOrderBySortOrderAsc(int sortOrder);
}
