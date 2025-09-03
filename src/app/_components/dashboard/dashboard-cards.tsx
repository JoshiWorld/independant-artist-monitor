"use client";

import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardAction,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { api } from "@/trpc/react";
import { LoadingDots } from "@/components/ui/loading";

export function DashboardCards() {
    const { data } = api.user.getDashboardStatsCards.useQuery();

    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Aktive Kampagnen</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {data?.activeCampaigns ?? <LoadingDots />}
                    </CardTitle>
                    {/* <CardAction>
                        <Badge variant="outline">
                            <IconTrendingUp />
                            +12.5%
                        </Badge>
                    </CardAction> */}
                </CardHeader>
                {/* <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        Trending up this month <IconTrendingUp className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                        Aktiv in den letzten 3 Tagen
                    </div>
                </CardFooter> */}
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Warnungen</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {data?.warningCampaigns ?? <LoadingDots />}
                    </CardTitle>
                    {/* <CardAction>
                        <Badge variant="outline">
                            <IconTrendingDown />
                            -20%
                        </Badge>
                    </CardAction> */}
                </CardHeader>
                {/* <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        Down 20% this period <IconTrendingDown className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                        Acquisition needs attention
                    </div>
                </CardFooter> */}
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Kritisch</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {data?.criticalCampaigns ?? <LoadingDots />}
                    </CardTitle>
                    {/* <CardAction>
                        <Badge variant="outline">
                            <IconTrendingUp />
                            +12.5%
                        </Badge>
                    </CardAction> */}
                </CardHeader>
                {/* <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        Strong user retention <IconTrendingUp className="size-4" />
                    </div>
                    <div className="text-muted-foreground">Engagement exceed targets</div>
                </CardFooter> */}
            </Card>
        </div>
    )
}
