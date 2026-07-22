package de.hsbremen.eportfolio.projekt;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockTyp;
import de.hsbremen.eportfolio.common.error.ValidierungException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Prueft Inhaltsbloecke gegen das Block-Schema (API-Contract §2.5):
 * inhalt.type muss zum typ passen, typabhaengige Pflichtfelder muessen
 * gesetzt sein, und fuer VIDEO/EINBETTUNG wird die Provider-Allowlist
 * serverseitig durchgesetzt. Verstoesse fuehren zu einer
 * {@link ValidierungException}, die als HTTP 400 mit dem Envelope aus
 * §6.2 beantwortet wird.
 */
@Service
public class BlockValidationService {

	static final String FEHLERCODE = "BLOCK_UNGUELTIG";

	/** Zulaessige ProseMirror-Knotentypen je BlockTyp (LISTE deckt beide Listenarten ab). */
	private static final Map<BlockTyp, Set<String>> ERLAUBTE_NODE_TYPEN = Map.ofEntries(
			Map.entry(BlockTyp.UEBERSCHRIFT, Set.of("heading")),
			Map.entry(BlockTyp.TEXT, Set.of("paragraph")),
			Map.entry(BlockTyp.LISTE, Set.of("bulletList", "orderedList")),
			Map.entry(BlockTyp.ZITAT, Set.of("blockquote")),
			Map.entry(BlockTyp.CODE, Set.of("codeBlock")),
			Map.entry(BlockTyp.FORMEL, Set.of("mathBlock")),
			Map.entry(BlockTyp.TABELLE, Set.of("table")),
			Map.entry(BlockTyp.TRENNLINIE, Set.of("horizontalRule")),
			Map.entry(BlockTyp.BILD, Set.of("imageBlock")),
			Map.entry(BlockTyp.GALERIE, Set.of("galleryBlock")),
			Map.entry(BlockTyp.VIDEO, Set.of("videoBlock")),
			Map.entry(BlockTyp.AUDIO, Set.of("audioBlock")),
			Map.entry(BlockTyp.DOKUMENT, Set.of("dokumentBlock")),
			Map.entry(BlockTyp.EINBETTUNG, Set.of("embedBlock")));

	/** Erlaubte Embed-Hosts je Provider; nur https. */
	private static final Map<String, Set<String>> ERLAUBTE_EMBED_HOSTS = Map.of(
			"youtube", Set.of("www.youtube.com", "youtube.com", "www.youtube-nocookie.com"),
			"vimeo", Set.of("player.vimeo.com"),
			"figma", Set.of("www.figma.com"),
			"codepen", Set.of("codepen.io"),
			"gist", Set.of("gist.github.com"));

	private static final Set<String> VIDEO_PROVIDER = Set.of("youtube", "vimeo");

	/**
	 * Zulaessige videoId-Formate je Provider. Bewusst restriktiv, weil die
	 * Embed-URL serverseitig aus der videoId aufgebaut wird und keine
	 * URL-Metazeichen enthalten darf.
	 */
	private static final Map<String, Pattern> VIDEO_ID_MUSTER = Map.of(
			"youtube", Pattern.compile("[A-Za-z0-9_-]{1,64}"),
			"vimeo", Pattern.compile("\\d{1,32}"));

	public void validiere(List<Block> blocks) {
		for (int i = 0; i < blocks.size(); i++) {
			validiereBlock(blocks.get(i), i);
		}
	}

	public void validiereBlock(Block block, int index) {
		BlockTyp typ = block.getTyp();
		if (typ == null) {
			throw fehler(index, "typ fehlt");
		}
		JsonNode inhalt = block.getInhalt();
		if (inhalt == null || !inhalt.isObject()) {
			throw fehler(index, "inhalt fehlt oder ist kein Objekt");
		}
		String nodeTyp = inhalt.path("type").asText("");
		if (!ERLAUBTE_NODE_TYPEN.get(typ).contains(nodeTyp)) {
			throw fehler(index, "inhalt.type '" + nodeTyp + "' passt nicht zu typ " + typ);
		}
		JsonNode attrs = inhalt.path("attrs");
		switch (typ) {
			case UEBERSCHRIFT -> {
				int ebene = attrs.path("level").asInt(0);
				if (ebene < 1 || ebene > 3) {
					throw fehler(index, "UEBERSCHRIFT braucht attrs.level zwischen 1 und 3");
				}
			}
			case FORMEL -> pflichtText(index, typ, attrs, "latex");
			case BILD -> pflichtText(index, typ, attrs, "dateiId");
			case GALERIE -> {
				JsonNode ids = attrs.path("dateiIds");
				if (!ids.isArray() || ids.isEmpty()) {
					throw fehler(index, "GALERIE braucht attrs.dateiIds als nicht-leeres Array");
				}
			}
			case VIDEO -> {
				// Kein embedUrl-Pflichtfeld: die Embed-URL wird serverseitig aus
				// provider + videoId abgeleitet und nie vom Client uebernommen.
				String provider = attrs.path("provider").asText("");
				if (!VIDEO_PROVIDER.contains(provider)) {
					throw fehler(index, "VIDEO: provider '" + provider
							+ "' ist nicht erlaubt (zulaessig: youtube, vimeo)");
				}
				String videoId = attrs.path("videoId").asText("");
				if (videoId.isBlank()) {
					throw fehler(index, "VIDEO braucht attrs.videoId");
				}
				if (!VIDEO_ID_MUSTER.get(provider).matcher(videoId).matches()) {
					throw fehler(index, "VIDEO: videoId hat ein ungueltiges Format fuer Provider '"
							+ provider + "'");
				}
			}
			case EINBETTUNG -> pruefeEmbed(index, typ, attrs, ERLAUBTE_EMBED_HOSTS.keySet());
			case AUDIO -> {
				boolean hatDatei = istText(attrs, "dateiId");
				boolean hatUrl = istText(attrs, "src");
				if (!hatDatei && !hatUrl) {
					throw fehler(index, "AUDIO braucht attrs.dateiId oder attrs.src");
				}
				if (hatUrl && !istHttpUrl(attrs.path("src").asText())) {
					throw fehler(index, "AUDIO: attrs.src muss eine http(s)-URL sein");
				}
			}
			case DOKUMENT -> {
				pflichtText(index, typ, attrs, "dateiId");
				pflichtText(index, typ, attrs, "dateiname");
				if (attrs.path("groesse").asLong(0) <= 0) {
					throw fehler(index, "DOKUMENT braucht attrs.groesse in Bytes (> 0)");
				}
			}
			// TEXT, LISTE, ZITAT, CODE, TABELLE, TRENNLINIE haben keine Pflicht-Attribute.
			default -> { /* nichts zu pruefen */ }
		}
	}

	/**
	 * Leitet die Embed-URL eines VIDEO-Blocks serverseitig aus provider und
	 * videoId ab. Eine vom Client mitgeschickte embedUrl wird bewusst nicht
	 * uebernommen; die videoId ist zuvor gegen {@link #VIDEO_ID_MUSTER}
	 * validiert.
	 */
	public String embedUrlFuerVideo(String provider, String videoId) {
		return switch (provider) {
			case "youtube" -> "https://www.youtube.com/embed/" + videoId;
			case "vimeo" -> "https://player.vimeo.com/video/" + videoId;
			default -> throw new ValidierungException(FEHLERCODE,
					"VIDEO: provider '" + provider + "' ist nicht erlaubt (zulaessig: youtube, vimeo)");
		};
	}

	/** Provider-Allowlist serverseitig: Provider erlaubt und embedUrl-Host passend zum Provider. */
	private void pruefeEmbed(int index, BlockTyp typ, JsonNode attrs, Set<String> erlaubteProvider) {
		pflichtText(index, typ, attrs, "embedUrl");
		String provider = attrs.path("provider").asText("");
		if (!erlaubteProvider.contains(provider)) {
			throw fehler(index, typ + ": provider '" + provider + "' ist nicht erlaubt (zulaessig: "
					+ String.join(", ", erlaubteProvider.stream().sorted().toList()) + ")");
		}
		String embedUrl = attrs.path("embedUrl").asText("");
		try {
			URI uri = URI.create(embedUrl);
			if (!"https".equals(uri.getScheme())
					|| uri.getHost() == null
					|| !ERLAUBTE_EMBED_HOSTS.get(provider).contains(uri.getHost())) {
				throw fehler(index, typ + ": embedUrl-Host passt nicht zum Provider '" + provider + "'");
			}
		} catch (IllegalArgumentException e) {
			throw fehler(index, typ + ": embedUrl ist keine gueltige URL");
		}
	}

	private void pflichtText(int index, BlockTyp typ, JsonNode attrs, String feld) {
		if (!istText(attrs, feld)) {
			throw fehler(index, typ + " braucht attrs." + feld);
		}
	}

	private boolean istText(JsonNode attrs, String feld) {
		JsonNode wert = attrs.path(feld);
		return wert.isTextual() && !wert.asText().isBlank();
	}

	private boolean istHttpUrl(String wert) {
		try {
			String schema = URI.create(wert).getScheme();
			return "http".equals(schema) || "https".equals(schema);
		} catch (IllegalArgumentException e) {
			return false;
		}
	}

	private ValidierungException fehler(int index, String grund) {
		return new ValidierungException(FEHLERCODE, "Block " + index + ": " + grund);
	}
}
