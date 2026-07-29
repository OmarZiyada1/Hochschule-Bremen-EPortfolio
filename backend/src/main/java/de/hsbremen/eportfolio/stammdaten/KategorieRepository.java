package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Kategorien.
 */
public interface KategorieRepository extends JpaRepository<Kategorie, UUID> {

	/**
	 * Alle Kategorien nach Name aufsteigend (§6.1: die Stammdatenlisten gehen
	 * sortiert und ohne Paginierung heraus).
	 *
	 * <p>Die Sortierung steht bewusst im Methodennamen statt als
	 * {@code Sort}-Parameter beim Aufrufer: so gibt es fuer diesen Zweck genau
	 * eine Methode, und niemand kann die unsortierte Variante erwischen.
	 */
	List<Kategorie> findAllByOrderByNameAsc();

	/**
	 * Suche ueber den fachlichen Schluessel ({@code kategorie.name} ist unique).
	 * Wird vom {@link DevStammdatenSeeder} gebraucht, damit ein zweiter Lauf
	 * nichts doppelt anlegt.
	 */
	Optional<Kategorie> findByName(String name);
}
