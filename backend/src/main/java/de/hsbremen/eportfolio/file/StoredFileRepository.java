package de.hsbremen.eportfolio.file;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Zugriff auf die Tabelle {@code stored_file} (API-Contract §3.15).
 */
public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {
}
