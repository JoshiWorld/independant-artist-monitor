"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { useState } from "react";

export default function MetaCallbackPage() {
    const searchParams = useSearchParams();
    const code = searchParams.get("code");
    const utils = api.useUtils();
    const router = useRouter();

    const [progress, setProgress] = useState(0)
    const [saving, setSaving] = useState(false);

    const setToken = api.user.setMetaAccessToken.useMutation({
        onSuccess: () => {
            toast.success("Meta-AccessToken wurde erfolgreich gespeichert");
            setProgress(25);
            syncAdAccounts.mutate();
        },
        onError: (error) => {
            toast.error("Fehler beim Speichern des Tokens", { description: error.message });
            console.error("Fehler beim Speichern des Tokens:", error);
            setSaving(false);
        }
    });

    const syncAdAccounts = api.meta.syncAdAccounts.useMutation({
        onSuccess: () => {
            toast.success("AdAccounts wurden erfolgreich synchronisiert");
            setProgress(50);
            syncCampaignsHelper.mutate();
        },
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Ad-Accounts", { description: error.message });
            console.error("Fehler beim Synchronisieren der Ad-Accounts:", error);
            setSaving(false);
        }
    });

    const syncCampaignsHelper = api.meta.syncCampaignsHelper.useMutation({
        onSuccess: async (adAccounts) => {
            let i = 0;
            for(const adAccount of adAccounts) {
                await syncCampaigns.mutateAsync({ adAccountId: adAccount.id });
                i++;
                setProgress(Math.round((i / adAccounts.length) * 100));
            }
            toast.success("Kampagnen wurden erfolgreich synchronisiert");
            setProgress(75);
            syncInsightsHelper.mutate();
        },
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Kampagnen", { description: error.message });
            console.error("Fehler beim Synchronisieren der Kampagnen:", error);
            setSaving(false);
        }
    })

    const syncCampaigns = api.meta.syncCampaigns.useMutation({
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der Kampagnen", { description: error.message });
            console.error("Fehler beim Synchronisieren der Kampagnen:", error);
            setSaving(false);
        }
    });

    const syncInsightsHelper = api.meta.syncInsightsHelper.useMutation({
        onSuccess: async (campaigns) => {
            let i = 0;
            for(const campaign of campaigns) {
                await syncCampaignInsights.mutateAsync({ campaignId: campaign.id, lifetime: true });
                i++;
                setProgress(Math.round((i / campaigns.length) * 100));
            } 

            await utils.user.invalidate();
            await utils.meta.invalidate();
            toast.success("KampagnenInsights wurden erfolgreich synchronisiert");
            setProgress(100);
            router.push("/dashboard");
        },
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der KampagnenInsights", { description: error.message });
            console.error("Fehler beim Synchronisieren der KampagnenInsights:", error);
            setSaving(false);
        }
    });

    const syncCampaignInsights = api.meta.syncCampaignInsights.useMutation({
        onError: (error) => {
            toast.error("Fehler beim Synchronisieren der KampagnenInsights", { description: error.message });
            console.error("Fehler beim Synchronisieren der KampagnenInsights:", error);
            setSaving(false);
        }
    });

    const isPending = setToken.isPending || syncAdAccounts.isPending || syncCampaigns.isPending || syncCampaignInsights.isPending || syncInsightsHelper.isPending || saving;

    if(!code) {
        return <div>Es wurde kein Code übergeben.</div>;
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center">
            <h1 className="mb-4 text-2xl font-bold">Meta Callback</h1>
            <p className="mb-4">Der Code wurde erfolgreich empfangen. Synchronisiere jetzt deine Daten</p>
            <Button onClick={() => {
                setSaving(true);
                setProgress(5);
                setToken.mutate({ code });
            }} disabled={isPending}>
                {isPending ? "Speichere..." : "Vorgang abschließen"}
            </Button>
            {isPending && <Progress className="mt-4 w-64" value={progress} />}
            {setToken.error && <p className="mt-4 text-red-500">Fehler: {setToken.error.message}</p>}
        </div>
    );
}