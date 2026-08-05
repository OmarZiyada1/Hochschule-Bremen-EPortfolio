# Contract-Nachtrag v19 nach v20 (KAN-50)

Vorlage zum Einfügen in die Confluence-Seite „Datenmodell & API-Contract"
(Space BEH, Seiten-ID `36732929`). Vier Stellen, jede einzeln beschrieben:
zuerst der Text, der ersetzt wird, danach der neue Text.

**Versionskommentar beim Speichern:**

```text
v20: Objektspeicher auf Azure Blob Storage, Fail-Fast praezisiert (KAN-50)
```

Diese Datei ist Arbeitsmaterial und kann nach dem Veröffentlichen gelöscht
werden. Die Änderung selbst gehört in Confluence, nicht ins Repository.

**Warum überhaupt:** Der Contract legte in §3.15.1 und §6.8 einen
S3-kompatiblen Objektspeicher fest und begründete ausdrücklich, warum ein
einziger S3-Adapter für vier Anbieter reicht. Die Betriebsumgebung ist jetzt
Azure. Azure Blob Storage spricht ein anderes Protokoll, ist also ein eigener
Adapter mit eigenen Konfigurationswerten; die S3-Begründung trägt nicht mehr.
Fachlich ändert sich nichts: Sichtbarkeit, anbieterneutraler Schlüssel und die
Auslieferung ausschließlich über `GET /api/files/{id}` bleiben, wie sie waren.

---

## Stelle 1: §3.15.1, erster Absatz

### Alt

> Die Bytes liegen **nicht auf dem Anwendungsserver**, sondern in einem
> S3-kompatiblen Objektspeicher (Hetzner Object Storage, MinIO, AWS S3,
> Scaleway). Der Zugriff läuft über den Port `FileStorage` (§6.8); die
> Anwendung kennt keinen Anbieter, sondern nur dieses Interface.

### Neu

> Die Bytes liegen **nicht auf dem Anwendungsserver**, sondern in einem
> Objektspeicher, seit v20 Azure Blob Storage. Der Zugriff läuft über den Port
> `FileStorage` (§6.8); die Anwendung kennt keinen Anbieter, sondern nur dieses
> Interface.

---

## Stelle 2: §3.15.1, Absatz „Form des Schlüssels"

Nur ein Wort: `Bucketname` wird `Containername`, weil der Begriff bei Azure so
heißt. Der Satz behält seine Aussage.

### Alt

> **Form des Schlüssels in** `path`: `projects/{projectId}/{uuid}`
> beziehungsweise `avatars/{uuid}`. Weder Bucketname noch Endpoint noch ein
> Verzeichnis stehen darin.

### Neu

> **Form des Schlüssels in** `path`: `projects/{projectId}/{uuid}`
> beziehungsweise `avatars/{uuid}`. Weder Containername noch Endpoint noch ein
> Verzeichnis stehen darin.

---

## Stelle 3: §3.15.1, Absatz „Warum nicht direkt aus dem Bucket"

Nur die Überschrift des Hinweiskastens und ein Wort im Text.

### Alt

> **Warum nicht direkt aus dem Bucket.** Die Sichtbarkeit einer Datei hängt am
> Status ihres Projekts: […]

Und im Absatz darüber:

> **Auslieferung ausschließlich über** `GET /api/files/{id}`. Der Bucket ist
> privat, es gibt keine öffentliche Bucket-Policy und keine Objekt-URL im
> Frontend.

### Neu

> **Warum nicht direkt aus dem Container.** Die Sichtbarkeit einer Datei hängt
> am Status ihres Projekts: […]

Und darüber:

> **Auslieferung ausschließlich über** `GET /api/files/{id}`. Der Container ist
> privat, es gibt keinen öffentlichen Zugriff auf Blob-Ebene und keine
> Objekt-URL im Frontend.

Der Rest des Absatzes bleibt Wort für Wort stehen, einschließlich des
Hinweises auf kurzlebige signierte URLs als Ausblick.

---

## Stelle 4: §6.8, Tabelle „Adapter" und die zwei Absätze danach

### Alt

| Property | Wert | Adapter | Verwendung |
| --- | --- | --- | --- |
| `app.storage.provider` | `local` | `LocalFileStorage` | Entwicklung, kein Fremddienst nötig |
| `app.storage.provider` | `s3` | `S3FileStorage` | Betrieb; funktioniert gegen Hetzner Object Storage, MinIO, AWS S3, Scaleway |
| `app.mail.provider` | `log` | `LogMailSender` | Entwicklung, der Code steht in der Serverkonsole |
| `app.mail.provider` | `smtp` | `SmtpMailSender` | Betrieb; funktioniert gegen jedes SMTP-Relay, etwa Gmail oder das Rechenzentrum der HSB |

> **Warum ein einziger S3-Adapter für vier Anbieter reicht.** Sie sprechen
> dasselbe Protokoll und unterscheiden sich in Endpoint, Region, Bucket und
> Schlüsselpaar. Genau diese vier Werte kommen aus der Umgebung. Der Endpoint
> muss deshalb konfigurierbar sein und darf nicht aus der Region abgeleitet
> werden, wie es die Standardeinstellung des AWS-SDK täte.

### Neu

| Property | Wert | Adapter | Verwendung |
| --- | --- | --- | --- |
| `app.storage.provider` | `local` | `LocalFileStorage` | Entwicklung, kein Fremddienst nötig |
| `app.storage.provider` | `azure` | `AzureBlobFileStorage` | Betrieb; Azure Blob Storage |
| `app.mail.provider` | `log` | `LogMailSender` | Entwicklung, der Code steht in der Serverkonsole |
| `app.mail.provider` | `smtp` | `SmtpMailSender` | Betrieb; funktioniert gegen jedes SMTP-Relay, etwa Azure Communication Services oder das Rechenzentrum der HSB |

> **Warum Azure und nicht ein S3-kompatibler Speicher.** Bis v19 stand hier ein
> S3-Adapter mit der Begründung, dass Hetzner, MinIO, AWS und Scaleway dasselbe
> Protokoll sprechen und sich nur in Endpoint, Region, Bucket und Schlüsselpaar
> unterscheiden. Das stimmt weiterhin, ist aber gegenstandslos geworden: die
> Betriebsumgebung dieser Arbeit ist Azure, und Azure Blob Storage spricht
> dieses Protokoll nicht. Ein Adapter für einen nicht genutzten Anbieter wäre
> Code, der nie gegen einen echten Speicher läuft und trotzdem gepflegt werden
> müsste. Der Port bleibt unverändert, ein späterer Wechsel zurück ist eine
> zusätzliche Adapterklasse und keine Änderung am Fachcode: genau dafür gibt es
> ihn.

> **Warum eine Verbindungszeichenfolge und keine Einzelwerte.** Azure fasst
> Endpoint, Kontoname und Kontoschlüssel in einem Wert zusammen, und das
> Portal übernimmt diese Form unverändert. Ein Geheimnis in der Umgebung statt
> vier Werte, die einzeln falsch sein können. Die Folge für den Betrieb: dieser
> eine Wert ist der Zugang zum gesamten Speicherkonto und darf weder in einer
> Response noch im Log erscheinen. Das Startprotokoll löst deshalb nur den
> Kontonamen heraus.

---

## Stelle 5: §6.8, Aufzählung „Zugangsdaten und Profile"

### Alt (dritter und vierter Punkt)

> * Pflichtwerte sind über `@ConfigurationProperties` mit `@Validated`
>   gebunden. Fehlt einer, startet die Anwendung nicht. […]
> * Profil `dev`: `local` und `log`. Profil `prod`: `s3` und `smtp`.

### Neu

> * Pflichtwerte sind über `@ConfigurationProperties` mit `@Validated`
>   gebunden. Fehlt einer, startet die Anwendung nicht. Das ist dieselbe
>   Fail-Fast-Regel wie beim JWT-Secret (§6.5): eine Anwendung, die mit halber
>   Konfiguration hochkommt und erst beim ersten Upload scheitert, verschiebt
>   den Fehler an die teuerste Stelle.
> * Profil `dev`: `local` und `log`. Profil `prod`: `azure` und `smtp`.

Und als neuer Hinweiskasten direkt darunter:

> **Ein Platzhalter ohne Default ist für sich genommen kein Fail-Fast.** Beim
> Umsetzen von KAN-50 hat sich gezeigt, dass die Regel darüber allein nicht
> trägt: Springs `Binder` löst Platzhalter mit
> `ignoreUnresolvablePlaceholders = true` auf. Fehlt die Umgebungsvariable,
> scheitert die Bindung nicht, sondern der Wert wird zur Zeichenfolge
> `${AZURE_STORAGE_CONTAINER}`. Ein `@NotBlank` greift dann nicht, weil die
> Zeichenfolge nicht leer ist, und die Anwendung läuft gegen einen Container,
> der so heißt wie der Platzhalter. Zur Zusage „startet nicht" gehört deshalb,
> dass der nicht aufgelöste Platzhalter ausdrücklich als fehlender Wert zählt.

---

## Stelle 6: §6.8, neue Tabelle am Ende des Abschnitts

Direkt vor dem Absatz „Die Domainlisten der Registrierung" einfügen. Sie fehlte
bisher ganz; ohne sie ist aus dem Contract nicht ersichtlich, welche Werte eine
Betriebsumgebung überhaupt setzen muss.

> **Konfigurationswerte je Port** (Umgebungsvariable in Klammern, alle ohne
> Default im Profil `prod`):

| Port | Schlüssel | Geheimnis | Bedeutung |
| --- | --- | --- | --- |
| `FileStorage` | `app.storage.provider` | nein | `local` oder `azure` |
| `FileStorage` | `app.storage.container` (`AZURE_STORAGE_CONTAINER`) | nein | Name des Blob-Containers |
| `FileStorage` | `app.storage.connection-string` (`AZURE_STORAGE_CONNECTION_STRING`) | **ja** | Endpoint, Kontoname und Kontoschlüssel in einem Wert |
| `FileStorage` | `app.storage.local-directory` | nein | Ablageort des Local-Adapters, nur im Profil `dev` |
| `MailSender` | `app.mail.provider` | nein | `log` oder `smtp` |
| `MailSender` | `app.mail.from-address` (`MAIL_FROM_ADDRESS`) | nein | Absender der Verifizierungs- und Rücksetzmails (§3.1.1) |
| `MailSender` | `app.mail.from-name` | nein | Anzeigename des Absenders |
| `MailSender` | `app.mail.base-url` (`APP_BASE_URL`) | nein | Basis der Links in diesen Mails, also die öffentliche Adresse des Frontends |

> Host, Port und Zugangsdaten des SMTP-Relays stehen unter `spring.mail.*` und
> gehören zum Adapter aus KAN-51, nicht zu diesem Abschnitt.

---

## Stelle 7: §8 Umsetzungsstand

In „Erledigt" am Ende ergänzen:

> · Konfiguration und Provider-Abstraktion (§6.8) in KAN-50

Und in „Geplant, in dieser Reihenfolge" den ersten Eintrag streichen:

> ~~Konfiguration und Provider-Abstraktion, §6.8 (KAN-50) ·~~

Der Absatz „**KAN-50 und KAN-51 stehen vorn**" bleibt stehen: er begründet die
Reihenfolge und beschreibt damit weiterhin richtig, warum KAN-50 zuerst kam.

---

## Stelle 8: §10 Änderungshistorie, neue Zeile am Ende der Tabelle

| Version | Betrifft | Änderung und Grund |
| --- | --- | --- |
| v20 | §3.15.1, §6.8, §8 | **Objektspeicher auf Azure Blob Storage umgestellt (KAN-50).** Der Contract legte einen S3-kompatiblen Speicher fest und begründete, warum ein Adapter für Hetzner, MinIO, AWS und Scaleway zugleich reicht. Die Betriebsumgebung dieser Arbeit ist Azure, und Azure Blob Storage spricht dieses Protokoll nicht; der S3-Adapter wäre Code, der nie gegen einen echten Speicher läuft. Ersetzt statt ergänzt, weil zwei Betriebsadapter zwei Wartungspfade sind, von denen einer ungetestet bliebe. Fachlich ändert sich nichts: Sichtbarkeit am Projektstatus, anbieterneutraler Schlüssel und Auslieferung ausschließlich über `GET /api/files/{id}` gelten unverändert; `Bucket` heißt jetzt `Container`. Der Mailversand bleibt bei `log` und `smtp`, weil Azure Communication Services ein SMTP-Relay anbietet und ein eigener Adapter nichts hinzufügen würde. Zusätzlich zwei Lücken geschlossen: §6.8 nennt jetzt die Konfigurationswerte je Port, die bisher gar nicht im Contract standen, und präzisiert die Fail-Fast-Zusage. Letzteres, weil sich beim Umsetzen zeigte, dass ein Platzhalter ohne Default allein nicht trägt: Springs `Binder` lässt eine fehlende Umgebungsvariable als Zeichenfolge `${…}` stehen, statt zu scheitern, und `@NotBlank` sieht das nicht. In §8 KAN-50 von „geplant" nach „erledigt" verschoben. |
