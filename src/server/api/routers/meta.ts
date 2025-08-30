import type { AdAccount, Campaign, CampaignInsights } from "@/types/meta";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

const META_BASE = "https://graph.facebook.com/v21.0";

export const metaRouter = createTRPCRouter({
    getAdAccounts: protectedProcedure.query(async () => {
        return fetchMeta(`/me/adaccounts?fields=id,name`) as Promise<AdAccount>;
    }),

    getCampaigns: protectedProcedure
        .input(z.object({ accountId: z.string() }))
        .query(async ({ input }) => {
            return fetchMeta(`/${input.accountId}/campaigns?fields=id,name,status`) as Promise<Campaign>;
        }),

    getCampaignInsights: protectedProcedure
        .input(
            z.object({
                campaignId: z.string(),
                since: z.string().optional(), // YYYY-MM-DD
                until: z.string().optional(), // YYYY-MM-DD
                preset: z.string().optional(), // z.B. "last_7d"
            })
        )
        .query(async ({ input }) => {
            let query = `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions`;

            if (input.preset) {
                query += `&date_preset=${input.preset}`;
            } else if (input.since && input.until) {
                query += `&time_range[since]=${input.since}&time_range[until]=${input.until}`;
            }

            return fetchMeta(query) as Promise<CampaignInsights>;
        }),
});

async function fetchMeta(endpoint: string) {
    const res = await fetch(`${META_BASE}${endpoint}&access_token=${process.env.META_ACCESS_TOKEN}`);
    if (!res.ok) throw new Error("Meta API error");
    return res.json() as Promise<AdAccount | Campaign | CampaignInsights>;
}