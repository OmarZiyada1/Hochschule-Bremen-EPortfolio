package de.hsbremen.eportfolio.project;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Prueft Inhaltsbloecke gegen das Block-Schema (API-Contract §2.5):
 * content.type muss zum type passen, typabhaengige Pflichtfelder muessen
 * gesetzt sein, und fuer VIDEO/EMBED wird die Provider-Allowlist serverseitig
 * durchgesetzt. Verstoesse fuehren zu einer {@link ValidationException}, die
 * als HTTP 400 mit dem Envelope aus §6.2 beantwortet wird.
 */
@Service
public class BlockValidationService {

	/** Zulaessige ProseMirror-Knotentypen je BlockType (LIST deckt beide Listenarten ab). */
	private static final Map<BlockType, Set<String>> ALLOWED_NODE_TYPES = Map.ofEntries(
			Map.entry(BlockType.HEADING, Set.of("heading")),
			Map.entry(BlockType.TEXT, Set.of("paragraph")),
			Map.entry(BlockType.LIST, Set.of("bulletList", "orderedList")),
			Map.entry(BlockType.QUOTE, Set.of("blockquote")),
			Map.entry(BlockType.CODE, Set.of("codeBlock")),
			Map.entry(BlockType.FORMULA, Set.of("mathBlock")),
			Map.entry(BlockType.TABLE, Set.of("table")),
			Map.entry(BlockType.DIVIDER, Set.of("horizontalRule")),
			Map.entry(BlockType.IMAGE, Set.of("imageBlock")),
			Map.entry(BlockType.GALLERY, Set.of("galleryBlock")),
			Map.entry(BlockType.VIDEO, Set.of("videoBlock")),
			Map.entry(BlockType.AUDIO, Set.of("audioBlock")),
			Map.entry(BlockType.DOCUMENT, Set.of("documentBlock")),
			Map.entry(BlockType.EMBED, Set.of("embedBlock")));

	/** Erlaubte Embed-Hosts je Provider; nur https. */
	private static final Map<String, Set<String>> ALLOWED_EMBED_HOSTS = Map.of(
			"youtube", Set.of("www.youtube.com", "youtube.com", "www.youtube-nocookie.com"),
			"vimeo", Set.of("player.vimeo.com"),
			"figma", Set.of("www.figma.com"),
			"codepen", Set.of("codepen.io"),
			"gist", Set.of("gist.github.com"));

	private static final Set<String> VIDEO_PROVIDERS = Set.of("youtube", "vimeo");

	/**
	 * Zulaessige videoId-Formate je Provider. Bewusst restriktiv, weil die
	 * Embed-URL serverseitig aus der videoId aufgebaut wird und keine
	 * URL-Metazeichen enthalten darf.
	 */
	private static final Map<String, Pattern> VIDEO_ID_PATTERNS = Map.of(
			"youtube", Pattern.compile("[A-Za-z0-9_-]{1,64}"),
			"vimeo", Pattern.compile("\\d{1,32}"));

	public void validate(List<Block> blocks) {
		for (int i = 0; i < blocks.size(); i++) {
			validateBlock(blocks.get(i), i);
		}
	}

	public void validateBlock(Block block, int index) {
		BlockType type = block.getType();
		if (type == null) {
			throw error(index, "type fehlt");
		}
		JsonNode content = block.getContent();
		if (content == null || !content.isObject()) {
			throw error(index, "content fehlt oder ist kein Objekt");
		}
		String nodeType = content.path("type").asText("");
		if (!ALLOWED_NODE_TYPES.get(type).contains(nodeType)) {
			throw error(index, "content.type '" + nodeType + "' passt nicht zu type " + type);
		}
		JsonNode attrs = content.path("attrs");
		switch (type) {
			case HEADING -> {
				int level = attrs.path("level").asInt(0);
				if (level < 1 || level > 3) {
					throw error(index, "HEADING braucht attrs.level zwischen 1 und 3");
				}
			}
			case FORMULA -> requireText(index, type, attrs, "latex");
			case IMAGE -> requireText(index, type, attrs, "fileId");
			case GALLERY -> {
				JsonNode ids = attrs.path("fileIds");
				if (!ids.isArray() || ids.isEmpty()) {
					throw error(index, "GALLERY braucht attrs.fileIds als nicht-leeres Array");
				}
			}
			case VIDEO -> {
				// Kein embedUrl-Pflichtfeld: die Embed-URL wird serverseitig aus
				// provider + videoId abgeleitet und nie vom Client uebernommen.
				String provider = attrs.path("provider").asText("");
				if (!VIDEO_PROVIDERS.contains(provider)) {
					throw error(index, "VIDEO: provider '" + provider
							+ "' ist nicht erlaubt (zulaessig: youtube, vimeo)");
				}
				String videoId = attrs.path("videoId").asText("");
				if (videoId.isBlank()) {
					throw error(index, "VIDEO braucht attrs.videoId");
				}
				if (!VIDEO_ID_PATTERNS.get(provider).matcher(videoId).matches()) {
					throw error(index, "VIDEO: videoId hat ein ungueltiges Format fuer Provider '"
							+ provider + "'");
				}
			}
			case EMBED -> checkEmbed(index, type, attrs, ALLOWED_EMBED_HOSTS.keySet());
			case AUDIO -> {
				boolean hasFile = isText(attrs, "fileId");
				boolean hasUrl = isText(attrs, "src");
				if (!hasFile && !hasUrl) {
					throw error(index, "AUDIO braucht attrs.fileId oder attrs.src");
				}
				if (hasUrl && !isHttpUrl(attrs.path("src").asText())) {
					throw error(index, "AUDIO: attrs.src muss eine http(s)-URL sein");
				}
			}
			case DOCUMENT -> {
				requireText(index, type, attrs, "fileId");
				requireText(index, type, attrs, "fileName");
				if (attrs.path("size").asLong(0) <= 0) {
					throw error(index, "DOCUMENT braucht attrs.size in Bytes (> 0)");
				}
			}
			// TEXT, LIST, QUOTE, CODE, TABLE, DIVIDER haben keine Pflicht-Attribute.
			default -> { /* nichts zu pruefen */ }
		}
	}

	/**
	 * Leitet die Embed-URL eines VIDEO-Blocks serverseitig aus provider und
	 * videoId ab. Eine vom Client mitgeschickte embedUrl wird bewusst nicht
	 * uebernommen; die videoId ist zuvor gegen {@link #VIDEO_ID_PATTERNS}
	 * validiert.
	 */
	public String embedUrlForVideo(String provider, String videoId) {
		return switch (provider) {
			case "youtube" -> "https://www.youtube.com/embed/" + videoId;
			case "vimeo" -> "https://player.vimeo.com/video/" + videoId;
			default -> throw new ValidationException(ErrorCodes.BLOCK_CONTENT_INVALID,
					"VIDEO: provider '" + provider + "' ist nicht erlaubt (zulaessig: youtube, vimeo)");
		};
	}

	/** Provider-Allowlist serverseitig: Provider erlaubt und embedUrl-Host passend zum Provider. */
	private void checkEmbed(int index, BlockType type, JsonNode attrs, Set<String> allowedProviders) {
		requireText(index, type, attrs, "embedUrl");
		String provider = attrs.path("provider").asText("");
		if (!allowedProviders.contains(provider)) {
			throw error(index, type + ": provider '" + provider + "' ist nicht erlaubt (zulaessig: "
					+ String.join(", ", allowedProviders.stream().sorted().toList()) + ")");
		}
		String embedUrl = attrs.path("embedUrl").asText("");
		try {
			URI uri = URI.create(embedUrl);
			if (!"https".equals(uri.getScheme())
					|| uri.getHost() == null
					|| !ALLOWED_EMBED_HOSTS.get(provider).contains(uri.getHost())) {
				throw error(index, type + ": embedUrl-Host passt nicht zum Provider '" + provider + "'");
			}
		} catch (IllegalArgumentException e) {
			throw error(index, type + ": embedUrl ist keine gueltige URL");
		}
	}

	private void requireText(int index, BlockType type, JsonNode attrs, String field) {
		if (!isText(attrs, field)) {
			throw error(index, type + " braucht attrs." + field);
		}
	}

	private boolean isText(JsonNode attrs, String field) {
		JsonNode value = attrs.path(field);
		return value.isTextual() && !value.asText().isBlank();
	}

	private boolean isHttpUrl(String value) {
		try {
			String scheme = URI.create(value).getScheme();
			return "http".equals(scheme) || "https".equals(scheme);
		} catch (IllegalArgumentException e) {
			return false;
		}
	}

	private ValidationException error(int index, String reason) {
		return new ValidationException(ErrorCodes.BLOCK_CONTENT_INVALID, "Block " + index + ": " + reason);
	}
}
