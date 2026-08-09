package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Kategorien.
 */
public interface CategoryRepository extends JpaRepository<Category, UUID> {

	/**
	 * Alle Kategorien nach Name aufsteigend (§6.1: die Stammdatenlisten gehen
	 * sortiert und ohne Paginierung heraus).
	 *
	 * <p>Die Sortierung steht bewusst im Methodennamen statt als
	 * {@code Sort}-Parameter beim Aufrufer: so gibt es fuer diesen Zweck genau
	 * eine Methode, und niemand kann die unsortierte Variante erwischen.
	 */
	List<Category> findAllByOrderByNameAsc();

	/**
	 * Suche ueber den fachlichen Schluessel ({@code category.name} ist unique).
	 * Wird vom {@link DevMasterDataSeeder} gebraucht, damit ein zweiter Lauf
	 * nichts doppelt anlegt.
	 */
	Optional<Category> findByName(String name);

	/**
	 * Ist dieser Name schon an eine <em>andere</em> Zeile vergeben (§6.1,
	 * KAN-25)? Ergibt beim Anlegen und Aendern 409 {@code RESOURCE_IN_USE}.
	 *
	 * <p>Verglichen wird exakt und nicht ohne Ruecksicht auf Gross- und
	 * Kleinschreibung, weil genau so auch der Unique-Index der Tabelle vergleicht.
	 * Eine strengere Pruefung wuerde einen Namen abweisen, den die Datenbank
	 * annehmen wuerde, und die Meldung „bereits vergeben" waere dann nachweislich
	 * falsch.
	 *
	 * <p>Beim Anlegen steht in {@code id} eine zufaellige UUID, die es nicht gibt;
	 * die Ausnahme greift dann fuer keine Zeile.
	 */
	boolean existsByNameAndIdNot(String name, UUID id);
}
