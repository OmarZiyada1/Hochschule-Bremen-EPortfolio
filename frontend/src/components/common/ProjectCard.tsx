import { StatusBadge, type ProjectStatus } from "@/components/common/StatusBadge"
import { Tag } from "@/components/common/Tag"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Projektkachel der Listenansichten: Titel, Kurzbeschreibung, Status,
 * Fakultaet und Semester. Reine Darstellung, die Daten kommen ueber Props;
 * ob der Status ueberhaupt gezeigt wird, entscheidet die Seite anhand der
 * Rechtematrix (in oeffentlichen Listen ist alles PUBLISHED, dort bleibt
 * status weg).
 *
 * Das h3 im Titel setzt die Ebene unterhalb der Listenueberschrift voraus
 * (h1 Seite, h2 Abschnitt); Tailwinds Preflight laesst es die Schrift der
 * CardTitle erben, statt eine eigene Groesse mitzubringen.
 */
export function ProjectCard({
  title,
  summary,
  status,
  faculty,
  semester,
  href,
  className,
}: {
  title: string
  summary: string
  status?: ProjectStatus
  faculty: string
  semester: string
  href?: string
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h3>
            {href ? (
              <a href={href} className="hover:underline focus-visible:underline">
                {title}
              </a>
            ) : (
              title
            )}
          </h3>
        </CardTitle>
        {status && (
          <CardAction>
            <StatusBadge status={status} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <p className="line-clamp-3 text-muted-foreground">{summary}</p>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Tag>{faculty}</Tag>
        <Tag>{semester}</Tag>
      </CardFooter>
    </Card>
  )
}
