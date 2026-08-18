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
	@DisplayName("Die aktuelle Version ist 2 (Contract v51, §2.10)")
	void currentVersionIsTwo() {
		assertThat(BlockSchemaMigration.CURRENT_VERSION).isEqualTo(2);
	}

	@Nested
	@DisplayName("Version 1 nach 2")
	class OneToTwo {

		@Test
		@DisplayName("HEADING Ebene 1 wird zur Ebene 2, denn Ebene 1 ist der Projekttitel")
		void headingLevelOne() {
			JsonNode migrated = migrate(BlockType.HEADING,
					node("heading", MAPPER.createObjectNode().put("level", 1)));

			assertThat(migrated.path("attrs").path("level").asInt()).isEqualTo(2);
			assertValid(BlockType.HEADING, migrated);
		}

		@Test
		@DisplayName("Ebene 2 und 3 bleiben, wie sie sind")
		void headingLevelsStay() {
			for (int level : new int[] { 2, 3 }) {
				JsonNode migrated = migrate(BlockType.HEADING,
						node("heading", MAPPER.createObjectNode().put("level", level)));
				assertThat(migrated.path("attrs").path("level").asInt()).isEqualTo(level);
			}
		}

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
	 */
	@ParameterizedTest
	@EnumSource(BlockType.class)
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
		return BlockSchemaMigration.toCurrent(type, content, 1);
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
