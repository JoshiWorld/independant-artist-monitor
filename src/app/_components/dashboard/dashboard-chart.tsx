"use client";

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { api } from "@/trpc/react";
import { LoadingDots } from "@/components/ui/loading";

export const description = "Dashboard mit Statistiken zu Kampagnen und Werbekonten"

const chartConfig = {
    convPrice: {
        label: "Preis (€)",
        color: "var(--primary)",
    },
} satisfies ChartConfig

export function DashboardChart({ timeRange, setTimeRange }: { timeRange: string; setTimeRange: (value: string) => void }) {
    const isMobile = useIsMobile()

    const { data } = api.user.getDashboardStatsChart.useQuery();

    React.useEffect(() => {
        if (isMobile) {
            setTimeRange("7d")
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile]);

    if(!data) {
        return <LoadingDots />;
    }

    const filteredData = data.filter((item) => {
        const date = new Date(item.date)
        const referenceDate = new Date()
        let daysToSubtract = 14
        if (timeRange === "7d") {
            daysToSubtract = 7
        } else if (timeRange === "3d") {
            daysToSubtract = 3
        }
        const startDate = new Date(referenceDate)
        startDate.setDate(startDate.getDate() - daysToSubtract)
        return date >= startDate
    });

    const maxVal = Math.round(Math.max(...filteredData.map((item) => item.convPrice)) * 1.2) || 1;

    return (
        <Card className="@container/card">
            <CardHeader>
                <CardTitle>Preis pro Conversion</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">
                        Anzeigenstatistiken &ndash; {timeRange}
                    </span>
                    <span className="@[540px]/card:hidden">Letzte 14 Tage</span>
                </CardDescription>
                <CardAction>
                    <ToggleGroup
                        type="single"
                        value={timeRange}
                        onValueChange={setTimeRange}
                        variant="outline"
                        className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
                    >
                        <ToggleGroupItem value="14d">Letzte 14 Tage</ToggleGroupItem>
                        <ToggleGroupItem value="7d">Letzte 7 Tage</ToggleGroupItem>
                        <ToggleGroupItem value="3d">Letzte 3 Tage</ToggleGroupItem>
                    </ToggleGroup>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger
                            className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                            size="sm"
                            aria-label="Zeitraum auswählen"
                        >
                            <SelectValue placeholder="Letzte 14 Tage" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="14d" className="rounded-lg">
                                Letzte 14 Tage
                            </SelectItem>
                            <SelectItem value="7d" className="rounded-lg">
                                Letzte 7 Tage
                            </SelectItem>
                            <SelectItem value="3d" className="rounded-lg">
                                Letzte 3 Tage
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </CardAction>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <AreaChart data={filteredData}>
                        <defs>
                            <linearGradient id="fillConvPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-convPrice)"
                                    stopOpacity={1.0}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-convPrice)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(value as string)
                                return date.toLocaleDateString("de-DE", {
                                    month: "short",
                                    day: "numeric",
                                })
                            }}
                        />
                        <YAxis
                            domain={[0, maxVal]}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={8}
                            tickFormatter={(value: number) => `${value.toFixed(2)}€`}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => {
                                        return new Date(value as string).toLocaleDateString("de-DE", {
                                            month: "short",
                                            day: "numeric",
                                        })
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="convPrice"
                            type="monotoneX"
                            fill="url(#fillConvPrice)"
                            stroke="var(--color-convPrice)"
                            stackId="a"
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
