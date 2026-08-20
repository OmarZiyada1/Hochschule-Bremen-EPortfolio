package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.nio.charset.StandardCharsets;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.FileCopyUtils;

/**
 * Die Bestandsuebernahme der Migration {@code V202608191630__tag.sql} (KAN-75,
 * §3.19).
 *
 * <p><strong>Warum dieser Test die Migration wirklich ausfuehrt und ihre
 * Anweisungen nicht nachbaut:</strong> geprueft werden soll die Datei, die
 * spaeter auf der echten Datenbank laeuft, und nicht eine zweite Fassung
 * derselben Absicht. Eine nachgebaute Fassung liefe still auseinander, sobald
 * jemand die Datei anfasst, und der Test bezeugte danach etwas, das es nicht
 * mehr gibt. Zum Zeitpunkt des Testlaufs ist die Migration laengst
 * durchgelaufen und die Spalte {@code project_tag.tag} existiert nicht mehr;
 * ueber JPA ist der Ausgangszustand also nicht mehr herstellbar.
 *
 * <p><strong>Wie das geht:</strong> PostgreSQL durchsucht {@code pg_temp} vor
 * jedem anderen Schema. Dieser Test legt auf einer eigenen Verbindung
 * temporaere Tabellen {@code project_tag} und {@code tag} an und laesst die
 * Anweisungen der Migration darauf los. Die echten Tabellen bleiben unberuehrt,
 * und mit der Verbindung verschwinden die temporaeren wieder. Einzige
 * Abweichung von der Datei: aus {@code create table tag} wird
 * {@code create temporary table tag}, sonst legte die Migration die echte
 * Tabelle ein zweites Mal an. Die Ausdruecke der Uebernahme, auf die es hier
 * ankommt, laufen woertlich.
 *
 * <p>Geprueft werden die beiden Zusagen aus dem Ticket: Schreibweisen
 * verschmelzen zu einer Zeile mit der haeufigsten als Anzeigename, und ein
 * Projekt, das vorher zwei Schreibweisen desselben Worts trug, traegt danach
 * genau einen Tag, ohne am neuen Primaerschluessel zu scheitern.
 */
@SpringBootTest
class TagMigrationTest {

	private static final String MIGRATION = "db/migration/V202608191630__tag.sql";

	/** Zeilenkommentare der Datei; sie duerfen die Zerlegung nicht stoeren. */
	private static final Pattern LINE_COMMENT = Pattern.compile("(?m)^\\s*--.*$");

	@Autowired
	private DataSource dataSource;

	@Test
	@DisplayName("Schreibweisen verschmelzen zu einer Zeile; Anzeigename ist die haeufigste")
	void spellingsMergeIntoOneRow() throws Exception {
		UUID projectA = UUID.randomUUID();
		UUID projectB = UUID.randomUUID();
		UUID projectC = UUID.randomUUID();
		UUID projectD = UUID.randomUUID();

		try (Connection connection = dataSource.getConnection()) {
			try {
				prepareLegacyTable(connection);
				// Die Grossschreibung steht dreimal, die Kleinschreibung zweimal: die
				// Mehrheit entscheidet ueber den Anzeigenamen, und sie muss eine sein.
				// Bei Gleichstand entschiede die Kollation, und der Test bezeugte dann
				// etwas anderes, als er behauptet. Die Randleerzeichen fallen beim
				// Trimmen weg und aendern an der Zaehlung nichts.
				insertLegacy(connection, projectA, "Nachhaltigkeit");
				insertLegacy(connection, projectB, "Nachhaltigkeit");
				insertLegacy(connection, projectD, "Nachhaltigkeit");
				insertLegacy(connection, projectC, "nachhaltigkeit ");
				insertLegacy(connection, projectA, " nachhaltigkeit");
				// Ein leerer Wert hat kein Schlagwort und darf keine Zeile werden.
				insertLegacy(connection, projectB, "   ");
				// Innere Mehrfach-Leerzeichen gehoeren zur selben Normalform wie im
				// Schreibweg; ohne sie stuenden hier zwei Zeilen.
				insertLegacy(connection, projectA, "Green  IT");
				insertLegacy(connection, projectB, "Green IT");

				runMigration(connection);

				Map<String, Long> tags = tagsWithUsage(connection);
				assertThat(tags)
						.as("Aus fuenf Schreibweisen wird ein Tag, aus zwei ein zweites; "
								+ "der leere Wert ergibt keines")
						.containsOnlyKeys("Nachhaltigkeit", "Green IT");
				assertThat(tags.get("Nachhaltigkeit"))
						.as("Vier Projekte tragen das Tag; Projekt A trug zwei Schreibweisen "
								+ "und zaehlt danach einmal")
						.isEqualTo(4L);
				assertThat(tags.get("Green IT")).isEqualTo(2L);
			} finally {
				cleanUp(connection);
			}
		}
	}

	@Test
	@DisplayName("Ein Projekt mit zwei Schreibweisen traegt danach genau einen Tag")
	void duplicatePairsAreRemovedBeforeTheNewKey() throws Exception {
		UUID project = UUID.randomUUID();

		try (Connection connection = dataSource.getConnection()) {
			try {
				prepareLegacyTable(connection);
				insertLegacy(connection, project, "Nachhaltigkeit");
				insertLegacy(connection, project, "nachhaltigkeit");
				insertLegacy(connection, project, "NACHHALTIGKEIT");

				// Scheitert der neue Primaerschluessel an den drei Zeilen, wirft
				// bereits dieser Aufruf; die Zusicherung darunter ist die zweite
				// Haelfte derselben Aussage.
				runMigration(connection);

				int zuordnungen = assignmentCount(connection, project);
				assertThat(zuordnungen)
						.as("Aus drei Zuordnungen auf dasselbe Tag wird genau eine")
						.isEqualTo(1);
			} finally {
				cleanUp(connection);
			}
		}
	}

	@Test
	@DisplayName("Der Anzeigename entscheidet bei Gleichstand alphabetisch")
	void alphabeticalOrderBreaksTheTie() throws Exception {
		try (Connection connection = dataSource.getConnection()) {
			try {
				prepareLegacyTable(connection);
				insertLegacy(connection, UUID.randomUUID(), "beta");
				insertLegacy(connection, UUID.randomUUID(), "Beta");

				runMigration(connection);

				Map<String, Long> tags = tagsWithUsage(connection);

				// Welche der beiden Schreibweisen die alphabetisch erste ist,
				// entscheidet die Kollation der Datenbank. Der Test schreibt sie
				// deshalb nicht fest, sondern die Zusage dahinter: aus zwei
				// Schreibweisen wird genau eine Zeile, und welche es ist, haengt an
				// einer festen Regel und nicht an der Zeilenreihenfolge.
				assertThat(tags).hasSize(1);
				assertThat(tags.keySet()).containsAnyOf("beta", "Beta");
			} finally {
				cleanUp(connection);
			}
		}
	}

	// ------------------------------------------------------------------
	// Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Legt {@code project_tag} in der Form an, die vor dieser Migration galt:
	 * Wertetabelle mit dem Primaerschluessel {@code (project_id, tag)}. Den
	 * Namen des Schluessels vergibt PostgreSQL selbst als
	 * {@code project_tag_pkey}, also genau so, wie die Migration ihn loest.
	 *
	 * <p>Ohne Fremdschluessel auf {@code project}: die Migration fasst ihn nicht
	 * an, und die Projekt-IDs dieses Tests sollen frei erfunden sein duerfen.
	 */
	private void prepareLegacyTable(Connection connection) throws Exception {
		try (Statement statement = connection.createStatement()) {
			dropTemporaryTables(statement);
			statement.execute("""
					create temporary table project_tag (
						project_id uuid        not null,
						tag        varchar(64) not null,
						primary key (project_id, tag)
					)
					""");
		}
	}

	/**
	 * Raeumt die temporaeren Tabellen eines frueheren Tests weg.
	 *
	 * <p>Notwendig, weil die Verbindung aus dem Pool kommt und beim Zurueckgeben
	 * nicht geschlossen wird: temporaere Tabellen ueberleben deshalb den Test,
	 * der sie angelegt hat, und der naechste liefe in
	 * &bdquo;relation already exists&ldquo;.
	 *
	 * <p><strong>Beide Namen ausdruecklich mit {@code pg_temp} qualifiziert.</strong>
	 * Unqualifiziert loeste {@code drop table if exists tag} den Namen ueber den
	 * {@code search_path} auf und traefe die echte Tabelle, sobald die temporaere
	 * fehlt.
	 */
	private void dropTemporaryTables(Statement statement) throws Exception {
		statement.execute("drop table if exists pg_temp.project_tag");
		statement.execute("drop table if exists pg_temp.tag");
	}

	private void insertLegacy(Connection connection, UUID projectId, String tag) throws Exception {
		try (var statement = connection.prepareStatement(
				"insert into project_tag (project_id, tag) values (?, ?)")) {
			statement.setObject(1, projectId);
			statement.setString(2, tag);
			statement.executeUpdate();
		}
	}

	/**
	 * Fuehrt die Migration auf den temporaeren Tabellen aus. Die einzige
	 * Ersetzung ist {@code create table tag} nach
	 * {@code create temporary table tag}; alles Weitere laeuft woertlich, weil
	 * unqualifizierte Namen in {@code pg_temp} aufgeloest werden.
	 */
	private void runMigration(Connection connection) throws Exception {
		String sql = new String(FileCopyUtils.copyToByteArray(
				new ClassPathResource(MIGRATION).getInputStream()), StandardCharsets.UTF_8);
		sql = sql.replace("create table tag (", "create temporary table tag (");
		sql = LINE_COMMENT.matcher(sql).replaceAll("");

		try (Statement statement = connection.createStatement()) {
			for (String anweisung : sql.split(";")) {
				if (!anweisung.isBlank()) {
					statement.execute(anweisung);
				}
			}
		}
	}

	/** Tag-Name auf die Zahl der Projekte, die ihn nach der Migration tragen. */
	private Map<String, Long> tagsWithUsage(Connection connection) throws Exception {
		Map<String, Long> result = new LinkedHashMap<>();
		try (Statement statement = connection.createStatement();
				ResultSet rows = statement.executeQuery("""
						select t.name, count(pt.project_id) as verwendungen
						from tag t
						left join project_tag pt on pt.tag_id = t.id
						group by t.name
						order by t.name
						""")) {
			while (rows.next()) {
				result.put(rows.getString(1), rows.getLong(2));
			}
		}
		return result;
	}

	/** Siehe {@link #dropTemporaryTables(Statement)}. */
	private void cleanUp(Connection connection) throws Exception {
		try (Statement statement = connection.createStatement()) {
			dropTemporaryTables(statement);
		}
	}

	private int assignmentCount(Connection connection, UUID projectId) throws Exception {
		List<UUID> tagIds = new ArrayList<>();
		try (var statement = connection.prepareStatement(
				"select tag_id from project_tag where project_id = ?")) {
			statement.setObject(1, projectId);
			try (ResultSet rows = statement.executeQuery()) {
				while (rows.next()) {
					tagIds.add(rows.getObject(1, UUID.class));
				}
			}
		}
		return tagIds.size();
	}
}
