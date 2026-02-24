import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  type OnChangeFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Search } from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]

  /** Search / filter */
  searchPlaceholder?: string
  searchColumn?: string
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void

  /** Server-side pagination (manual mode) */
  manualPagination?: boolean
  manualSorting?: boolean
  pageCount?: number
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  totalItems?: number

  /** Loading & empty */
  isLoading?: boolean
  emptyIcon?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode

  /** Mobile card view */
  renderMobileRow?: (row: TData, index: number) => React.ReactNode

  /** Extra toolbar content (filters, buttons) rendered before column visibility */
  toolbarContent?: React.ReactNode

  /** Column visibility */
  showColumnVisibility?: boolean

  /** Page size options */
  pageSizeOptions?: number[]
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Cari...",
  searchColumn,
  globalFilter: externalGlobalFilter,
  onGlobalFilterChange,
  manualPagination = false,
  manualSorting = false,
  pageCount: externalPageCount,
  pagination: externalPagination,
  onPaginationChange,
  sorting: externalSorting,
  onSortingChange,
  totalItems,
  isLoading = false,
  emptyIcon,
  emptyTitle = "Belum Ada Data",
  emptyDescription = "Tidak ada data yang ditemukan",
  emptyAction,
  renderMobileRow,
  toolbarContent,
  showColumnVisibility = false,
  pageSizeOptions = [10, 15, 20, 30, 50],
}: DataTableProps<TData, TValue>) {
  // Internal state for client-side mode
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("")
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })

  // Use external or internal state
  const sorting = externalSorting ?? internalSorting
  const setSorting = onSortingChange ?? setInternalSorting
  const pagination = externalPagination ?? internalPagination
  const setPagination = onPaginationChange ?? setInternalPagination
  const globalFilter = externalGlobalFilter ?? internalGlobalFilter
  const setGlobalFilter = onGlobalFilterChange ?? setInternalGlobalFilter

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    ...(manualPagination
      ? { manualPagination: true, pageCount: externalPageCount ?? -1 }
      : { getPaginationRowModel: getPaginationRowModel() }),
    ...(manualSorting
      ? { manualSorting: true }
      : { getSortedRowModel: getSortedRowModel() }),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const displayTotal = totalItems ?? (manualPagination ? totalItems ?? 0 : table.getFilteredRowModel().rows.length)
  const currentPageStart = pagination.pageIndex * pagination.pageSize + 1
  const currentPageEnd = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    displayTotal
  )

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchColumn
              ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""
              : globalFilter ?? ""
            }
            onChange={(e) => {
              if (searchColumn) {
                table.getColumn(searchColumn)?.setFilterValue(e.target.value)
              } else {
                setGlobalFilter(e.target.value)
              }
            }}
            className="pl-9 text-sm h-9"
          />
        </div>

        {/* Extra toolbar content (filters, etc.) */}
        {toolbarContent}

        {/* Column visibility */}
        {showColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-9 text-xs gap-1.5">
                <Columns3 className="h-3.5 w-3.5" />
                Kolom
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize text-xs"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="flex items-center gap-4">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border bg-card">
          <div className="text-center py-12 px-4">
            {emptyIcon && <div className="mb-3 flex justify-center">{emptyIcon}</div>}
            <h3 className="text-base font-semibold text-muted-foreground mb-1">
              {emptyTitle}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {emptyDescription}
            </p>
            {emptyAction}
          </div>
        </div>
      )}

      {/* ── Data display ── */}
      {!isLoading && data.length > 0 && (
        <>
          {/* Desktop table */}
          <div className={renderMobileRow ? "hidden lg:block" : ""}>
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-xs h-10">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="group"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="text-xs py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Tidak ada hasil yang cocok.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile card view */}
          {renderMobileRow && (
            <div className="lg:hidden rounded-lg border bg-card divide-y overflow-hidden">
              {table.getRowModel().rows.map((row, index) =>
                renderMobileRow(row.original, index)
              )}
              {table.getRowModel().rows.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Tidak ada hasil yang cocok.
                </div>
              )}
            </div>
          )}

          {/* ── Pagination ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
            <div className="text-xs text-muted-foreground order-2 sm:order-1">
              {displayTotal > 0
                ? `Menampilkan ${currentPageStart}–${currentPageEnd} dari ${displayTotal}`
                : "Tidak ada data"}
            </div>

            <div className="flex items-center gap-3 order-1 sm:order-2">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Per halaman</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) => {
                    setPagination({
                      pageIndex: 0,
                      pageSize: Number(value),
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-[65px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((size) => (
                      <SelectItem key={size} value={String(size)} className="text-xs">
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">
                  {pagination.pageIndex + 1} / {table.getPageCount() || 1}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
