package de.hsbremen.eportfolio.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * Einheitliches Seitenformat aller paginierten Endpoints (API-Contract §6.6).
 *
 * <p><strong>Warum nicht Springs {@code Page} direkt serialisiert wird:</strong>
 * Spring Boot markiert die JSON-Serialisierung von {@code Page} seit Version 3.3
 * ausdruecklich als instabil und warnt beim Start davor, weil sich die Struktur
 * zwischen Versionen aendern darf. Ein Contract, dessen Antwortformat sich mit
 * einem Framework-Update verschiebt, taugt nicht als gemeinsame Grundlage
 * zwischen Backend und Frontend. Hinzu kommt, dass {@code Page} Felder
 * mitliefert, die das Frontend nicht braucht ({@code pageable}, {@code sort},
 * {@code first}, {@code last}, {@code numberOfElements}).
 *
 * <p>Die Feldnamen entsprechen seit KAN-49 denen von Springs {@code Page}; das
 * Record bleibt trotzdem ein eigenes, weil der Grund oben davon unberuehrt ist
 * (docs/NAMENSSCHEMA.md §5).
 *
 * <p>Gilt fuer {@code GET /api/projects}, {@code GET /api/admin/users} und jeden
 * kuenftigen paginierten Endpoint. Gilt <em>nicht</em> fuer die Stammdaten
 * (§6.1): das sind kleine Referenzlisten ohne Paginierung.
 *
 * @param <T>           Typ der Listenelemente, z. B. {@code ProjectCardResponse}
 * @param content       die Elemente dieser Seite
 * @param page          0-basierte Seitennummer (§1)
 * @param size          angeforderte Seitengroesse, nicht die Zahl der
 *                      gelieferten Elemente; die letzte Seite ist in der Regel
 *                      kuerzer
 * @param totalElements Treffer ueber alle Seiten
 * @param totalPages    Zahl der Seiten bei dieser Groesse
 */
@Schema(name = "PageResponse", description = "Seite eines paginierten Ergebnisses (§6.6).")
public record PageResponse<T>(
		List<T> content,

		@Schema(description = "0-basierte Seitennummer.", example = "0")
		int page,

		@Schema(description = "Angeforderte Seitengroesse. Die letzte Seite enthaelt "
				+ "in der Regel weniger Elemente.", example = "20")
		int size,

		@Schema(description = "Zahl der Treffer ueber alle Seiten.", example = "137")
		long totalElements,

		@Schema(description = "Zahl der Seiten bei dieser Groesse.", example = "7")
		int totalPages) {

	/**
	 * Baut die Antwort aus einer bereits auf DTOs abgebildeten Seite.
	 *
	 * @param page Ergebnis eines Repository-Aufrufs mit {@code Pageable}
	 */
	public static <T> PageResponse<T> from(Page<T> page) {
		return new PageResponse<>(
				page.getContent(),
				page.getNumber(),
				page.getSize(),
				page.getTotalElements(),
				page.getTotalPages());
	}

	/**
	 * Baut die Antwort aus einer Seite von Entities und bildet den Inhalt dabei
	 * ab.
	 *
	 * <p>Bewusst nicht ueber {@code Page.map(...)}: die Abbildung von Projekten
	 * auf Kacheln braucht Daten, die je Seite in einem Rutsch nachgeladen werden
	 * (Tags, Reaktionszahlen). Diese Ueberladung nimmt deshalb eine Funktion auf
	 * die <em>ganze</em> Liste entgegen, nicht auf das einzelne Element.
	 *
	 * @param page   Ergebnis eines Repository-Aufrufs mit {@code Pageable}
	 * @param mapper erzeugt aus allen Entities der Seite die Antwortobjekte, in
	 *               derselben Reihenfolge
	 */
	public static <E, T> PageResponse<T> from(Page<E> page, Function<List<E>, List<T>> mapper) {
		return new PageResponse<>(
				mapper.apply(page.getContent()),
				page.getNumber(),
				page.getSize(),
				page.getTotalElements(),
				page.getTotalPages());
	}
}
