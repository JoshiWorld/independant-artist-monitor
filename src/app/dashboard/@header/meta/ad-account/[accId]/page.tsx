import { SiteHeader, SiteHeaderLinks } from "@/app/_components/dashboard/site-header";
import { api } from "@/trpc/server";

type Props = {
    accId: string;
}

type PageProps = {
    params: Promise<Props>
}

export default async function MetaAdAccountHeader({ params }: PageProps) {
    const { accId } = await params;
    const adAccount = await api.adAccount.getName({ id: accId });

    if (!accId || !adAccount) {
        return <SiteHeader title="Ad-Accounts -> AccountID" />;
    }

    const steps = [
        {
            text: "Ad-Accounts",
            url: "/dashboard"
        },
        {
            text: adAccount.name,
            url: `/dashboard/meta/ad-account/${accId}`
        }
    ];

    return <SiteHeaderLinks steps={steps} />;
}