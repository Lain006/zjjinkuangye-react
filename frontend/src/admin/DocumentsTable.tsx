import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Archive, ChevronLeft, ChevronRight, CircleCheck, FileText, PencilLine } from 'lucide-react'
import { useMemo } from 'react'
import type { AdminDocument, DocumentPage, DocumentStatus } from './api'

export const statusLabels: Record<DocumentStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

export type StatusAction = 'publish' | 'archive'

type Props = {
  data: DocumentPage
  actionBusy: boolean
  onEdit: (id: string, trigger: HTMLButtonElement) => void
  onAction: (document: AdminDocument, action: StatusAction, trigger: HTMLButtonElement) => void
  onPage: (page: number) => void
}

export default function DocumentsTable({ data, actionBusy, onEdit, onAction, onPage }: Props) {
  const columns = useMemo<ColumnDef<AdminDocument>[]>(() => [
    {
      accessorKey: 'title',
      header: '资料与来源',
      cell: ({ row }) => (
        <div className="admin-table-document">
          <button
            className="admin-document-link"
            type="button"
            onClick={(event) => onEdit(row.original.id, event.currentTarget)}
            disabled={actionBusy}
          >
            {row.original.title}
          </button>
          <span>{row.original.sourceName} · {row.original.category}</span>
        </div>
      ),
    },
    {
      accessorKey: 'publishDate',
      header: '原文日期',
      cell: ({ row }) => row.original.publishDate
        ? <time dateTime={row.original.publishDate}>{row.original.publishDate}</time>
        : <span>未注明</span>,
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => (
        <span className={`admin-document-status admin-document-status--${row.original.status}`}>
          {statusLabels[row.original.status]}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        const document = row.original
        return (
          <div className="admin-row-actions">
            <button
              type="button"
              className="admin-row-button"
              aria-label={`编辑《${document.title}》`}
              onClick={(event) => onEdit(document.id, event.currentTarget)}
              disabled={actionBusy}
            >
              <PencilLine size={14} aria-hidden="true" /> 编辑
            </button>
            {document.status !== 'published' && (
              <button
                type="button"
                className="admin-row-button admin-row-button--publish"
                aria-label={`发布《${document.title}》`}
                onClick={(event) => onAction(document, 'publish', event.currentTarget)}
                disabled={actionBusy}
              >
                <CircleCheck size={14} aria-hidden="true" /> 发布
              </button>
            )}
            {document.status !== 'archived' && (
              <button
                type="button"
                className="admin-row-button"
                aria-label={`归档《${document.title}》`}
                onClick={(event) => onAction(document, 'archive', event.currentTarget)}
                disabled={actionBusy}
              >
                <Archive size={14} aria-hidden="true" /> 归档
              </button>
            )}
          </div>
        )
      },
    },
  ], [actionBusy, onAction, onEdit])

  const table = useReactTable({
    data: data.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: data.total,
    state: { pagination: { pageIndex: data.page - 1, pageSize: data.pageSize } },
  })

  if (!data.items.length) {
    return (
      <div className="admin-table-empty">
        <FileText size={24} strokeWidth={1.6} aria-hidden="true" />
        <p>没有符合当前条件的资料</p>
        <span>试试其他关键词或状态，也可以录入一条新资料。</span>
      </div>
    )
  }

  return (
    <>
      <div className="admin-table-window">
        <table className="admin-table" role="table" aria-label="资料目录">
          <thead role="rowgroup">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} role="row">
                {group.headers.map((header) => (
                  <th key={header.id} scope="col" role="columnheader" className={`admin-col-${header.column.id}`}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody role="rowgroup">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} role="row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} role="cell" className={`admin-col-${cell.column.id}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="admin-pagination" aria-label="资料分页">
        <span>第 {data.page} / {table.getPageCount()} 页 · 共 {data.total} 条</span>
        <div>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="上一页"
            disabled={!table.getCanPreviousPage() || actionBusy}
            onClick={() => onPage(data.page - 1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="下一页"
            disabled={!table.getCanNextPage() || actionBusy}
            onClick={() => onPage(data.page + 1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </>
  )
}
