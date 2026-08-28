-- KAN-85: Die Anwendung bekommt einen Rueckkanal (API-Contract v87, §3.20).
-- Bis dahin gab es keinen Weg, ein Problem zu melden, und der haeufigste
-- Support-Fall ist "ich komme nicht hinein": ein Formular hinter der Anmeldung
-- hilft genau dort nicht. Die Zeile entsteht deshalb ueber POST /api/support,
-- den einzigen schreibenden Endpoint, den §5 fuer PUBLIC freigibt.

create table support_request (
    id                   uuid         primary key,
    name                 varchar(120) not null,
    email                varchar(255) not null,
    category             varchar(32)  not null,
    subject              varchar(160) not null,
    message              text         not null,
    -- Der Standardwert steht in der Datenbank und nicht nur im Java-Code: die
    -- Zeile entsteht immer als OPEN (§2.15), und ein zweiter Ort fuer denselben
    -- Anfangswert liefe beim naechsten Schreibweg auseinander.
    status               varchar(16)  not null default 'OPEN',
    -- Bewusst nullable und bewusst "on delete set null". Der wichtigste Fall
    -- des Formulars ist die Person, die sich gerade nicht anmelden kann, also
    -- steht hier oft nichts. Eine Kaskade waere daneben falsch: die Anfrage
    -- gehoert der Administration und nicht dem Konto, sie darf mit einer
    -- geloeschten Person nicht verschwinden.
    submitted_by_user_id uuid         references app_user (id) on delete set null,
    created_at           timestamptz  not null,
    updated_at           timestamptz  not null
);

-- Die beiden Enums aus §2.14 und §2.15 als Check-Constraint, wie bei jedem
-- anderen als Zeichenkette gespeicherten Enum im Schema. Ohne sie liesse ein
-- fehlerhafter Schreibweg einen unbekannten Wert stehen, den das Lesen erst
-- beim Umwandeln bemerkt, also lange nach der Ursache.
alter table support_request
    add constraint ck_support_request_category
        check (category in ('TECHNICAL_ISSUE', 'ACCOUNT_ACCESS', 'PROJECT_SUBMISSION',
                            'ABUSE_REPORT', 'OTHER'));

alter table support_request
    add constraint ck_support_request_status
        check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED'));

-- Die Liste der Administration liest genau so: gefiltert nach status, sortiert
-- nach created_at absteigend (§6.6). Der Index deckt beide Zugriffe in einem,
-- und er traegt zugleich die Zaehlung "N offen", die nichts anderes ist als
-- dieselbe Abfrage mit size=1.
create index ix_support_request_status_created on support_request (status, created_at desc);

-- Die Gegenrichtung des Fremdschluessels (Regel 6 im Skill flyway-migration).
-- Ohne ihn muesste das Loeschen eines Kontos die ganze Tabelle lesen, um die
-- Zeilen zu finden, deren Verweis auf null zu setzen ist.
create index ix_support_request_submitted_by on support_request (submitted_by_user_id);
