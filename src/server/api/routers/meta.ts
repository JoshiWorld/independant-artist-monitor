import type { AdAccount, Campaign, CampaignInsights } from "@/types/meta";
import { createTRPCRouter, metaProcedure, publicProcedure } from "../trpc";
import { z } from "zod";

const META_BASE = "https://graph.facebook.com/v21.0";

export const metaRouter = createTRPCRouter({
    getAdAccounts: metaProcedure.query(async ({ ctx }) => {
        return fetchMeta(`/me/adaccounts?fields=id,name`, ctx.session.user.metaAccessToken) as Promise<AdAccount>;
    }),

    getCampaigns: metaProcedure
        .input(z.object({ accountId: z.string() }))
        .query(async ({ ctx, input }) => {
            return fetchMeta(`/${input.accountId}/campaigns?fields=id,name,status`, ctx.session.user.metaAccessToken) as Promise<Campaign>;
        }),

    getCampaignInsights: metaProcedure
        .input(
            z.object({
                campaignId: z.string(),
                since: z.string().optional(), // YYYY-MM-DD
                until: z.string().optional(), // YYYY-MM-DD
                preset: z.string().optional(), // z.B. "last_7d"
            })
        )
        .query(async ({ ctx, input }) => {
            let query = `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions`;

            if (input.preset) {
                query += `&date_preset=${input.preset}`;
            } else if (input.since && input.until) {
                query += `&time_range[since]=${input.since}&time_range[until]=${input.until}`;
            }

            return fetchMeta(query, ctx.session.user.metaAccessToken) as Promise<CampaignInsights>;
        }),

    /* SYNC META DATA START */

    syncCampaignInsights: metaProcedure
        .input(
            z.object({
                campaignId: z.string(),
                since: z.string(), // YYYY-MM-DD
                until: z.string(), // YYYY-MM-DD
            })
        )
        .mutation(async ({ ctx, input }) => {
            const data = await fetchMeta(
                `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_range[since]=${input.since}&time_range[until]=${input.until}&time_increment=1`,
                ctx.session.user.metaAccessToken
            ) as CampaignInsights;

            for (const dataDay of data.data) {
                const conversions =
                    Number(dataDay.actions?.find((action) => action.action_type === "offsite_conversion.fb_pixel_custom")
                        ?.value) ?? 0;

                const convPrice =
                    conversions > 0 ? Number((parseFloat(dataDay.spend) / conversions).toFixed(2)) : 0;

                await ctx.db.dailyMetric.upsert({
                    where: {
                        // Composite Key: campaignId + date
                        campaignId_date: {
                            campaignId: input.campaignId,
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        },
                    },
                    update: {
                        conversions: conversions,
                        spend: parseFloat(dataDay.spend),
                        impressions: parseInt(dataDay.impressions),
                        ctr: parseFloat(dataDay.ctr),
                        cpc: parseFloat(dataDay.cpc),
                        clicks: parseInt(dataDay.clicks),
                        convPrice,
                    },
                    create: {
                        campaignId: input.campaignId,
                        date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        conversions: conversions,
                        spend: parseFloat(dataDay.spend),
                        impressions: parseInt(dataDay.impressions),
                        ctr: parseFloat(dataDay.ctr),
                        cpc: parseFloat(dataDay.cpc),
                        clicks: parseInt(dataDay.clicks),
                        convPrice,
                    },
                });
            }

            return { success: true, count: data.data.length };
        }),

    syncCampaignInsightsCron: publicProcedure
        .input(
            z.object({
                campaignId: z.string(),
                since: z.string(), // YYYY-MM-DD
                until: z.string(), // YYYY-MM-DD
                accessToken: z.string() // User Access Token for Meta
            })
        )
        .mutation(async ({ ctx, input }) => {
            const data = await fetchMeta(
                `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_range[since]=${input.since}&time_range[until]=${input.until}&time_increment=1`,
                input.accessToken
            ) as CampaignInsights;

            for (const dataDay of data.data) {
                const conversions =
                    Number(dataDay.actions?.find((action) => action.action_type === "offsite_conversion.fb_pixel_custom")
                        ?.value) ?? 0;

                const convPrice =
                    conversions > 0 ? Number((parseFloat(dataDay.spend) / conversions).toFixed(2)) : 0;

                await ctx.db.dailyMetric.upsert({
                    where: {
                        // Composite Key: campaignId + date
                        campaignId_date: {
                            campaignId: input.campaignId,
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        },
                    },
                    update: {
                        conversions: conversions,
                        spend: parseFloat(dataDay.spend),
                        impressions: parseInt(dataDay.impressions),
                        ctr: parseFloat(dataDay.ctr),
                        cpc: parseFloat(dataDay.cpc),
                        clicks: parseInt(dataDay.clicks),
                        convPrice,
                    },
                    create: {
                        campaignId: input.campaignId,
                        date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        conversions: conversions,
                        spend: parseFloat(dataDay.spend),
                        impressions: parseInt(dataDay.impressions),
                        ctr: parseFloat(dataDay.ctr),
                        cpc: parseFloat(dataDay.cpc),
                        clicks: parseInt(dataDay.clicks),
                        convPrice,
                    },
                });
            }

            return { success: true, count: data.data.length };
        }),

    syncAdAccounts: metaProcedure.mutation(async ({ ctx }) => {
        const data = await fetchMeta(`/me/adaccounts?fields=id,name`, ctx.session.user.metaAccessToken) as AdAccount;

        for (const account of data.data) {
            await ctx.db.adAccount.upsert({
                where: {
                    id: account.id
                },
                update: {
                    name: account.name,
                },
                create: {
                    name: account.name,
                    id: account.id,
                    user: {
                        connect: {
                            id: ctx.session.user.id
                        }
                    }
                }
            })
        }

        return { success: true, count: data.data.length }
    }),

    syncAdAccountsCron: publicProcedure.input(z.object({ accessToken: z.string(), userId: z.string() })).mutation(async ({ ctx, input }) => {
        const data = await fetchMeta(`/me/adaccounts?fields=id,name`, input.accessToken) as AdAccount;

        for (const account of data.data) {
            await ctx.db.adAccount.upsert({
                where: {
                    id: account.id
                },
                update: {
                    name: account.name,
                },
                create: {
                    name: account.name,
                    id: account.id,
                    user: {
                        connect: {
                            id: input.userId
                        }
                    }
                }
            })
        }

        return { success: true, count: data.data.length }
    }),

    syncCampaigns: metaProcedure.mutation(async ({ ctx }) => {
        const accounts = await ctx.db.adAccount.findMany({
            where: {
                user: {
                    id: ctx.session.user.id
                }
            },
            select: {
                id: true,
            }
        });

        for (const account of accounts) {
            const data = await fetchMeta(`/${account.id}/campaigns?fields=id,name,status`, ctx.session.user.metaAccessToken) as Campaign;

            for (const campaign of data.data) {
                await ctx.db.campaign.upsert({
                    where: {
                        id: campaign.id
                    },
                    update: {
                        name: campaign.name,
                    },
                    create: {
                        id: campaign.id,
                        name: campaign.name,
                        account: {
                            connect: {
                                id: account.id
                            }
                        }
                    }
                })
            }
        }

        return { success: true, count: accounts.length };
    }),

    syncCampaignsCron: publicProcedure.input(z.object({ accessToken: z.string(), userId: z.string() })).mutation(async ({ ctx, input }) => {
        const accounts = await ctx.db.adAccount.findMany({
            where: {
                user: {
                    id: input.userId
                }
            },
            select: {
                id: true,
            }
        });

        for (const account of accounts) {
            const data = await fetchMeta(`/${account.id}/campaigns?fields=id,name,status`, input.accessToken) as Campaign;

            for (const campaign of data.data) {
                await ctx.db.campaign.upsert({
                    where: {
                        id: campaign.id
                    },
                    update: {
                        name: campaign.name,
                    },
                    create: {
                        id: campaign.id,
                        name: campaign.name,
                        account: {
                            connect: {
                                id: account.id
                            }
                        }
                    }
                })
            }
        }

        return { success: true, count: accounts.length };
    })

    /* SYNC META DATA END */
});

async function fetchMeta(endpoint: string, access_token: string) {
    const res = await fetch(`${META_BASE}${endpoint}&access_token=${access_token}`);
    if (!res.ok) throw new Error("Meta API error");
    return res.json() as Promise<AdAccount | Campaign | CampaignInsights>;
}