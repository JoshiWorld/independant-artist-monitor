import { DashboardOverview } from "@/app/_components/dashboard/dashboard-overview";
import { api } from "@/trpc/server";

export default function DashboardMainPage() {
    void api.user.getDashboardStatsCards.prefetch();
    void api.user.getDashboardStatsChart.prefetch();
    void api.user.getDashboardCampaigns.prefetch({});

    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <DashboardOverview />
            </div>
        </div>
    )
}