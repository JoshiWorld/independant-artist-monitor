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
import type { DateRange } from "react-day-picker";

export const description = "Dashboard mit Statistiken zu Kampagnen und Werbekonten"

const chartConfig = {
    convPrice: {
        label: "Preis (€)",
        color: "var(--primary)",
    },
} satisfies ChartConfig

export function CampaignChart({ accId, campaignId, dateRange }: { accId: string; campaignId: string; dateRange: DateRange | undefined }) {
    const { data } = api.campaign.getCampaignStatsChart.useQuery({ accId, campaignId, from: dateRange?.from, to: dateRange?.to });

    if(!data) {
        return <LoadingDots />;
    }

    if(data.length === 0) {
        return <p>Keine Conversionspreise zum Anzeigen gefunden</p>;
    }

    const maxVal = Math.round(Math.max(...data.map((item) => item.convPrice)) * 1.2) || 1;

    return (
        <Card className="@container/card">
            <CardHeader>
                <CardTitle>Preis pro Conversion</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <AreaChart data={data}>
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
                            type="natural"
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
