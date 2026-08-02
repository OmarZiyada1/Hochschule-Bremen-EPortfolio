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
 * {@code first}, {@code last}, {@code numberOfElements}), und dass deutsche
 * Feldnamen im uebrigen Contract durchgehend die Konvention sind.
 *
 * <p>Gilt fuer {@code GET /api/projekte}, {@code GET /api/admin/users} und jeden
 * kuenftigen paginierten Endpoint. Gilt <em>nicht</em> fuer die Stammdaten
 * (§6.1): das sind kleine Referenzlisten ohne Paginierung.
 *
 * @param <T>            Typ der Listenelemente, z. B. {@code ProjektKachelAntwort}
 * @param inhalt         die Elemente dieser Seite
 * @param seite          0-basierte Seitennummer (§1)
 * @param groesse        angeforderte Seitengroesse, nicht die Zahl der
 *                       gelieferten Elemente; die letzte Seite ist in der Regel
 *                       kuerzer
 * @param gesamtElemente Treffer ueber alle Seiten
 * @param gesamtSeiten   Zahl der Seiten bei dieser Groesse
 */
@Schema(name = "SeiteAntwort", description = "Seite eines paginierten Ergebnisses (§6.6).")
public record SeiteAntwort<T>(
		List<T> inhalt,

		@Schema(description = "0-basierte Seitennummer.", example = "0")
		int seite,

		@Schema(description = "Angeforderte Seitengroesse. Die letzte Seite enthaelt "
				+ "in der Regel weniger Elemente.", example = "20")
		int groesse,

		@Schema(description = "Zahl der Treffer ueber alle Seiten.", example = "137")
		long gesamtElemente,

		@Schema(description = "Zahl der Seiten bei dieser Groesse.", example = "7")
		int gesamtSeiten) {

	/**
	 * Baut die Antwort aus einer bereits auf DTOs abgebildeten Seite.
	 *
	 * @param seite Ergebnis eines Repository-Aufrufs mit {@code Pageable}
	 */
	public static <T> SeiteAntwort<T> aus(Page<T> seite) {
		return new SeiteAntwort<>(
				seite.getContent(),
				seite.getNumber(),
				seite.getSize(),
				seite.getTotalElements(),
				seite.getTotalPages());
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
	 * @param seite     Ergebnis eines Repository-Aufrufs mit {@code Pageable}
	 * @param abbildung erzeugt aus allen Entities der Seite die Antwortobjekte,
	 *                  in derselben Reihenfolge
	 */
	public static <E, T> SeiteAntwort<T> aus(Page<E> seite, Function<List<E>, List<T>> abbildung) {
		return new SeiteAntwort<>(
				abbildung.apply(seite.getContent()),
				seite.getNumber(),
				seite.getSize(),
				seite.getTotalElements(),
				seite.getTotalPages());
	}
}
