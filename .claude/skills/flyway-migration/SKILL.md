---
name: flyway-migration
description: Regeln für Flyway-Migrationen im E-Portfolio-Backend (PostgreSQL 16, ddl-auto validate). Immer verwenden, bevor eine Schemaänderung, neue Tabelle oder neue Spalte entsteht.
---

# Flyway-Migration schreiben

Ort: `backend/src/main/resources/db/migration/`. Das Schema kommt
ausschließlich von Flyway; Hibernate validiert nur (`ddl-auto: validate`).

## Eiserne Regeln

1. **Eingespielte Migrationen werden nie geändert**, auch nicht bei
   Tippfehlern. Korrektur heißt neue Migration.
2. Dateiname: `V<JJJJMMTTHHMM>__<beschreibung>.sql`; der Zeitstempel ist der
   tatsächliche Erstellzeitpunkt (minutengenau, keine Kollision mit
   bestehenden Versionen; aktueller Stand siehe `docs/ARCHITEKTUR.md` §4).
3. **Constraints benennen** (`ck_…`, `uq_…`, `fk_…`), damit spätere Änderungen
   ein gezieltes `DROP`/`ADD` sind (Vorbild `ck_block_typ`).
4. Spalten müssen **exakt** zu den Entity-Feldern passen (Typ, Nullability,
   Defaults), sonst scheitert `validate` beim Start. Vor dem Schreiben die
   Basisklassen ansehen: `BaseEntity` bringt nur `id` (uuid); erbt die Entity
   `AuditableEntity`, braucht die Tabelle `erstellt_am` und `aktualisiert_am`
   (`timestamptz not null`). Stammdaten-Tabellen haben bewusst keine.
5. Enum-Spalten als `varchar` mit Check-Constraint über die Werte, nicht als
   Postgres-Enum.
6. Fremdschlüssel immer indizieren, außer ein Unique-Constraint mit dieser
   Spalte als führender Spalte existiert bereits (dann wäre der Index
   redundant, siehe `block`).
7. `ON DELETE CASCADE` nur, wenn der Contract es verlangt (z. B. `block`,
   `datei` am Projekt); sonst bewusst weglassen und Löschverhalten im Service
   regeln.
8. Defaults, die nur der Befüllung dienen (wie bei `block.schema_version`),
   nach dem Backfill wieder entfernen, damit JPA die Werte schreibt
   (Vorbild `V202607221800`).

## Ablauf

1. Bestehende Migrationen und Entity ansehen; Versionstempel wählen.
2. SQL schreiben, mit Kommentarkopf: Ticket-Key + Zweck in einem Satz.
3. `docker compose up -d`, dann `./mvnw test`; der Start beweist Migration
   **und** `validate`.
4. Bei ALTER auf bestehende Tabellen prüfen, ob Seed-/Testdaten noch gültig
   sind.

## Definition of Done

- [ ] Neue Datei, keine bestehende berührt
- [ ] Constraints benannt, FKs indiziert
- [ ] App startet, `validate` grün, alle Tests grün
- [ ] `docs/ARCHITEKTUR.md` §4 (Migrationstabelle) um eine Zeile ergänzt
- [ ] SQL-Kommentare ohne Em-Dash `—`
- [ ] Migration im Übergabeblock benannt (Skill `uebergabe`), nicht selbst
      committen
