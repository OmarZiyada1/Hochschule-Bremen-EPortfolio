package de.hsbremen.eportfolio.sitecontent;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf die gepflegten Startseitentexte (§3.21).
 *
 * <p>Ohne sortierende Methode neben dem geerbten {@code findAll}: die
 * Reihenfolge der Antwort ist die Deklarationsreihenfolge von
 * {@link SiteContentKey} und damit die Reihenfolge der Abschnitte auf der Seite.
 * Aus der Spalte {@code content_key} liesse sich das nicht ableiten, dort steht
 * der Konstantenname und {@code HOME_CTA_LABEL} kaeme alphabetisch vor
 * {@code HOME_HERO_LABEL}. Sortiert wird deshalb im Dienst, ueber das Enum.
 */
public interface SiteContentRepository extends JpaRepository<SiteContent, UUID> {

	// Ohne Punktzugriff je Stelle und Sprache: der Dienst laedt den Bestand in
	// einem Zug und schluesselt ihn selbst auf. Die Tabelle hat hoechstens
	// dreissig Zeilen, und beide Pfade brauchen ohnehin mehr als eine davon;
	// eine abgeleitete Abfrage daneben waere ein zweiter Zugriffsweg, den
	// niemand benutzt.
}
