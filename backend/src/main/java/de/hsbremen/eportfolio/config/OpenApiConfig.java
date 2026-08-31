package de.hsbremen.eportfolio.config;

import de.hsbremen.eportfolio.top10.dto.Top10AuditEntryResponse;
import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.lang.annotation.Annotation;
import java.util.ArrayList;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.customizers.PropertyCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

/**
 * Beschreibung der API fuer OpenAPI/Swagger-UI (KAN-11).
 *
 * <p>Alle Grundangaben stehen bewusst in dieser einen Bean statt verteilt in
 * {@code application.yml} und Controller-Annotationen: die Metadaten der API
 * gehoeren an eine Stelle, sonst weiss beim naechsten Contract-Stand niemand,
 * wo die Versionsnummer nachzuziehen ist.
 *
 * <p>Diese Klasse erzeugt <strong>keine</strong> Endpoint-Dokumentation.
 * Springdoc liest die Endpoints selbst aus den {@code @RestController}-Klassen
 * und den DTO-Typen; die Oberflaeche fuellt sich daher automatisch, sobald
 * weitere Controller entstehen. Hier steht nur, was springdoc nicht aus dem
 * Code ableiten kann.
 */
@Configuration
public class OpenApiConfig {

	/**
	 * Name des Sicherheitsschemas. Taucht in der Swagger-UI als Beschriftung im
	 * „Authorize"-Dialog auf.
	 */
	private static final String BEARER_SCHEMA = "bearerAuth";

	/**
	 * Elementtypen paginierter Antworten, die sonst in keinem Schema landen.
	 *
	 * <p>Aufgenommen wird ein Typ hier genau dann, wenn er ausschliesslich als
	 * {@code T} in {@code PageResponse<T>} vorkommt. Wer daneben einen eigenen
	 * Endpoint hat, ist ohnehin da: {@code AdminUserResponse} etwa steht schon
	 * wegen {@code GET /api/admin/users/{id}} unter {@code components}, und
	 * {@code ProjectCardResponse} wegen {@code GET /api/projects/{id}}.
	 *
	 * <p>Begruendung im Haken {@link #pagedElementSchemasCustomizer()}.
	 */
	private static final List<Class<?>> PAGED_ELEMENT_TYPES =
			List.of(Top10AuditEntryResponse.class);

	@Bean
	public OpenAPI eportfolioOpenApi() {
		SecurityScheme bearer = new SecurityScheme()
				.type(SecurityScheme.Type.HTTP)
				.scheme("bearer")
				.bearerFormat("JWT")
				.description("""
						Token aus POST /api/auth/login (Feld "token") hier \
						eintragen. Die UI setzt daraufhin bei jedem Aufruf den \
						Header "Authorization: Bearer <token>", so wie es der \
						JwtAuthenticationFilter erwartet. Das "Bearer "- \
						Praefix ergaenzt die UI selbst, es gehoert nicht ins \
						Eingabefeld.""");

		return new OpenAPI()
				.info(new Info()
						.title("E-Portfolio Hochschule Bremen: API")
						.version("v94")
						.description("""
								REST-API des E-Portfolio-Systems der Hochschule \
								Bremen (FK4). Stand entspricht dem API-Contract \
								v94, §6.

								Authentifizierung: JWT als Bearer-Token. Ohne \
								gueltiges Token antworten geschuetzte Pfade mit \
								401 im Fehler-Envelope aus §6.2 \
								(timestamp, status, errorCode, message, path). \
								Jede Fehlerantwort hat diese Form, auch ein \
								unerwarteter Serverfehler: 500 INTERNAL_ERROR \
								(§6.3).

								Diese Oberflaeche ist nur im Profil dev \
								erreichbar."""))
				.components(new Components().addSecuritySchemes(BEARER_SCHEMA, bearer))
				// Global statt pro Controller: jeder kuenftige Endpoint erbt das
				// Schema automatisch und niemand muss daran denken, es zu
				// annotieren. Das ist eine reine Doku-Angabe; welche Pfade
				// tatsaechlich ein Token verlangen, entscheidet allein die
				// SecurityFilterChain.
				.addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEMA));
	}

	/**
	 * Traegt die Elementtypen paginierter Antworten nach, die springdoc sonst
	 * verliert (KAN-40).
	 *
	 * <p>{@code PageResponse<T>} traegt {@code @Schema(name = "PageResponse")}
	 * und ist damit <strong>ein</strong> benanntes Schema fuer alle
	 * Verwendungen. swagger-core loest den generischen Parameter deshalb genau
	 * einmal auf und schreibt das Ergebnis fest: {@code content} steht im
	 * Dokument als {@code ProjectCardResponse[]}, gleichgueltig welcher
	 * Endpoint darauf verweist. Ein {@code T}, das nirgends sonst vorkommt,
	 * wird dabei nie zu einem Schema und fehlt unter {@code components}
	 * vollstaendig.
	 *
	 * <p>Genau das trifft {@code Top10AuditEntryResponse} (§3.17): das
	 * Protokoll ist unveraenderlich und hat deshalb weder einen schreibenden
	 * noch einen Einzelabruf, an dem der Typ ein zweites Mal auftauchte.
	 * {@code GET /api/admin/top10-audit} verwies damit auf eine Antwort, die
	 * es dort nicht gibt, und {@code frontend/src/api/schema.d.ts} kannte die
	 * Protokollzeile gar nicht. Das Frontend haette den Typ von Hand
	 * nachbauen muessen, was Frontend-Regel 2 gerade verbietet.
	 *
	 * <p><strong>Warum nicht das {@code name} am PageResponse fallen
	 * lassen.</strong> Ohne den festen Namen erzeugte springdoc je Elementtyp
	 * ein eigenes Schema ({@code PageResponseProjectCardResponse} und so
	 * weiter). Das waere die genauere Dokumentation, benennt aber das heute
	 * verwendete Schema um und zieht {@code frontend/src/api/page.ts} samt
	 * jeder paginierten Ansicht nach. Der Nachtrag hier kostet dagegen keine
	 * einzige bestehende Zeile im Dokument.
	 *
	 * <p><strong>Nichts wird ueberschrieben.</strong> {@code readAll} liefert
	 * den Typ samt seiner Bestandteile, hier also auch {@code PersonResponse}
	 * und {@code ProjectReferenceResponse}. Eingesetzt wird nur, was noch
	 * fehlt: die bereits aufgebauten Schemas sind durch die Haken unten
	 * gelaufen und duerfen nicht durch eine rohe Fassung ersetzt werden.
	 *
	 * <p><strong>Die Reihenfolge ist kein Zufall.</strong> Der Haken laeuft
	 * ueber {@link Order} als erster, damit die drei Nachbearbeitungen unten
	 * die nachgetragenen Schemas genauso behandeln wie alle anderen:
	 * {@code nullable} vom Typ nehmen (KAN-74) und die Eigenschaften als
	 * Pflicht auszeichnen (KAN-76). Liefe er zuletzt, stuende die
	 * Protokollzeile als einziges Schema ohne {@code required} da.
	 */
	@Bean
	@Order(Ordered.HIGHEST_PRECEDENCE)
	public OpenApiCustomizer pagedElementSchemasCustomizer() {
		return openApi -> {
			Components components = openApi.getComponents();
			if (components == null || components.getSchemas() == null) {
				return;
			}
			for (Class<?> type : PAGED_ELEMENT_TYPES) {
				ModelConverters.getInstance().readAll(type)
						.forEach(components.getSchemas()::putIfAbsent);
			}
		};
	}

	/**
	 * Haelt {@code @Schema(nullable = true)} an Feldern fest, deren Typ ein
	 * eigenes Schema ist (KAN-74).
	 *
	 * <p>In OpenAPI 3.0 darf neben einem {@code $ref} kein weiteres
	 * Schluesselwort stehen: ein Leser muesste sonst entscheiden, ob
	 * {@code nullable} zum Verweis oder zum verwiesenen Schema gehoert.
	 * swagger-core loest das, indem es die Eigenschaft auf den blossen
	 * {@code $ref} eindampft und Beschreibung wie {@code nullable}
	 * <strong>ersatzlos verwirft</strong>, ohne Warnung. Betroffen sind genau
	 * die Bezuege am Projekt, die nach §3.3 im {@code DRAFT} noch nicht
	 * gesetzt sind: {@code category}, {@code faculty}, {@code studyProgram},
	 * {@code module} und {@code semester} an Karte wie Detail, dazu
	 * {@code Top10NominationResponse.decidedBy} (§3.11). Zehn Felder, deren
	 * Nullbarkeit ohne diesen Haken in {@code frontend/src/api/schema.d.ts}
	 * nicht ankommt, waehrend die uebrigen 44 Angaben durchlaufen.
	 *
	 * <p>Der vorgesehene Ausweg von 3.0 ist die Huelle
	 * {@code allOf: [ { $ref } ]}: der Verweis steht dann als einziger Eintrag
	 * in einer Zusammensetzung, und {@code nullable} daneben bezieht sich
	 * eindeutig auf die Eigenschaft. Die Beschreibung wird gleich mit
	 * gerettet, sie faellt demselben Eindampfen zum Opfer.
	 *
	 * <p>Angesetzt wird an der Eigenschaft und nicht am fertigen Dokument:
	 * nach dem Aufbau ist die Annotation nicht mehr zu sehen, ein
	 * {@code OpenApiCustomizer} muesste die Nullbarkeit also raten. Der
	 * {@link PropertyCustomizer} bekommt mit dem {@link AnnotatedType} die
	 * Annotationen der Record-Komponente selbst gereicht und liest sie
	 * einfach ab.
	 *
	 * <p>Gilt nur fuer 3.0. Stellt jemand {@code springdoc.api-docs.version}
	 * zurueck auf 3.1, ist die Huelle unnoetig, aber nicht falsch: dort ist
	 * {@code allOf} neben Geschwisterfeldern ohnehin erlaubt.
	 */
	@Bean
	public PropertyCustomizer nullableReferencePropertyCustomizer() {
		return (property, type) -> {
			io.swagger.v3.oas.annotations.media.Schema annotation = schemaAnnotationOf(type);
			if (property == null || annotation == null || !annotation.nullable()) {
				return property;
			}

			// Listenfelder wie ProjectDetailResponse.statusHistory oder
			// ProjectUpdateRequest.tags. Ihr nullable gehoert an die Liste und
			// steht dort auch schon: eine Liste wird nicht zum blossen $ref
			// eingedampft, das passiert nur ihren Eintraegen.
			//
			// Der Eintragstyp wird jedoch mit denselben Annotationen
			// aufgeloest, und swagger-core reicht die Angabe damit an beide
			// weiter. Hier wird sie vom Eintrag wieder genommen, in beiden
			// Auspraegungen: die Huelle, die der Zweig unten kurz zuvor um
			// einen $ref gelegt hat, und das nullable, das swagger-core einem
			// einfachen Eintragstyp wie String selbst angehaengt hat.
			//
			// Die Regel gilt im ganzen Projekt: eine Liste als Ganzes kann
			// null sein, ein Eintrag darin nie. Weder §3.3 (tags, editors)
			// noch §3.4 (blocks) noch §3.12 (statusHistory) kennen einen
			// Listeneintrag ohne Wert.
			Schema<?> items = property.getItems();
			if (items != null) {
				String wrapped = wrappedRefOf(items);
				if (wrapped != null) {
					property.setItems(new Schema<>().$ref(wrapped));
				} else {
					items.setNullable(null);
				}
				return property;
			}

			if (property.get$ref() == null) {
				return property;
			}

			Schema<?> wrapper = new Schema<>()
					.addAllOfItem(new Schema<>().$ref(property.get$ref()))
					.nullable(true);

			// Beschreibung aus der Annotation und nicht aus property: dort ist
			// sie beim Eindampfen schon verloren gegangen.
			if (!annotation.description().isBlank()) {
				wrapper.setDescription(annotation.description());
			}

			return wrapper;
		};
	}

	/**
	 * Nimmt {@code nullable} von den benannten Schemas unter
	 * {@code components.schemas} (KAN-74).
	 *
	 * <p>Ein benanntes Schema ist ein <em>Typ</em>. Ob eine bestimmte
	 * <em>Verwendung</em> dieses Typs null sein darf, entscheidet die Stelle,
	 * an der er verwendet wird, und niemals er selbst: {@code PersonResponse}
	 * ist als Autor:in eines Projekts immer da (§3.3) und als
	 * {@code decidedBy} einer Nominierung null, solange nicht entschieden ist
	 * (§3.11). Steht die Angabe am Typ, gilt sie fuer beide.
	 *
	 * <p>Genau das passiert ohne diesen Haken. swagger-core loest den Typ das
	 * erste Mal an einer Stelle auf, die {@code @Schema(nullable = true)}
	 * traegt, und heftet die Angabe an das Modell, das es unter
	 * {@code components} ablegt. Betroffen sind vier Schemas
	 * ({@code PersonResponse}, {@code ReferenceResponse},
	 * {@code StatusHistoryResponse}, {@code MemberRequest}), und die Folge ist
	 * grob: {@code openapi-typescript} erzeugt daraus einen Typ, der ueberall
	 * null sein kann, also auch als Eintrag einer Liste. Der Typecheck
	 * verlangt dann eine Pruefung an jeder Stelle, an der ein Autor:innenname
	 * gelesen wird, obwohl der Server dort nie null sendet.
	 *
	 * <p>Im Dokument nach 3.1 fiel das nicht auf, weil dort ohnehin jedes
	 * {@code nullable} verworfen wurde. Sichtbar wird es erst, seit
	 * {@code springdoc.api-docs.version} auf 3.0 steht.
	 */
	@Bean
	public OpenApiCustomizer schemaLevelNullableCustomizer() {
		return openApi -> {
			if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
				return;
			}
			openApi.getComponents().getSchemas().values()
					.forEach(schema -> schema.setNullable(null));
		};
	}

	/**
	 * Traegt an jedem Antwortschema ein, dass seine Eigenschaften immer kommen
	 * (KAN-76).
	 *
	 * <p>Ohne diese Angabe erzeugt {@code openapi-typescript} jede Eigenschaft
	 * optional, auch {@code id}, {@code title} und {@code status}. Der Typ sagt
	 * dann nichts mehr zu: {@code title} ist {@code string | undefined}, obwohl
	 * der Server ihn bei jedem Projekt sendet, und im Frontend entstehen
	 * Pruefungen wie {@code data.title ?? ""} fuer einen Fall, den es fachlich
	 * nicht gibt. Wer sich an solche Pruefungen gewoehnt, uebersieht spaeter die
	 * eine, die zaehlt.
	 *
	 * <p><strong>Pflicht ist jede Eigenschaft, auch die nullbare.</strong>
	 * {@code required} und {@code nullable} beantworten zwei verschiedene
	 * Fragen: „steht der Schluessel im JSON" und „darf sein Wert null sein".
	 * Hier wird nur die erste beantwortet, und die Antwort ist ueberall
	 * dieselbe, weil Jackson bei {@code Include.ALWAYS} bleibt und kein Feld
	 * weglaesst. Was im Record steht, steht in der Antwort, notfalls mit dem
	 * Wert null.
	 *
	 * <p>Im erzeugten Typ ist der Unterschied genau der, den das Frontend
	 * braucht: aus {@code statusHistory?: T[] | null} wird
	 * {@code statusHistory: T[] | null}. Null muss weiterhin behandelt werden,
	 * ein fehlender Schluessel kann nicht mehr vorkommen. Die Zusage faellt,
	 * sobald ein DTO {@code @JsonInclude(NON_NULL)} bekommt; heute setzt das
	 * nirgends jemand.
	 *
	 * <p><strong>Nur Antworten.</strong> An einem {@code …Request} waere dieselbe
	 * Rechnung falsch. Dort entscheidet nicht Jackson, sondern der Aufrufer, ob
	 * ein Feld mitkommt, und was Pflicht ist, steht bereits da: Bean Validation
	 * speist es aus {@code @NotNull} und Verwandten. Ein Ueberschreiben machte
	 * jedes freiwillige Eingabefeld zum Pflichtfeld.
	 *
	 * <p>Voraussetzung sind die beiden Haken darueber (KAN-74): sie sorgen
	 * dafuer, dass {@code nullable} an der Eigenschaft steht und nicht am
	 * gemeinsamen Modell unter {@code components}. Auf die Reihenfolge der Beans
	 * kommt es nicht an, weil dieser Haken {@code nullable} gar nicht liest.
	 */
	@Bean
	public OpenApiCustomizer requiredResponsePropertiesCustomizer() {
		return openApi -> {
			if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
				return;
			}
			openApi.getComponents().getSchemas().forEach((name, model) -> {
				// Ueber den Umweg Schema<?>, weil der rohe Typ aus der Map sonst
				// auch die Typargumente von getProperties() wegwirft.
				Schema<?> schema = model;
				if (!name.endsWith("Response") || schema.getProperties() == null) {
					return;
				}
				schema.setRequired(new ArrayList<>(schema.getProperties().keySet()));
			});
		};
	}

	/**
	 * Der Verweis aus einer von dieser Klasse gesetzten Huelle, oder
	 * {@code null}, wenn das Schema keine solche ist.
	 */
	private static String wrappedRefOf(Schema<?> schema) {
		if (!Boolean.TRUE.equals(schema.getNullable())
				|| schema.getAllOf() == null
				|| schema.getAllOf().size() != 1) {
			return null;
		}
		return ((Schema<?>) schema.getAllOf().get(0)).get$ref();
	}

	/**
	 * Die {@code @Schema}-Annotation der gerade aufgeloesten Eigenschaft, oder
	 * {@code null}, wenn sie keine traegt.
	 *
	 * <p>{@code getCtxAnnotations()} liefert die Annotationen der Stelle, an
	 * der der Typ verwendet wird, also der Record-Komponente, und nicht die des
	 * Typs selbst. Genau das wird hier gebraucht: {@code nullable} steht am
	 * Feld, nicht an {@code ReferenceResponse}.
	 */
	private static io.swagger.v3.oas.annotations.media.Schema schemaAnnotationOf(AnnotatedType type) {
		Annotation[] annotations = type == null ? null : type.getCtxAnnotations();
		if (annotations == null) {
			return null;
		}
		for (Annotation annotation : annotations) {
			if (annotation instanceof io.swagger.v3.oas.annotations.media.Schema schema) {
				return schema;
			}
		}
		return null;
	}
}
