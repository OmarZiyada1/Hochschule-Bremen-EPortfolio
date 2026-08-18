package de.hsbremen.eportfolio.file;

import java.util.Locale;
import java.util.Optional;

/**
 * Die Allowlist aus API-Contract §3.15: genau neun MIME-Typen, je mit
 * Groessenlimit und der Signatur am Dateianfang.
 *
 * <p><strong>Warum nicht der gemeldete Content-Type allein.</strong> Er
 * stammt aus dem Multipart-Teil und ist damit ein Wert, den der Client frei
 * setzt. Ohne die Signaturpruefung genuegt ein umbenanntes Archiv mit
 * {@code Content-Type: image/png}, um beliebige Bytes in den Objektspeicher
 * zu legen, die das Portal anschliessend als Bild ausliefert. Die neun
 * zugelassenen Formate haben feste Signaturen; die Pruefung braucht deshalb
 * keine Bibliothek zur Typerkennung.
 *
 * <p>Das Limit haengt an der Verwendung, und die leitet sich aus dem
 * geprueften Typ ab: Bilder 10 MB, Audio und PDF 25 MB, Video 200 MB
 * (§3.15). Ein eigener Parameter fuer die Verwendung existiert deshalb nicht.
 *
 * <p><strong>Video seit Contract v51</strong> (KAN-72). Bis v50 war
 * Bewegtbild vom Upload ausgenommen und lief ausschliesslich ueber die
 * Provider-Allowlist der Einbettung (§2.5). §3.15 begruendet die Kehrtwende:
 * ein Projektvideo gehoert zum Portfoliobeitrag und soll nicht den Umweg
 * ueber ein oeffentliches Konto bei einem fremden Anbieter erzwingen. Die
 * Grenze von 200 MB folgt einer Rechnung statt einer Schaetzung: 1080p in
 * H.264 bei rund 5 Mbit/s ergibt etwa 37 MB je Minute, 200 MB entsprechen
 * also gut fuenf Minuten und decken das typische Projekt- oder Demovideo ab.
 * Zugelassen sind nur MP4 und WebM, weil beide ohne Transkodierung in allen
 * Zielbrowsern abspielbar sind; transkodiert wird weiterhin nicht. Die
 * Einbettung ueber Provider bleibt als zweiter Weg bestehen (§2.5).
 */
public enum AllowedFileType {

	PNG("image/png", MaxBytes.IMAGE),
	JPEG("image/jpeg", MaxBytes.IMAGE),
	WEBP("image/webp", MaxBytes.IMAGE),
	MP3("audio/mpeg", MaxBytes.MEDIA),
	WAV("audio/wav", MaxBytes.MEDIA),
	OGG("audio/ogg", MaxBytes.MEDIA),
	PDF("application/pdf", MaxBytes.MEDIA),
	MP4("video/mp4", MaxBytes.VIDEO),
	WEBM("video/webm", MaxBytes.VIDEO);

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
	 * <p>MP4 traegt die ftyp-Box in den Bytes 4 bis 7; die Boxlaenge davor
	 * bleibt ungeprueft, weil sie kein Kennzeichen des Formats ist. WebM
	 * beginnt mit dem EBML-Kopf. Geprueft wird bei beiden die Signatur und
	 * nicht der DocType: dessen Auswertung verlangte das Lesen variabel
	 * langer EBML-Elemente und laege weit ueber der Prueftiefe aller anderen
	 * Typen. Eine Matroska-Datei mit demselben Kopf kaeme so zwar durch die
	 * zweite Stufe, traegt aber einen Content-Type, den die Allowlist nicht
	 * fuehrt, und scheitert bereits an der ersten (§3.15, Contract v53).
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
			case MP4 -> matchesAt(head, 4, 'f', 't', 'y', 'p');
			case WEBM -> matchesAt(head, 0, 0x1A, 0x45, 0xDF, 0xA3);
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
	 * Die drei Limits aus §3.15, als eigene Klasse nur deshalb, weil Java
	 * in Enum-Konstruktoraufrufen keine eigenen statischen Felder des Enums
	 * zulaesst.
	 */
	private static final class MaxBytes {

		private static final long IMAGE = 10L * 1024 * 1024;

		private static final long MEDIA = 25L * 1024 * 1024;

		private static final long VIDEO = 200L * 1024 * 1024;

		private MaxBytes() {
		}
	}
}
