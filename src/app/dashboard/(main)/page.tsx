import { DashboardCards } from "@/app/_components/dashboard/dashboard-cards"
import { api } from "@/trpc/server";
import { DashboardChart } from "@/app/_components/dashboard/dashboard-chart";
import { DashboardTable } from "@/app/_components/dashboard/dashboard-table";

export default function DashboardMainPage() {
    void api.user.getDashboardStatsCards.prefetch();
    void api.user.getDashboardStatsChart.prefetch();
    void api.user.getDashboardCampaigns.prefetch();

    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                    <DashboardCards />
                    <div className="px-4 lg:px-6">
                        <DashboardChart />
                    </div>
                    <DashboardTable />
                </div>
            </div>
        </div>
    )
}