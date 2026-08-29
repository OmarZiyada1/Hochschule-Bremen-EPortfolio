-- Die Texte der oeffentlichen Startseite werden pflegbar: bis hierher standen
-- sie fest in den Sprachdateien des Frontends, und jede Wortaenderung war ein
-- Deployment (§3.21, §6.1).

-- Eine Zeile je Schluessel und Sprache, bewusst kein Spaltenpaar
-- value_de/value_en und kein jsonb. Erstens braucht eine dritte Sprache damit
-- keine neue Spalte und keinen Umbau des Bestands, sondern nur einen weiteren
-- zulaessigen Wert in ck_site_content_locale. Zweitens faellt der Rueckfall auf
-- die Sprachdatei des Frontends damit je Schluessel und je Sprache: wer nur den
-- deutschen Text pflegt, bekommt in der englischen Ansicht die englische
-- Vorgabe und nicht deutschen Text (WCAG 2.2 SC 3.1.2, §2.5).
create table site_content (
    id          uuid        primary key,
    -- Der Konstantenname des Java-Enums, nicht der i18n-Schluessel. So wie
    -- jedes andere als Zeichenkette gespeicherte Enum im Schema, und der
    -- Check-Constraint darunter zaehlt genau diese Namen auf. Die Zuordnung
    -- zum i18n-Schluessel steht genau einmal, naemlich in SiteContentKey.
    content_key varchar(64) not null,
    -- Die Sprachkennung nach BCP 47 und damit kleingeschrieben. Genau in
    -- dieser Form geht sie in die i18n-Schicht des Frontends; ein Java-Enum
    -- schriebe hier DE und EN und braeuchte eine zweite Uebersetzung.
    locale      varchar(8)  not null,
    value       text        not null
);

-- Die pflegbaren Stellen aus §3.21. Ohne diesen Constraint liesse ein
-- fehlerhafter Schreibweg einen unbekannten Schluessel stehen, unter dem die
-- Startseite nie nachsieht, und niemand bemerkte es.
-- Bewusst nicht dabei sind home.top10.viewProject, home.top10.freeSlot und
-- home.top10.freeBadge: das sind Komponentenbeschriftungen, die auch
-- ausserhalb der Startseite auftreten, etwa in der Top-10-Verwaltung.
alter table site_content
    add constraint ck_site_content_key
        check (content_key in ('HOME_HERO_LABEL', 'HOME_HERO_TITLE_LINE1',
                               'HOME_HERO_TITLE_LINE2', 'HOME_HERO_SUBTITLE',
                               'HOME_HERO_EXPLORE_TOP10', 'HOME_TOP10_LABEL',
                               'HOME_TOP10_TITLE', 'HOME_TOP10_DESCRIPTION',
                               'HOME_CTA_LABEL', 'HOME_CTA_TITLE',
                               'HOME_CTA_DESCRIPTION', 'HOME_CTA_STAT_WORKS',
                               'HOME_CTA_STAT_FACULTIES', 'HOME_CTA_STAT_PROGRAMS',
                               'HOME_CTA_OPEN_LIBRARY'));

-- Die beiden Sprachen, die das Frontend heute pflegt. Eine dritte kostet genau
-- diesen Constraint und keine Datenaenderung.
alter table site_content
    add constraint ck_site_content_locale
        check (locale in ('de', 'en'));

-- Hoechstens eine Fassung je Stelle und Sprache. Ohne den Constraint koennten
-- zwei Zeilen zu derselben Stelle stehen, und welche die Startseite zeigte,
-- haengt an der Lesereihenfolge.
alter table site_content
    add constraint uq_site_content_key_locale unique (content_key, locale);

-- Keine Seed-Daten und keine Uebernahme aus den Sprachdateien des Frontends.
-- Die leere Tabelle ist der richtige Anfangszustand: ein fehlender Eintrag
-- heisst "hier gilt die mitgelieferte Fassung". Ein Backfill haette diese
-- Aussage beim ersten Start unwiderruflich in "die Administration hat genau
-- diesen Text gewaehlt" verwandelt.
