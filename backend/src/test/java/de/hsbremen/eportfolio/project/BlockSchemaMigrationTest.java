package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Die Schemamigration aus §2.10: ein Dokument der Version 1 wird beim Lesen in
 * die Form aus Contract v51 gebracht (KAN-72).
 *
 * <p><strong>Der Test schliesst den Kreis zur Validierung.</strong> Jedes
 * migrierte Ergebnis wird zusaetzlich durch den {@link BlockValidationService}
 * geschickt: die Migration hat nur dann ihren Zweck erfuellt, wenn das Dokument
 * danach auch wieder <em>speicherbar</em> ist. Genau daran wuerde eine
 * unvollstaendige Migration scheitern, ohne dass ein reiner Formvergleich es
 * bemerkte.
 */
class BlockSchemaMigrationTest {

	private static final ObjectMapper MAPPER = new ObjectMapper();

	private static final String FILE_ID = "3f1c9a52-0c1e-4a1f-9a3e-2f1d5c7b8e10";

	private static final String OTHER_FILE_ID = "7b2e4d61-9a8c-4f02-8d55-6c0b3a9e1d24";

	private final BlockValidationService validation = new BlockValidationService();

	@Test
	@DisplayName("Die aktuelle Version ist 3 (Contract v66, §2.10)")
	void currentVersionIsThree() {
		assertThat(BlockSchemaMigration.CURRENT_VERSION).isEqualTo(3);
	}

	/**
	 * Die Ebenenverschiebung aus v63 (§2.5, §2.10). Sie ist der Grund fuer die
	 * Schemaversion 3: dieselbe gespeicherte Zahl bedeutet vorher und nachher
	 * etwas anderes, weil die Anzeige seit v63 eine Stufe tiefer rendert.
	 */
	@Nested
	@DisplayName("Version 2 nach 3: Ebenen verschieben sich um eine Stufe")
	class TwoToThree {

		@Test
		@DisplayName("Ebene 2 wird 1 und Ebene 3 wird 2")
		void levelsShiftDown() {
			assertThat(levelAfter(2, 2)).isEqualTo(1);
			assertThat(levelAfter(3, 2)).isEqualTo(2);
		}

		@Test
		@DisplayName("Ein Beitrag sieht danach unveraendert aus")
		void appearanceIsUnchanged() {
			/* Bis v62 wurde level 2 als h2 gerendert. Ab v63 rendert die
			   Anzeige eine Stufe tiefer, aus level 1 wird also wieder h2. */
			JsonNode migrated = migrateFrom(BlockType.HEADING,
					node("heading", MAPPER.createObjectNode().put("level", 2)), 2);

			assertThat(migrated.path("attrs").path("level").asInt() + 1).isEqualTo(2);
			assertValid(BlockType.HEADING, migrated);
		}

		@Test
		@DisplayName("Die Kette aus Version 1 ergibt dieselbe oberste Zwischenueberschrift")
		void chainFromVersionOne() {
			/* 1 nach 2 hebt die alte h1 auf 2, 2 nach 3 macht daraus die 1:
			   der Sache nach dieselbe oberste Zwischenueberschrift. */
			assertThat(levelAfter(1, 1)).isEqualTo(1);
		}

		@Test
		@DisplayName("Ein Dokument der Version 3 bleibt unberuehrt")
		void versionThreeIsNotShifted() {
			assertThat(levelAfter(2, 3)).isEqualTo(2);
		}

		@Test
		@DisplayName("Andere Blocktypen bleiben unberuehrt")
		void otherTypesAreUntouched() {
			JsonNode paragraph = node("paragraph",
					MAPPER.createObjectNode().put("textAlign", "center"));

			assertThat(migrateFrom(BlockType.TEXT, paragraph, 2)).isEqualTo(paragraph);
		}

		private int levelAfter(int level, int fromVersion) {
			return migrateFrom(BlockType.HEADING,
					node("heading", MAPPER.createObjectNode().put("level", level)),
					fromVersion).path("attrs").path("level").asInt();
		}
	}

	@Nested
	@DisplayName("Version 1 nach 2: die Formaenderungen aus v51")
	class OneToTwo {

		@Test
		@DisplayName("GALLERY.fileIds wird zu items mit leerem alt, fileIds verschwindet")
		void galleryFileIdsBecomeItems() {
			ObjectNode attrs = MAPPER.createObjectNode();
			attrs.set("fileIds", MAPPER.createArrayNode().add(FILE_ID).add(OTHER_FILE_ID));
			attrs.put("caption", "Zwei Ansichten");

			JsonNode migrated = migrate(BlockType.GALLERY, node("galleryBlock", attrs));
			JsonNode items = migrated.path("attrs").path("items");

			assertThat(migrated.path("attrs").has("fileIds")).isFalse();
			assertThat(items).hasSize(2);
			assertThat(items.get(0).path("fileId").asText()).isEqualTo(FILE_ID);
			assertThat(items.get(0).path("alt").asText()).isEmpty();
			assertThat(items.get(1).path("fileId").asText()).isEqualTo(OTHER_FILE_ID);
			// Was §2.5 nicht geaendert hat, bleibt unberuehrt.
			assertThat(migrated.path("attrs").path("caption").asText()).isEqualTo("Zwei Ansichten");
			assertValid(BlockType.GALLERY, migrated);
		}

		@Test
		@DisplayName("Eine Galerie, die bereits items fuehrt, behaelt sie")
		void galleryKeepsExistingItems() {
			ObjectNode attrs = MAPPER.createObjectNode();
			attrs.set("items", MAPPER.createArrayNode()
					.add(MAPPER.createObjectNode().put("fileId", FILE_ID).put("alt", "Beschrieben")));
			attrs.set("fileIds", MAPPER.createArrayNode().add(OTHER_FILE_ID));

			JsonNode migrated = migrate(BlockType.GALLERY, node("galleryBlock", attrs));

			assertThat(migrated.path("attrs").has("fileIds")).isFalse();
			assertThat(migrated.path("attrs").path("items")).hasSize(1);
			assertThat(migrated.path("attrs").path("items").get(0).path("alt").asText())
					.isEqualTo("Beschrieben");
			assertValid(BlockType.GALLERY, migrated);
		}

		@Test
		@DisplayName("AUDIO verliert src und bleibt mit fileId speicherbar")
		void audioLosesSrc() {
			JsonNode migrated = migrate(BlockType.AUDIO,
					node("audioBlock", MAPPER.createObjectNode()
							.put("fileId", FILE_ID)
							.put("src", "https://fremde.tld/ton.mp3")));

			assertThat(migrated.path("attrs").has("src")).isFalse();
			assertThat(migrated.path("attrs").path("fileId").asText()).isEqualTo(FILE_ID);
			assertValid(BlockType.AUDIO, migrated);
		}

		@Test
		@DisplayName("VIDEO verliert embedUrl und src")
		void videoLosesUrls() {
			JsonNode migrated = migrate(BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "youtube")
							.put("videoId", "dQw4w9WgXcQ")
							.put("embedUrl", "https://www.youtube.com/embed/dQw4w9WgXcQ")
							.put("src", "https://fremde.tld/film.mp4")));

			assertThat(migrated.path("attrs").has("embedUrl")).isFalse();
			assertThat(migrated.path("attrs").has("src")).isFalse();
			assertValid(BlockType.VIDEO, migrated);
		}

		@Test
		@DisplayName("Marks und Text bleiben unberuehrt: migriert wird nur die Attributform")
		void marksAreUntouched() {
			ObjectNode mark = MAPPER.createObjectNode().put("type", "link");
			mark.set("attrs", MAPPER.createObjectNode().put("href", "https://www.hs-bremen.de"));
			ObjectNode text = MAPPER.createObjectNode().put("type", "text").put("text", "Link");
			text.set("marks", MAPPER.createArrayNode().add(mark));
			ObjectNode paragraph = MAPPER.createObjectNode().put("type", "paragraph");
			paragraph.set("attrs", MAPPER.createObjectNode().put("textAlign", "left"));
			paragraph.set("content", MAPPER.createArrayNode().add(text));

			JsonNode migrated = migrate(BlockType.TEXT, paragraph);

			assertThat(migrated).isEqualTo(paragraph);
			assertValid(BlockType.TEXT, migrated);
		}
	}

	@Test
	@DisplayName("Ein Dokument der aktuellen Version geht unveraendert durch, ohne Kopie")
	void currentVersionIsReturnedAsIs() {
		JsonNode content = BlockValidationServiceTest.VALID_CONTENT.get(BlockType.GALLERY);

		assertThat(BlockSchemaMigration.toCurrent(BlockType.GALLERY, content,
				BlockSchemaMigration.CURRENT_VERSION)).isSameAs(content);
	}

	/**
	 * Der Vorrat aus {@link BlockValidationServiceTest} liegt bereits in der
	 * aktuellen Form. Durch die Migration geschickt, als kaeme er aus Version 1,
	 * darf er sich nicht veraendern: die Migration fasst nur an, was das alte
	 * Format wirklich traegt.
	 *
	 * <p><strong>HEADING ist ausgenommen, und das ist keine Luecke.</strong>
	 * Seine Ebene ist der eine Fall, in dem dieselbe Zahl je Version etwas
	 * anderes bedeutet; genau dafuer gibt es die Version. Ein {@code level: 2},
	 * das als Version 1 hereingereicht wird, <em>muss</em> als 1 herauskommen,
	 * sonst rutschte der Beitrag in der Anzeige eine Stufe. Der Fall steht in
	 * {@link TwoToThree}.
	 */
	@ParameterizedTest
	@EnumSource(value = BlockType.class, names = "HEADING", mode = EnumSource.Mode.EXCLUDE)
	@DisplayName("Ein bereits aktuelles Dokument ueberlebt die Migration unveraendert")
	void migrationIsIdempotentOnCurrentContent(BlockType type) {
		JsonNode content = BlockValidationServiceTest.VALID_CONTENT.get(type);

		assertThat(BlockSchemaMigration.toCurrent(type, content, 1)).isEqualTo(content);
	}

	@Test
	@DisplayName("Ein Knoten ohne attrs und ein null-Inhalt brechen nicht")
	void degenerateInput() {
		assertThat(BlockSchemaMigration.toCurrent(BlockType.TEXT, null, 1)).isNull();
		JsonNode withoutAttrs = MAPPER.createObjectNode().put("type", "paragraph");
		assertThat(BlockSchemaMigration.toCurrent(BlockType.TEXT, withoutAttrs, 1))
				.isEqualTo(withoutAttrs);
	}

	/**
	 * Die Migration arbeitet auf einer Kopie. Wuerde sie das Original anfassen,
	 * meldete Hibernate {@code Block.content} als schmutzig und schriebe die
	 * Aenderung im Lesepfad zurueck.
	 */
	@Test
	@DisplayName("Das Original bleibt unangetastet")
	void originalIsNotMutated() {
		ObjectNode attrs = MAPPER.createObjectNode();
		attrs.set("fileIds", MAPPER.createArrayNode().add(FILE_ID));
		JsonNode original = node("galleryBlock", attrs);
		JsonNode before = original.deepCopy();

		BlockSchemaMigration.toCurrent(BlockType.GALLERY, original, 1);

		assertThat(original).isEqualTo(before);
	}

	// ------------------------------------------------------------------

	private JsonNode migrate(BlockType type, JsonNode content) {
		return migrateFrom(type, content, 1);
	}

	private JsonNode migrateFrom(BlockType type, JsonNode content, int fromVersion) {
		return BlockSchemaMigration.toCurrent(type, content, fromVersion);
	}

	/** Der Zweck der Migration: das Ergebnis muss wieder speicherbar sein. */
	private void assertValid(BlockType type, JsonNode content) {
		assertThatCode(() -> validation.validate(type, content, 0))
				.doesNotThrowAnyException();
	}

	private static JsonNode node(String nodeType, JsonNode attrs) {
		return MAPPER.createObjectNode().put("type", nodeType).set("attrs", attrs);
	}
}
