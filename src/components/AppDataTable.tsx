import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Pagination,
  SkeletonText,
} from '@carbon/react'

interface Props<T> {
  data: T[]
  columns: ColumnDef<T, any>[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyContent?: React.ReactNode
}

export function AppDataTable<T extends { id?: string }>({
  data,
  columns,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  isLoading,
  emptyContent,
}: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
  })

  return (
    <DataTable rows={[]} headers={[]} isSortable={false}>
      {() => (
        <TableContainer title="">
          <Table size="lg">
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHeader key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHeader>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell colSpan={columns.length}>
                      <SkeletonText />
                    </TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    {emptyContent ?? (
                      <span className="empty-state__desc">موردی یافت نشد</span>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={onRowClick ? 'table-row-clickable' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {total > pageSize && (
            <Pagination
              backwardText="قبلی"
              forwardText="بعدی"
              itemsPerPageText="تعداد در صفحه:"
              page={page}
              pageNumberText="صفحه"
              pageSize={pageSize}
              pageSizes={[10, 20, 50]}
              totalItems={total}
              onChange={({ page: newPage }) => onPageChange(newPage)}
            />
          )}
        </TableContainer>
      )}
    </DataTable>
  )
}
