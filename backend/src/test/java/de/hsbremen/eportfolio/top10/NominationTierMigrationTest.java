package de.hsbremen.eportfolio.top10;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der Backfill aus {@code V202608231030__nomination_tier.sql} (KAN-37): bildet
 * er den bisherigen Platzvorschlag richtig auf die Stufe aus §2.13 ab?
 *
 * <p><strong>Warum die Abbildung und nicht die Migration selbst geprueft
 * wird.</strong> Flyway hat sie beim Start der Testanwendung laengst
 * eingespielt, und die Spalte steht danach auf {@code not null}: Zeilen im
 * Zustand von vorher lassen sich nicht mehr herstellen. Geprueft wird deshalb
 * genau der Ausdruck, der in der ausgelieferten Datei steht. Er wird aus ihr
 * gelesen und nicht im Test nachgeschrieben; eine Kopie waere ab der ersten
 * Aenderung eine andere Abbildung und der Test bewiese nichts mehr.
 *
 * <p>Ausgefuehrt wird gegen dieselbe Postgres wie alle uebrigen Tests, damit
 * auch die SQL-Semantik gilt: {@code between} ist einschliesslich, und
 * {@code null} faellt in keinen der beiden Vergleiche und damit in den
 * {@code else}-Zweig.
 */
@SpringBootTest
@Transactional
class NominationTierMigrationTest {

	private static final String MIGRATION =
			"db/migration/V202608231030__nomination_tier.sql";

	@Autowired
	private EntityManager entityManager;

	@Test
	@DisplayName("Platz 1 wird TOP_1, 2 bis 5 werden TOP_5, alles Weitere und null werden TOP_10")
	void mapsPositionsToTiers() throws IOException {
		String expression = caseExpression();

		assertThat(tierFor(expression, "1")).isEqualTo("TOP_1");
		assertThat(tierFor(expression, "2")).isEqualTo("TOP_5");
		assertThat(tierFor(expression, "3")).isEqualTo("TOP_5");
		assertThat(tierFor(expression, "5")).isEqualTo("TOP_5");
		assertThat(tierFor(expression, "6")).isEqualTo("TOP_10");
		assertThat(tierFor(expression, "8")).isEqualTo("TOP_10");
		assertThat(tierFor(expression, "10")).isEqualTo("TOP_10");
		assertThat(tierFor(expression, "null")).isEqualTo("TOP_10");
	}

	@Test
	@DisplayName("Jeder erzeugte Wert ist einer aus §2.13 und haelt damit die Check-Constraint ein")
	void producesOnlyKnownTiers() throws IOException {
		String expression = caseExpression();
		List<String> positions = List.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
				"null");

		List<String> tiers = positions.stream()
				.map(position -> tierFor(expression, position))
				.toList();

		assertThat(tiers).allSatisfy(tier -> assertThat(
				List.of("TOP_1", "TOP_5", "TOP_10")).contains(tier));
	}

	/**
	 * Der {@code case}-Ausdruck aus der Migrationsdatei, von {@code case} bis
	 * zum abschliessenden {@code end}.
	 *
	 * <p><strong>Verankert an der Zuweisung</strong> und nicht am ersten
	 * {@code case} der Datei: die Kommentare darueber sind deutsch, und ein Wort
	 * wie „Ende" oder „verwendet" enthaelt „end". Ohne den Anker verschoebe
	 * schon ein neuer Kommentarsatz den Ausschnitt still, und der Test misse
	 * danach etwas anderes, ohne rot zu werden. Der Abschluss wird zusaetzlich
	 * geprueft.
	 */
	private String caseExpression() throws IOException {
		String sql = migrationSource();
		int assignment = sql.indexOf("set proposed_tier =");
		assertThat(assignment).as("Zuweisung in %s", MIGRATION).isNotNegative();

		int start = sql.indexOf("case", assignment);
		int end = sql.indexOf("end", start);
		assertThat(start).as("case-Ausdruck in %s", MIGRATION).isNotNegative();
		assertThat(end).as("Ende des case-Ausdrucks in %s", MIGRATION).isGreaterThan(start);

		String expression = sql.substring(start, end + "end".length());
		assertThat(expression).startsWith("case").endsWith("end");
		return expression;
	}

	private String migrationSource() throws IOException {
		try (InputStream stream = getClass().getClassLoader().getResourceAsStream(MIGRATION)) {
			assertThat(stream).as("Migrationsdatei %s", MIGRATION).isNotNull();
			return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

	/**
	 * Wendet den Ausdruck auf einen einzelnen Platzwert an. Die Zeile kommt aus
	 * einem {@code values}-Ausdruck und nicht aus der Tabelle: geprueft wird die
	 * Abbildung und nicht der Bestand.
	 */
	private String tierFor(String caseExpression, String position) {
		String sql = "select " + caseExpression
				+ " from (values (cast(" + position + " as integer))) as t(proposed_position)";
		return (String) entityManager.createNativeQuery(sql).getSingleResult();
	}
}
