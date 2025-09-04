"use client"

import * as React from "react"
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
    IconArchiveFilled,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconCircleCheckFilled,
    IconDotsVertical,
    IconLayoutColumns,
    IconLoader,
    IconTrendingDown,
    IconTrendingUp,
} from "@tabler/icons-react"
import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type Row,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { api } from "@/trpc/react"
import { LoadingDots } from "@/components/ui/loading"
import { CampaignStatus } from "@prisma/client"
import { useRouter } from "next/navigation"

export const schema = z.object({
    id: z.string(),
    accId: z.string(),
    status: z.nativeEnum(CampaignStatus),
    accountName: z.string(),
    name: z.string(),
    convPrice: z.number().nullable(),
    cpc: z.number().nullable(),
    clicks: z.number().nullable(),
    impressions: z.number().nullable(),
    ctr: z.number().nullable(),
    spend: z.number().nullable(),
    conversions: z.number().nullable(),
    performanceStatus: z.string(),
    greenMax: z.number().nullable(),
    yellowMax: z.number().nullable()
})

// Create a separate component for the drag handle
// function DragHandle({ id }: { id: number }) {
//     const { attributes, listeners } = useSortable({
//         id,
//     })

//     return (
//         <Button
//             {...attributes}
//             {...listeners}
//             variant="ghost"
//             size="icon"
//             className="text-muted-foreground size-7 hover:bg-transparent"
//         >
//             <IconGripVertical className="text-muted-foreground size-3" />
//             <span className="sr-only">Drag to reorder</span>
//         </Button>
//     )
// }

const columns: ColumnDef<z.infer<typeof schema>>[] = [
    // {
    //     id: "drag",
    //     header: () => null,
    //     cell: ({ row }) => <DragHandle id={row.original.id} />,
    // },
    {
        id: "select",
        header: ({ table }) => (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Alle auswählen"
                />
            </div>
        ),
        cell: ({ row }) => (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Zeile auswählen"
                />
            </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: "Kampagne",
        cell: ({ row }) => {
            return <TableCellViewer item={row.original} />
        },
        enableHiding: false,
    },
    {
        accessorKey: "accountName",
        header: "Account",
        cell: ({ row }) => (
            <div className="w-32">
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    {row.original.accountName}
                </Badge>
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant="outline" className="text-muted-foreground px-1.5">
                {row.original.status === "ACTIVE" ? (
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                ) : row.original.status === "PAUSED" ? (
                    <IconLoader />
                ) : row.original.status === "ARCHIVED" ? (
                    <IconArchiveFilled className="fill-yellow-500 dark:fill-yellow-400" />
                ) : (
                    <IconCircleCheckFilled className="fill-primary" />
                )}
                {row.original.status}
            </Badge>
        ),
    },
    {
        accessorKey: "convPrice",
        header: "Conversionpreis",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.convPrice ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(row.original.convPrice) : "-"}</p>
        },
        enableHiding: false,
    },
    {
        accessorKey: "spend",
        header: "Ausgegeben",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.spend ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(row.original.spend) : "-"}</p>
        },
    },
    {
        accessorKey: "clicks",
        header: "Klicks",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.clicks ? new Intl.NumberFormat("de-DE").format(row.original.clicks) : "-"}</p>
        },
    },
    {
        accessorKey: "conversions",
        header: "Conversions",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.conversions ? new Intl.NumberFormat("de-DE").format(row.original.conversions) : "-"}</p>
        },
    },
    {
        accessorKey: "cpc",
        header: "CPC",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.cpc ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(row.original.cpc) : "-"}</p>
        },
    },
    {
        accessorKey: "ctr",
        header: "CTR",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.ctr ? new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.original.ctr / 100) : "-"}</p>
        },
    },
    {
        accessorKey: "impressions",
        header: "Impressionen",
        cell: ({ row }) => {
            return <p className="text-foreground w-fit px-0 text-left">{row.original.impressions ? new Intl.NumberFormat("de-DE").format(row.original.impressions) : "-"}</p>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const router = useRouter();
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                            size="icon"
                        >
                            <IconDotsVertical />
                            <span className="sr-only">Menü öffnen</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem onClick={() => window.open(`https://adsmanager.facebook.com/adsmanager/manage/ads?${row.original.accId.replace("_", "=")}&date=${getDateDaysAgo(4)}_${new Date().toISOString().split('T')[0]}&selected_campaign_ids=${row.original.id}&nav_source=business_manager`, "_blank", "noopener,noreferrer")}>In Meta öffnen</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="default" onClick={() => router.push(`/dashboard/meta/ad-account/${row.original.accId}/campaign/${row.original.id}`)}>Analysieren</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
    const { transform, transition, setNodeRef, isDragging } = useSortable({
        id: row.original.id,
    })

    return (
        <TableRow
            data-state={row.getIsSelected() && "selected"}
            data-dragging={isDragging}
            ref={setNodeRef}
            className={`
    relative z-0 
    data-[dragging=true]:z-10 
    data-[dragging=true]:opacity-80
    ${row.original.performanceStatus === "YELLOW" && row.original.status === "ACTIVE" ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}
    ${row.original.performanceStatus === "RED" && row.original.status === "ACTIVE" ? "bg-red-50 dark:bg-red-900/20" : ""}
  `}
            style={{
                transform: CSS.Transform.toString(transform),
                transition: transition,
            }}
        >
            {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    )
}

export function DashboardTable() {
    const { data } = api.user.getDashboardCampaigns.useQuery();

    if (!data) {
        return <LoadingDots />;
    }

    return <DataTable data={data} />
}

function DataTable({
    data: initialData,
}: {
    data: z.infer<typeof schema>[]
}) {
    const [data, setData] = React.useState(() => initialData)
    const [tab, setTab] = React.useState("all");
    const [rowSelection, setRowSelection] = React.useState({})
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({
            spend: false,
            clicks: false,
            impressions: false,
            ctr: false,
            cpc: false,
            conversions: false,
        })
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    )
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    })
    const sortableId = React.useId()
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    )

    const dataIds = React.useMemo<UniqueIdentifier[]>(
        () => data?.map(({ id }) => id) || [],
        [data]
    )

    const filteredData = React.useMemo(() => {
        switch (tab) {
            case "active":
                return data.filter((c) => c.status === "ACTIVE");
            case "warning":
                return data.filter(
                    (c) => c.status === "ACTIVE" && c.performanceStatus === "YELLOW"
                );
            case "critical":
                return data.filter(
                    (c) => c.status === "ACTIVE" && c.performanceStatus === "RED"
                );
            default:
                return data; // "all"
        }
    }, [tab, data]);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination,
        },
        getRowId: (row) => row.id.toString(),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
    });

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (active && over && active.id !== over.id) {
            setData((data) => {
                const oldIndex = dataIds.indexOf(active.id)
                const newIndex = dataIds.indexOf(over.id)
                return arrayMove(data, oldIndex, newIndex)
            })
        }
    }

    return (
        <Tabs
            // defaultValue="all"
            onValueChange={setTab}
            value={tab}
            className="w-full flex-col justify-start gap-6"
        >
            <div className="flex items-center justify-between px-4 lg:px-6">
                <Label htmlFor="view-selector" className="sr-only">
                    Ansehen
                </Label>
                <Select value={tab} onValueChange={setTab}>
                    <SelectTrigger
                        className="flex w-fit @4xl/main:hidden"
                        size="sm"
                        id="view-selector"
                    >
                        <SelectValue placeholder="Ansicht auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Kampagnen</SelectItem>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="warning">Warnungen</SelectItem>
                        <SelectItem value="critical">Kritisch</SelectItem>
                    </SelectContent>
                </Select>
                <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
                    <TabsTrigger value="all">Alle Kampagnen</TabsTrigger>
                    <TabsTrigger value="active">
                        Aktiv <Badge variant="secondary">{data.filter((campaign) => campaign.status === "ACTIVE").length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="warning">
                        Warnungen <Badge variant="secondary">{data.filter((campaign) => campaign.status === "ACTIVE" && campaign.performanceStatus === "YELLOW").length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="critical">
                        Kritisch <Badge variant="secondary">{data.filter((campaign) => campaign.status === "ACTIVE" && campaign.performanceStatus === "RED").length}</Badge>
                    </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <IconLayoutColumns />
                                <span className="hidden lg:inline">Spalten anpassen</span>
                                <span className="lg:hidden">Spalten</span>
                                <IconChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {table
                                .getAllColumns()
                                .filter(
                                    (column) =>
                                        typeof column.accessorFn !== "undefined" &&
                                        column.getCanHide()
                                )
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {/* <Button variant="outline" size="sm">
                        <IconPlus />
                        <span className="hidden lg:inline">Add Section</span>
                    </Button> */}
                </div>
            </div>
            {/* ALLE KAMPAGNEN */}
            <TabsContent
                value="all"
                className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
            >
                <div className="overflow-hidden rounded-lg border">
                    <DndContext
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        id={sortableId}
                    >
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <TableHead key={header.id} colSpan={header.colSpan}>
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </TableHead>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody className="**:data-[slot=table-cell]:first:w-8">
                                {table.getRowModel().rows?.length ? (
                                    <SortableContext
                                        items={dataIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {table.getRowModel().rows.map((row) => (
                                            <DraggableRow key={row.id} row={row} />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            Keine Einträge vorhanden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
                <div className="flex items-center justify-between px-4">
                    <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        {table.getFilteredSelectedRowModel().rows.length} von{" "}
                        {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                            <Label htmlFor="rows-per-page" className="text-sm font-medium">
                                Zeilen pro Seite
                            </Label>
                            <Select
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value))
                                }}
                            >
                                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                    <SelectValue
                                        placeholder={table.getState().pagination.pageSize}
                                    />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 30, 40, 50].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                            Seite {table.getState().pagination.pageIndex + 1} von{" "}
                            {table.getPageCount()}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur ersten Seite</span>
                                <IconChevronsLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur vorherigen Seite</span>
                                <IconChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur nächsten Seite</span>
                                <IconChevronRight />
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden size-8 lg:flex"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur letzten Seite</span>
                                <IconChevronsRight />
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            {/* AKTIVE KAMPAGNEN */}
            <TabsContent
                value="active"
                className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
            >
                <div className="overflow-hidden rounded-lg border">
                    <DndContext
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        id={sortableId}
                    >
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <TableHead key={header.id} colSpan={header.colSpan}>
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </TableHead>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody className="**:data-[slot=table-cell]:first:w-8">
                                {table.getRowModel().rows?.length ? (
                                    <SortableContext
                                        items={dataIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {table.getRowModel().rows.map((row) => (
                                            <DraggableRow key={row.id} row={row} />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            Keine Einträge vorhanden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
                <div className="flex items-center justify-between px-4">
                    <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        {table.getFilteredSelectedRowModel().rows.length} von{" "}
                        {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                            <Label htmlFor="rows-per-page" className="text-sm font-medium">
                                Zeilen pro Seite
                            </Label>
                            <Select
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value))
                                }}
                            >
                                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                    <SelectValue
                                        placeholder={table.getState().pagination.pageSize}
                                    />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 30, 40, 50].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                            Seite {table.getState().pagination.pageIndex + 1} von{" "}
                            {table.getPageCount()}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur ersten Seite</span>
                                <IconChevronsLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur vorherigen Seite</span>
                                <IconChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur nächsten Seite</span>
                                <IconChevronRight />
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden size-8 lg:flex"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur letzten Seite</span>
                                <IconChevronsRight />
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            {/* WARNING KAMPAGNEN */}
            <TabsContent
                value="warning"
                className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
            >
                <div className="overflow-hidden rounded-lg border">
                    <DndContext
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        id={sortableId}
                    >
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <TableHead key={header.id} colSpan={header.colSpan}>
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </TableHead>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody className="**:data-[slot=table-cell]:first:w-8">
                                {table.getRowModel().rows?.length ? (
                                    <SortableContext
                                        items={dataIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {table.getRowModel().rows.map((row) => (
                                            <DraggableRow key={row.id} row={row} />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            Keine Einträge vorhanden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
                <div className="flex items-center justify-between px-4">
                    <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        {table.getFilteredSelectedRowModel().rows.length} von{" "}
                        {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                            <Label htmlFor="rows-per-page" className="text-sm font-medium">
                                Zeilen pro Seite
                            </Label>
                            <Select
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value))
                                }}
                            >
                                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                    <SelectValue
                                        placeholder={table.getState().pagination.pageSize}
                                    />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 30, 40, 50].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                            Seite {table.getState().pagination.pageIndex + 1} von{" "}
                            {table.getPageCount()}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur ersten Seite</span>
                                <IconChevronsLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur vorherigen Seite</span>
                                <IconChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur nächsten Seite</span>
                                <IconChevronRight />
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden size-8 lg:flex"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur letzten Seite</span>
                                <IconChevronsRight />
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            {/* CRITICAL KAMPAGNEN */}
            <TabsContent
                value="critical"
                className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
            >
                <div className="overflow-hidden rounded-lg border">
                    <DndContext
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        id={sortableId}
                    >
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <TableHead key={header.id} colSpan={header.colSpan}>
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </TableHead>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody className="**:data-[slot=table-cell]:first:w-8">
                                {table.getRowModel().rows?.length ? (
                                    <SortableContext
                                        items={dataIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {table.getRowModel().rows.map((row) => (
                                            <DraggableRow key={row.id} row={row} />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            Keine Einträge vorhanden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
                <div className="flex items-center justify-between px-4">
                    <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        {table.getFilteredSelectedRowModel().rows.length} von{" "}
                        {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                            <Label htmlFor="rows-per-page" className="text-sm font-medium">
                                Zeilen pro Seite
                            </Label>
                            <Select
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value))
                                }}
                            >
                                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                    <SelectValue
                                        placeholder={table.getState().pagination.pageSize}
                                    />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 30, 40, 50].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                            Seite {table.getState().pagination.pageIndex + 1} von{" "}
                            {table.getPageCount()}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur ersten Seite</span>
                                <IconChevronsLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Zur vorherigen Seite</span>
                                <IconChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur nächsten Seite</span>
                                <IconChevronRight />
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden size-8 lg:flex"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Zur letzten Seite</span>
                                <IconChevronsRight />
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            {/* <TabsContent
                value="active"
                className="flex flex-col px-4 lg:px-6"
            >
                <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
            </TabsContent>
            <TabsContent value="warning" className="flex flex-col px-4 lg:px-6">
                <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
            </TabsContent>
            <TabsContent
                value="critical"
                className="flex flex-col px-4 lg:px-6"
            >
                <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
            </TabsContent> */}
        </Tabs>
    )
}

const chartConfig = {
    convPrice: {
        label: "Preis (€)",
        color: "var(--primary)",
    },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
    const isMobile = useIsMobile();
    const [greenMax, setGreenMax] = React.useState(String(item.greenMax) ?? "");
    const [yellowMax, setYellowMax] = React.useState(String(item.yellowMax) ?? "");
    const [open, setOpen] = React.useState(false);

    const { data: chartData, isLoading: isLoadingChart } = api.campaign.getTableCellChart.useQuery({ id: item.id }, { enabled: open });

    const updateCampaign = api.campaign.update.useMutation({
        onSuccess: () => {
            toast.success("Kampagne wurde gespeichert");
        },
        onError: (err) => {
            console.error("Fehler beim Speichern der Kampagne:", err);
            toast.error("Fehler beim Speichern der Kampagne", { description: err.message })
        }
    });

    if (isLoadingChart) return <LoadingDots />;

    const filteredChartData = chartData?.slice(6, 13);
    const oldChartData = chartData?.slice(6, 13);

    const avgConvPrice = (filteredChartData?.reduce((sum, m) => sum + (m.convPrice ?? 0), 0) ?? 0) / (filteredChartData?.length ?? 1);
    const oldAvgConvPrice = (oldChartData?.reduce((sum, m) => sum + (m.convPrice ?? 0), 0) ?? 0) / (oldChartData?.length ?? 1);

    const differencePercentage = ((avgConvPrice - oldAvgConvPrice) / oldAvgConvPrice) * 100;

    return (
        <Drawer direction={isMobile ? "bottom" : "right"} open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button variant="link" className="text-foreground w-fit px-0 text-left">
                    {item.name}
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader className="gap-1">
                    <DrawerTitle>{item.accountName} - {item.name}</DrawerTitle>
                    <DrawerDescription>
                        Preis pro Conversion der letzten 7 Tage
                    </DrawerDescription>
                </DrawerHeader>
                <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
                    {!isMobile && filteredChartData && (
                        <>
                            <ChartContainer config={chartConfig}>
                                <AreaChart
                                    accessibilityLayer
                                    data={filteredChartData}
                                    margin={{
                                        left: 0,
                                        right: 10,
                                    }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => {
                                            const date = new Date(value as string)
                                            return date.toLocaleDateString("de-DE", {
                                                month: "short",
                                                day: "numeric",
                                            })
                                        }}
                                        hide
                                    />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="dot" />}
                                    />
                                    <Area
                                        dataKey="convPrice"
                                        type="natural"
                                        fill="var(--color-convPrice)"
                                        fillOpacity={0.6}
                                        stroke="var(--color-convPrice)"
                                        stackId="a"
                                    />
                                </AreaChart>
                            </ChartContainer>
                            <Separator />
                            <div className="grid gap-2">
                                {avgConvPrice > oldAvgConvPrice ? (
                                    <>
                                        <div className="flex gap-2 leading-none font-medium">
                                            Aufwärtstrend um {differencePercentage}% diese Woche{" "}
                                            <IconTrendingUp className="size-4" />
                                        </div>
                                        <div className="text-muted-foreground">
                                            Der Conversionpreis ist diese Woche {differencePercentage}% höher als in der letzten Woche. Eventuell sind einige Anpassungen notwendig.
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex gap-2 leading-none font-medium">
                                            Abwärtstrend um {differencePercentage}% diese Woche{" "}
                                            <IconTrendingDown className="size-4" />
                                        </div>
                                        <div className="text-muted-foreground">
                                            Der Conversionpreis ist diese Woche {differencePercentage}% niedriger als in der letzten Woche. Kampagnenperformance verbessert sich.
                                        </div>
                                    </>
                                )}
                            </div>
                            <Separator />
                        </>
                    )}
                    <form className="flex flex-col gap-4">
                        {/* <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3">
                                <Label htmlFor="type">Type</Label>
                                <Select defaultValue={item.type}>
                                    <SelectTrigger id="type" className="w-full">
                                        <SelectValue placeholder="Select a type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Table of Contents">
                                            Table of Contents
                                        </SelectItem>
                                        <SelectItem value="Executive Summary">
                                            Executive Summary
                                        </SelectItem>
                                        <SelectItem value="Technical Approach">
                                            Technical Approach
                                        </SelectItem>
                                        <SelectItem value="Design">Design</SelectItem>
                                        <SelectItem value="Capabilities">Capabilities</SelectItem>
                                        <SelectItem value="Focus Documents">
                                            Focus Documents
                                        </SelectItem>
                                        <SelectItem value="Narrative">Narrative</SelectItem>
                                        <SelectItem value="Cover Page">Cover Page</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Label htmlFor="status">Status</Label>
                                <Select defaultValue={item.status}>
                                    <SelectTrigger id="status" className="w-full">
                                        <SelectValue placeholder="Select a status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Done">Done</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Not Started">Not Started</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div> */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3">
                                <Label htmlFor="greenMax">Grün Max.</Label>
                                <Input type="number" id="greenMax" value={greenMax} onChange={(e) => setGreenMax(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Label htmlFor="yellowMax">Gelb Max.</Label>
                                <Input type="number" id="yellowMax" value={yellowMax} onChange={(e) => setYellowMax(e.target.value)} />
                            </div>
                        </div>
                        {/* <div className="flex flex-col gap-3">
                            <Label htmlFor="reviewer">Reviewer</Label>
                            <Select defaultValue={item.reviewer}>
                                <SelectTrigger id="reviewer" className="w-full">
                                    <SelectValue placeholder="Select a reviewer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                                    <SelectItem value="Jamik Tashpulatov">
                                        Jamik Tashpulatov
                                    </SelectItem>
                                    <SelectItem value="Emily Whalen">Emily Whalen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div> */}
                    </form>
                </div>
                <DrawerFooter>
                    <Button onClick={() => updateCampaign.mutate({ id: item.id, greenMax: greenMax ? Number(greenMax) : null, yellowMax: yellowMax ? Number(yellowMax) : null })} disabled={updateCampaign.isPending}>{updateCampaign.isPending ? "Speichert..." : "Speichern"}</Button>
                    <DrawerClose asChild>
                        <Button variant="outline">Schließen</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

function getDateDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0]!;
}