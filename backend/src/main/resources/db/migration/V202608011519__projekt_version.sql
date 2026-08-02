-- KAN-15: Optimistic Locking am Projekt (API-Contract §3.3 und §6.4).
-- Bewusst vor den schreibenden Projekt-Endpoints (KAN-17/KAN-18), weil sonst
-- beim Autosave des Editors Last-Write-Wins gilt und zwei Projektmitglieder
-- einander unbemerkt ueberschreiben.

-- Der Default 0 steht so im Migrationshinweis aus §3.3 und bleibt dauerhaft
-- stehen (anders als bei block.schema_version in V202607221800, wo er nur dem
-- Befuellen diente): Hibernate schreibt die Spalte zwar bei jedem Insert selbst
-- mit, doch der Default haelt Bestandszeilen und Einfuegungen aus reinem SQL
-- (Seeds, manuelle Korrekturen) auf einem gueltigen Startwert. Ohne ihn
-- schluege ein solches Insert an der not-null-Bedingung fehl.
alter table projekt
    add column version bigint not null default 0;
