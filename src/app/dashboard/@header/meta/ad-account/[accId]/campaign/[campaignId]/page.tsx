import { SiteHeader, SiteHeaderLinks } from "@/app/_components/dashboard/site-header";
import { api } from "@/trpc/server";

type Props = {
    accId: string;
    campaignId: string;
}

type PageProps = {
    params: Promise<Props>
}

export default async function MetaAdAccountCampaignHeader({ params }: PageProps) {
    const { accId, campaignId } = await params;
    const adAccount = await api.adAccount.getName({ id: accId });
    const campaign = await api.campaign.getName({ id: campaignId });

    if (!accId || !campaignId || !adAccount || !campaign) {
        return <SiteHeader title="Ad-Accounts -> AccountID -> CampaignID" />;
    }

    const steps = [
        {
            text: "Ad-Accounts",
            url: "/dashboard"
        },
        {
            text: adAccount.name,
            url: `/dashboard/meta/ad-account/${accId}`
        },
        {
            text: campaign.name,
            url: `/dashboard/meta/ad-account/${accId}/campaign/${campaignId}`
        }
    ];

    return <SiteHeaderLinks steps={steps} />;
}