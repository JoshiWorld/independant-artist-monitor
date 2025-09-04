"use client";

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { api } from "@/trpc/react";
import { IconRefresh } from "@tabler/icons-react"
import { subDays } from "date-fns";
import Link from "next/link"
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Steps = {
    text: string;
    url?: string;
}

export function SiteHeader({ title }: { title: string }) {
    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <h1 className="text-base font-medium">{title}</h1>
                <SyncDataButton />
            </div>
        </header>
    )
}

export function SiteHeaderLinks({ steps }: { steps: Steps[] }) {
    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <h1 className="text-base font-medium flex gap-2">
                    {steps.map((step, idx) => (
                        <span key={idx} className="flex items-center gap-2">
                            {idx === steps.length - 1 ? (
                                <span>{step.text}</span>
                            ) : (
                                <Link className="hover:underline" href={step.url ?? ""}>{step.text}</Link>
                            )}
                            {idx < steps.length - 1 && <span>-&gt;</span>}
                        </span>
                    ))}
                </h1>
                <SyncDataButton />
            </div>
        </header>
    )
}

function SyncDataButton() {
    const router = useRouter();
    const utils = api.useUtils();
    const [refreshing, setRefreshing] = useState(false);

    const { data: user } = api.user.getMetaTokenExpiry.useQuery();

    const syncAdAccounts = api.meta.syncAdAccounts.useMutation({
        onSuccess: () => {
            toast.success("AdAccounts wurden erfolgreich synchronisiert");
            syncCampaignsHelper.mutate();
        },
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Ad-Accounts", { description: error.message });
            console.error("Fehler beim Synchronisieren der Ad-Accounts:", error);
            setRefreshing(false);
        }
    });

    const syncCampaignsHelper = api.meta.syncCampaignsHelper.useMutation({
        onSuccess: async (adAccounts) => {
            let i = 0;
            for (const adAccount of adAccounts) {
                await syncCampaigns.mutateAsync({ adAccountId: adAccount.id });
                i++;
                toast.info("Kampagnen werden synchronisiert", { description: `${Math.round((i / adAccounts.length) * 100)}%` });
            }
            toast.success("Kampagnen wurden erfolgreich synchronisiert");
            syncInsightsHelper.mutate();
        },
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Kampagnen", { description: error.message });
            console.error("Fehler beim Synchronisieren der Kampagnen:", error);
            setRefreshing(false);
        }
    })

    const syncCampaigns = api.meta.syncCampaigns.useMutation({
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Kampagnen", { description: error.message });
            console.error("Fehler beim Synchronisieren der Kampagnen:", error);
            setRefreshing(false);
        }
    });

    const syncInsightsHelper = api.meta.syncInsightsHelper.useMutation({
        onSuccess: async (campaigns) => {
            let i = 0;
            for (const campaign of campaigns) {
                await syncCampaignInsights.mutateAsync({ campaignId: campaign.id, since: subDays(new Date(), 1).toISOString().split("T")[0], until: new Date().toISOString().split("T")[0] });
                i++;
                toast.info("Insights werden synchronisiert", { description: `${Math.round((i / campaigns.length) * 100)}%` });
            }
            setRefreshing(false);
            await utils.user.invalidate();
            await utils.meta.invalidate();
            toast.success("Insights wurden erfolgreich synchronisiert");
            router.refresh();
        },
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Insights", { description: error.message });
            console.error("Fehler beim Synchronisieren der Insights:", error);
            setRefreshing(false);
        }
    });

    const syncCampaignInsights = api.meta.syncCampaignInsights.useMutation({
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der KampagnenInsights", { description: error.message });
            console.error("Fehler beim Synchronisieren der KampagnenInsights:", error);
            setRefreshing(false);
        }
    });

    const isPending = syncAdAccounts.isPending || syncCampaigns.isPending || syncCampaignInsights.isPending || syncInsightsHelper.isPending || refreshing;

    const refreshData = () => {
        setRefreshing(true);
        syncAdAccounts.mutate();
    }

    return (
        <div className="ml-auto flex items-center gap-2">
            {/* Token-Warnung */}
            {user?.metaTokenExpiry && daysUntilExpiry(user.metaTokenExpiry) !== null &&
                daysUntilExpiry(user.metaTokenExpiry)! <= 10 && (
                    <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Meta-Verknüpfung läuft in {daysUntilExpiry(user.metaTokenExpiry)} Tag
                    {daysUntilExpiry(user.metaTokenExpiry) === 1 ? "" : "en"} ab
                    </span>
                )}

            {/* Refresh Button */}
            <Button
                variant="ghost"
                asChild
                size="sm"
                className="hidden sm:flex cursor-pointer"
                onClick={refreshData}
            >
                <p className="dark:text-foreground">
                    <IconRefresh className={isPending ? "animate-spin" : ""} />
                </p>
            </Button>
        </div>
    );
}

function daysUntilExpiry(expiry: Date | null): number | null {
    if (!expiry) return null;
    const now = new Date();
    const diffMs = new Date(expiry).getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}