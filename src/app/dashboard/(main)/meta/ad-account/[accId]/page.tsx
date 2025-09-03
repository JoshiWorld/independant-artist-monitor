import { DashboardCards } from "@/app/_components/dashboard/dashboard-cards"
import { api } from "@/trpc/server";
import { DashboardChart } from "@/app/_components/dashboard/dashboard-chart";
import { DashboardTable } from "@/app/_components/dashboard/dashboard-table";
import { AdAccountsTable } from "@/app/_components/dashboard/ad-account/ad-account-table";

type Props = {
    accId: string;
};

type PageProps = {
    params: Promise<Props>;
};

export default async function DashboardMainPage({ params }: PageProps) {
    const { accId } = await params;

    void api.adAccount.getDashboardCampaigns.prefetch({ id: accId });

    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                    {/* <DashboardCards /> */}
                    <div className="px-4 lg:px-6">
                        {/* <DashboardChart /> */}
                    </div>
                    {/* <DashboardTable /> */}
                    <AdAccountsTable id={accId} />
                </div>
            </div>
        </div>
    )
}