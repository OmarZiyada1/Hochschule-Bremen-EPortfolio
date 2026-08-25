import { useQuery } from "@tanstack/react-query"
import { ChevronDownIcon, MergeIcon, PencilIcon, TagsIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { masterDataQueries } from "@/api/queries/masterData"
import type { CategoryResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { SearchInput } from "@/components/common/SearchInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CATEGORY_GROUP_OTHER,
  filterCategories,
  groupCategories,
} from "@/features/administration/categoryGroups"
import { CategoryMergeDialog } from "@/features/administration/components/CategoryMergeDialog"
import { MasterDataRowMenu } from "@/features/administration/components/MasterDataRowMenu"
import {
  readMasterDataSearch,
  writeMasterDataSearch,
} from "@/features/administration/masterDataSearch"
import { NameCreateForm } from "@/features/administration/components/NameCreateForm"
import { NameEditDialog } from "@/features/administration/components/NameEditDialog"
import { CATEGORY_NAME_MAX } from "@/features/administration/components/masterDataName.schema"
import {
  useCreateCategory,
  useDeleteCategory,
  useMergeCategories,
  useUpdateCategory,
} from "@/features/administration/hooks/useMasterDataAdmin"

/**
 * Die Kategorienpflege der Administrationsseite (Template „Kategorien",
 * Frame {@code Admin · Kategorien}, KAN-39): Suche, Anlegefeld,
 * alphabetische Baender und je Zeile Umbenennen, Zusammenfuehren, Loeschen.
 *
 * <p><strong>Ohne Spalte „Anzahl zugeordneter Projekte".</strong> Die
 * Template-Seite nennt sie, aber {@code CategoryResponse} fuehrt nur
 * {@code id} und {@code name} (§3.6), und kein Endpoint liefert eine
 * Projektzahl je Kategorie. Der Frame zeigt sie ebenfalls nicht. Eine Spalte
 * ohne Datenquelle waere eine Attrappe (Frontend-Regel 10); die
 * Confluence-Seite ist nachgezogen.
 *
 * <p><strong>Gelesen wird oeffentlich, geschrieben unter /admin.</strong>
 * {@code GET /api/categories} liefert die vollstaendige Liste ohne
 * Paginierung (§6.1); gefiltert wird deshalb im Client, der Endpoint kennt
 * keinen Suchparameter.
 *
 * <p><strong>Zwei Fehler tragen denselben Code.</strong> 409
 * RESOURCE_IN_USE meint beim Anlegen und Umbenennen den bereits vergebenen
 * Namen, beim Loeschen die noch referenzierte Zeile. Unterschieden wird nach
 * der ausgeloesten Aktion: der eine erscheint am Feld, der andere als
 * Meldung ueber der Liste.
 */
export default function AdminCategoryListPage() {
  const { t } = useTranslation()
  const categories = useQuery(masterDataQueries.categories())
  const create = useCreateCategory()
  const rename = useUpdateCategory()
  const remove = useDeleteCategory()
  const merge = useMergeCategories()

  /* Der Suchbegriff steht in der Adresse und nicht in useState: ein
     Ergebnis ist sonst weder teilbar noch uebersteht es den
     Zurueck-Knopf (Skill frontend-modul, Abschnitt 3). */
  const [searchParams, setSearchParams] = useSearchParams()
  const search = readMasterDataSearch(searchParams)
  const [renameFor, setRenameFor] = useState<CategoryResponse | null>(null)
  const [mergeFor, setMergeFor] = useState<CategoryResponse | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const dialogTrigger = useRef<HTMLElement | null>(null)

  const all = categories.data ?? []
  const groups = groupCategories(filterCategories(all, search))

  function messageOf(error: unknown): string {
    return isApiError(error)
      ? t(apiErrorMessageKey(error), { defaultValue: error.message })
      : t("apiError.INTERNAL_ERROR")
  }

  /**
   * Der 409 beim Loeschen meint etwas anderes als derselbe Code am Feld:
   * hier haengen noch Projekte an der Zeile (§6.1). Der allgemeine Text zu
   * RESOURCE_IN_USE liest sich wie „Name vergeben" und benennt genau das
   * nicht; die Aktion weiss es besser als der Code.
   */
  function deleteError(error: unknown, name: string): string {
    return isApiError(error) && error.errorCode === "RESOURCE_IN_USE"
      ? t("administration.categories.deleteBlocked", { name })
      : messageOf(error)
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline tracking-widest text-muted-foreground uppercase">
          {t("administration.label")}
        </p>
        <h1 className="type-title text-primary">
          {t("administration.categories.title")}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {categories.data === undefined
            ? t("administration.categories.subtitleLoading")
            : t("administration.categories.subtitle", { count: all.length })}
        </p>
        <hr className="mt-2" />
      </header>

      <Card>
        <CardContent className="grid items-start gap-4 lg:grid-cols-2">
          {/* Das Suchfeld entfaellt, solange nichts angelegt ist: es gaebe
              nichts zu durchsuchen, und der Frame zeigt es im Leerzustand
              ebenfalls nicht. */}
          {all.length > 0 && (
            <SearchInput
              label={t("administration.categories.search.label")}
              labelHidden
              placeholder={t("administration.categories.search.placeholder")}
              value={search}
              onValueChange={(value) =>
                setSearchParams(
                  (previous) => writeMasterDataSearch(previous, value),
                  { replace: true }
                )
              }
            />
          )}
          <NameCreateForm
            className={all.length > 0 ? undefined : "lg:col-span-2"}
            label={t("administration.categories.create.label")}
            placeholder={t("administration.categories.create.placeholder")}
            maxLength={CATEGORY_NAME_MAX}
            tooLongMessageKey="validation.masterData.categoryNameTooLong"
            submitLabel={t("administration.categories.create.submit")}
            pending={create.isPending}
            onSubmit={async (name) => {
              setRowError(null)
              await create.mutateAsync(name)
              setNotice(t("administration.categories.created", { name }))
            }}
          />
        </CardContent>
      </Card>

      {categories.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>{messageOf(categories.error)}</AlertTitle>
        </Alert>
      )}

      {rowError !== null && (
        <Alert variant="destructive">
          <AlertTitle>{rowError}</AlertTitle>
        </Alert>
      )}

      {categories.isPending && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
          </CardContent>
        </Card>
      )}

      {categories.data !== undefined && groups.length === 0 && (
        <EmptyState
          icon={<TagsIcon aria-hidden="true" />}
          title={
            all.length === 0
              ? t("administration.categories.empty.title")
              : t("administration.categories.empty.filteredTitle")
          }
          description={
            all.length === 0
              ? t("administration.categories.empty.description")
              : t("administration.categories.empty.filtered")
          }
        />
      )}

      {groups.map((group) => (
        <Collapsible key={group.id} defaultOpen>
          {/* py-0: das Band sitzt buendig am oberen Rand der Karte, wie im
              Frame. Die Vorgabe der Primitive setzt hier oben und unten je
              vier Einheiten Luft, und die Banderole stuende dann in einem
              Rahmen statt an ihm. */}
          <Card className="py-0">
            {/* Der Trigger liegt in der Ueberschrift und nicht daneben, sonst
                haette das Band keinen Sprungpunkt (APG-Muster Disclosure). */}
            <h2>
              <CollapsibleTrigger className="group/band flex w-full items-center justify-between gap-2 rounded-card bg-muted px-4 py-2.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className="type-label-xs text-muted-foreground uppercase">
                  {group.id === CATEGORY_GROUP_OTHER
                    ? t("administration.categories.group.other")
                    : t("administration.categories.group.range", {
                        from: group.from,
                        to: group.to,
                      })}{" "}
                  {t("administration.categories.group.count", {
                    count: group.categories.length,
                  })}
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-data-[panel-open]/band:rotate-180"
                />
              </CollapsibleTrigger>
            </h2>
            <CollapsibleContent>
              <ul className="flex flex-col">
                {group.categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-2 border-t px-4 py-2"
                  >
                    <span className="min-w-0 break-words">{category.name}</span>
                    <MasterDataRowMenu
                      name={category.name}
                      pending={remove.isPending}
                      deleteLabel={t("administration.masterData.delete")}
                      deleteTitle={t(
                        "administration.categories.deleteDialog.title"
                      )}
                      deleteDescription={t(
                        "administration.categories.deleteDialog.description",
                        { name: category.name }
                      )}
                      deleteConfirm={t(
                        "administration.masterData.deleteConfirm"
                      )}
                      items={[
                        {
                          key: "rename",
                          label: t("administration.masterData.rename"),
                          icon: <PencilIcon aria-hidden="true" />,
                          onSelect: (trigger) => {
                            dialogTrigger.current = trigger.current
                            setRenameFor(category)
                          },
                        },
                        {
                          key: "merge",
                          label: t("administration.categories.merge"),
                          icon: <MergeIcon aria-hidden="true" />,
                          onSelect: (trigger) => {
                            dialogTrigger.current = trigger.current
                            setMergeFor(category)
                          },
                        },
                      ]}
                      onDelete={() => {
                        setRowError(null)
                        remove.mutate(category.id, {
                          onSuccess: () =>
                            setNotice(
                              t("administration.categories.deleted", {
                                name: category.name,
                              })
                            ),
                          onError: (error) => {
                            const message = deleteError(error, category.name)
                            setRowError(message)
                            setNotice(message)
                          },
                        })
                      }}
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      <NameEditDialog
        open={renameFor !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRenameFor(null)
          }
        }}
        title={t("administration.categories.renameDialog.title")}
        description={t("administration.categories.renameDialog.description")}
        label={t("administration.categories.create.label")}
        currentName={renameFor?.name ?? ""}
        maxLength={CATEGORY_NAME_MAX}
        tooLongMessageKey="validation.masterData.categoryNameTooLong"
        pending={rename.isPending}
        finalFocus={dialogTrigger}
        onSubmit={async (name) => {
          if (renameFor === null) {
            return
          }
          setRowError(null)
          await rename.mutateAsync({
            categoryId: renameFor.id,
            request: { name },
          })
          setNotice(t("administration.categories.renamed", { name }))
        }}
      />

      <CategoryMergeDialog
        source={mergeFor}
        categories={all}
        onOpenChange={(next) => {
          if (!next) {
            setMergeFor(null)
          }
        }}
        pending={merge.isPending}
        finalFocus={dialogTrigger}
        onSubmit={async (targetCategoryId) => {
          if (mergeFor === null) {
            return
          }
          setRowError(null)
          const target = await merge.mutateAsync({
            sourceCategoryId: mergeFor.id,
            targetCategoryId,
          })
          setNotice(
            t("administration.categories.merged", {
              source: mergeFor.name,
              target: target.name,
            })
          )
        }}
      />

      {/* Anlegen, Umbenennen, Zusammenfuehren und Loeschen aendern die Liste
          weiter oben; ohne Live-Region bliebe das fuer Screenreader
          unbemerkt (SC 4.1.3). */}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  )
}
