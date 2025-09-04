import { api } from "@/trpc/server";
import { CampaignOverview } from "@/app/_components/dashboard/ad-account/campaign/campaign-overview";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

type Props = {
    campaignId: string;
    accId: string;
};

type PageProps = {
    params: Promise<Props>;
};

export default async function DashboardMainPage({ params }: PageProps) {
    const { campaignId, accId } = await params;
    const dates: DateRange = {
        from: subDays(new Date(), 7),
        to: new Date()
    }

    void api.campaign.getCampaignStatsCards.prefetch({ accId, campaignId, from: dates.from, to: dates.to });
    void api.campaign.getCampaignStatsCardsSecondary.prefetch({ accId, campaignId, from: dates.from, to: dates.to });
    void api.campaign.getCampaignStatsChart.prefetch({ accId, campaignId, from: dates.from, to: dates.to });

    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <CampaignOverview accId={accId} campaignId={campaignId} initDates={dates} />
            </div>
        </div>
    )
}