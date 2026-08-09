package de.hsbremen.eportfolio.file;

import java.util.Locale;
import java.util.Optional;

/**
 * Die Allowlist aus API-Contract §3.15: genau sieben MIME-Typen, je mit
 * Groessenlimit und der Signatur am Dateianfang.
 *
 * <p><strong>Warum nicht der gemeldete Content-Type allein.</strong> Er
 * stammt aus dem Multipart-Teil und ist damit ein Wert, den der Client frei
 * setzt. Ohne die Signaturpruefung genuegt ein umbenanntes Archiv mit
 * {@code Content-Type: image/png}, um beliebige Bytes in den Objektspeicher
 * zu legen, die das Portal anschliessend als Bild ausliefert. Die sieben
 * zugelassenen Formate haben feste Signaturen; die Pruefung braucht deshalb
 * keine Bibliothek zur Typerkennung.
 *
 * <p>Das Limit haengt an der Verwendung, und die leitet sich aus dem
 * geprueften Typ ab: Bilder 10 MB, Audio und PDF 25 MB (§3.15). Ein eigener
 * Parameter fuer die Verwendung existiert deshalb nicht.
 *
 * <p><strong>Kein Video</strong>: Bewegtbild laeuft ausschliesslich ueber
 * die Provider-Allowlist der Einbettung (§2.5).
 */
public enum AllowedFileType {

	PNG("image/png", MaxBytes.IMAGE),
	JPEG("image/jpeg", MaxBytes.IMAGE),
	WEBP("image/webp", MaxBytes.IMAGE),
	MP3("audio/mpeg", MaxBytes.MEDIA),
	WAV("audio/wav", MaxBytes.MEDIA),
	OGG("audio/ogg", MaxBytes.MEDIA),
	PDF("application/pdf", MaxBytes.MEDIA);

	/**
	 * So viele Bytes vom Dateianfang braucht die Pruefung: die laengsten
	 * Signaturen (WEBP, WAVE) stehen in den Bytes 8 bis 11.
	 */
	public static final int HEADER_LENGTH = 12;

	private final String mimeType;

	private final long maxBytes;

	AllowedFileType(String mimeType, long maxBytes) {
		this.mimeType = mimeType;
		this.maxBytes = maxBytes;
	}

	/**
	 * Der Typ zu einem gemeldeten Content-Type, oder leer, wenn er nicht in
	 * der Allowlist steht. Parameter wie {@code ; charset=...} werden
	 * abgeschnitten, verglichen wird ohne Beachtung der Schreibweise.
	 */
	public static Optional<AllowedFileType> fromMimeType(String contentType) {
		if (contentType == null) {
			return Optional.empty();
		}
		int parameterStart = contentType.indexOf(';');
		String plain = (parameterStart >= 0 ? contentType.substring(0, parameterStart) : contentType)
				.trim().toLowerCase(Locale.ROOT);
		for (AllowedFileType type : values()) {
			if (type.mimeType.equals(plain)) {
				return Optional.of(type);
			}
		}
		return Optional.empty();
	}

	public String mimeType() {
		return mimeType;
	}

	public long maxBytes() {
		return maxBytes;
	}

	/**
	 * Passen die ersten Bytes zur Signatur dieses Typs (§3.15)?
	 *
	 * <p>MP3 hat zwei gueltige Anfaenge: ein {@code ID3}-Tag vor dem ersten
	 * Frame oder direkt der Frame-Sync, elf gesetzte Bits ({@code FF Ex}).
	 * WEBP und WAV sind beide RIFF-Container und unterscheiden sich erst am
	 * Formatkennzeichen in den Bytes 8 bis 11.
	 *
	 * @param head die ersten {@link #HEADER_LENGTH} Bytes; eine kuerzere
	 *             Datei kann keine gueltige Signatur tragen und ergibt
	 *             {@code false}
	 */
	public boolean matchesSignature(byte[] head) {
		return switch (this) {
			case PNG -> matchesAt(head, 0, 0x89, 'P', 'N', 'G');
			case JPEG -> matchesAt(head, 0, 0xFF, 0xD8, 0xFF);
			case WEBP -> matchesAt(head, 0, 'R', 'I', 'F', 'F')
					&& matchesAt(head, 8, 'W', 'E', 'B', 'P');
			case MP3 -> matchesAt(head, 0, 'I', 'D', '3') || isMp3FrameSync(head);
			case WAV -> matchesAt(head, 0, 'R', 'I', 'F', 'F')
					&& matchesAt(head, 8, 'W', 'A', 'V', 'E');
			case OGG -> matchesAt(head, 0, 'O', 'g', 'g', 'S');
			case PDF -> matchesAt(head, 0, '%', 'P', 'D', 'F', '-');
		};
	}

	private static boolean isMp3FrameSync(byte[] head) {
		return head.length >= 2
				&& (head[0] & 0xFF) == 0xFF
				&& (head[1] & 0xE0) == 0xE0;
	}

	private static boolean matchesAt(byte[] head, int offset, int... expected) {
		if (head.length < offset + expected.length) {
			return false;
		}
		for (int i = 0; i < expected.length; i++) {
			if ((head[offset + i] & 0xFF) != expected[i]) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Die beiden Limits aus §3.15, als eigene Klasse nur deshalb, weil Java
	 * in Enum-Konstruktoraufrufen keine eigenen statischen Felder des Enums
	 * zulaesst.
	 */
	private static final class MaxBytes {

		private static final long IMAGE = 10L * 1024 * 1024;

		private static final long MEDIA = 25L * 1024 * 1024;

		private MaxBytes() {
		}
	}
}
