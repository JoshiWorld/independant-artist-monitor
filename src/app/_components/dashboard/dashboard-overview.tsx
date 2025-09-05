"use client";

import { DashboardCards } from "@/app/_components/dashboard/dashboard-cards"
import { DashboardChart } from "@/app/_components/dashboard/dashboard-chart";
import { DashboardTable } from "@/app/_components/dashboard/dashboard-table";
import { useState } from "react";

export function DashboardOverview() {
    const [timeRange, setTimeRange] = useState("14d")

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <DashboardCards />
            <div className="px-4 lg:px-6">
                <DashboardChart timeRange={timeRange} setTimeRange={setTimeRange} />
            </div>
            <DashboardTable timeRange={timeRange} />
        </div>
    );
}