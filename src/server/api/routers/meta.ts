import type { AdAccount, Campaign, CampaignInsights, MetaError } from "@/types/meta";
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
            return fetchMeta(`/${input.accountId}/campaigns?fields=id,name,status,created_time`, ctx.session.user.metaAccessToken) as Promise<Campaign>;
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

    syncInsightsHelper: metaProcedure.mutation(({ ctx }) => {
        return ctx.db.campaign.findMany({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id
                    }
                }
            },
            select: {
                id: true,
            }
        });
    }),

    syncCampaignsHelper: metaProcedure.mutation(({ ctx }) => {
        return ctx.db.adAccount.findMany({
            where: {
                user: {
                    id: ctx.session.user.id
                }
            },
            select: {
                id: true,
            }
        });
    }),

    syncCampaignInsights: metaProcedure
        .input(
            z.object({
                campaignId: z.string().optional(),
                since: z.string().optional(), // YYYY-MM-DD
                until: z.string().optional(), // YYYY-MM-DD
                lifetime: z.boolean().optional(), // If true, sync all data from the beginning
            })
        )
        .mutation(async ({ ctx, input }) => {
            if (!input.campaignId) {
                const campaigns = await ctx.db.campaign.findMany({
                    where: {
                        account: {
                            user: {
                                id: ctx.session.user.id
                            }
                        }
                    },
                    select: {
                        id: true,
                    }
                });

                for (const campaign of campaigns) {
                    let query = `/${campaign.id}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_increment=1`;

                    if (input.lifetime) {
                        query += `&date_preset=maximum`;
                    } else if (input.since && input.until) {
                        query += `&time_range[since]=${input.since}&time_range[until]=${input.until}`;
                    } else {
                        query += `&date_preset=yesterday`; // fallback
                    }

                    const data = (await fetchMeta(query, ctx.session.user.metaAccessToken)) as CampaignInsights;

                    for (const dataDay of data.data) {
                        const rawValue = dataDay.actions?.find(
                            (action) => action.action_type === "offsite_conversion.fb_pixel_custom"
                        )?.value;
                        const conversions = Number(rawValue);
                        const safeConversions = isNaN(conversions) ? 0 : conversions;

                        const convPrice =
                            safeConversions > 0 ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2)) : 0;

                        await ctx.db.dailyMetric.upsert({
                            where: {
                                // Composite Key: campaignId + date
                                campaignId_date: {
                                    campaignId: campaign.id,
                                    date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                                },
                            },
                            update: {
                                conversions: safeConversions,
                                spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                                impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                                ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                                cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                                clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                                convPrice: isNaN(convPrice) ? 0 : convPrice,
                            },
                            create: {
                                campaign: {
                                    connect: {
                                        id: campaign.id
                                    }
                                },
                                date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                                conversions: safeConversions,
                                spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                                impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                                ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                                cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                                clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                                convPrice: isNaN(convPrice) ? 0 : convPrice,
                            },
                        });
                    }
                }
                return { success: true, count: campaigns.length };
            }

            let query = `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_increment=1`;

            if (input.lifetime) {
                query += `&date_preset=maximum`;
            } else if (input.since && input.until) {
                query += `&time_range[since]=${input.since}&time_range[until]=${input.until}`;
            } else {
                query += `&date_preset=yesterday`; // fallback
            }

            const data = (await fetchMeta(query, ctx.session.user.metaAccessToken)) as CampaignInsights;

            for (const dataDay of data.data) {
                const rawValue = dataDay.actions?.find(
                    // (action) => action.action_type === "offsite_conversion.fb_pixel_custom"
                    (action) => action.action_type.includes("offsite_conversion.fb_pixel")
                )?.value;
                const conversions = Number(rawValue);
                const safeConversions = isNaN(conversions) ? 0 : conversions;

                const convPrice =
                    safeConversions > 0 ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2)) : 0;

                await ctx.db.dailyMetric.upsert({
                    where: {
                        // Composite Key: campaignId + date
                        campaignId_date: {
                            campaignId: input.campaignId,
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        },
                    },
                    update: {
                        conversions: safeConversions,
                        spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                        impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                        ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                        cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                        clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                        convPrice: isNaN(convPrice) ? 0 : convPrice,
                    },
                    create: {
                        campaign: {
                            connect: {
                                id: input.campaignId
                            }
                        },
                        date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        conversions: safeConversions,
                        spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                        impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                        ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                        cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                        clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                        convPrice: isNaN(convPrice) ? 0 : convPrice,
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
            const data = await fetchMetaCron(
                `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_range[since]=${input.since}&time_range[until]=${input.until}&time_increment=1`,
                input.accessToken
            ) as CampaignInsights | MetaError;

            if (isMetaError(data)) {
                console.error(`Meta-Error for Sync CampaignInsights (${input.campaignId}):`, data.error.message);
                await ctx.db.error.create({
                    data: {
                        content: `Meta-Error for Sync CampaignInsights (${input.campaignId}): ${data.error.message}`
                    }
                });
                return { success: false }
            }

            for (const dataDay of data.data) {
                const rawValue = dataDay.actions?.find(
                    (action) => action.action_type.includes("offsite_conversion.fb_pixel")
                )?.value;
                const conversions = Number(rawValue);
                const safeConversions = isNaN(conversions) ? 0 : conversions;

                const convPrice =
                    safeConversions > 0 ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2)) : 0;

                await ctx.db.dailyMetric.upsert({
                    where: {
                        // Composite Key: campaignId + date
                        campaignId_date: {
                            campaignId: input.campaignId,
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        },
                    },
                    update: {
                        conversions: safeConversions,
                        spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                        impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                        ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                        cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                        clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                        convPrice: isNaN(convPrice) ? 0 : convPrice,
                    },
                    create: {
                        campaign: {
                            connect: {
                                id: input.campaignId
                            }
                        },
                        date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                        conversions: safeConversions,
                        spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                        impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                        ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                        cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                        clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                        convPrice: isNaN(convPrice) ? 0 : convPrice,
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
        const data = await fetchMetaCron(`/me/adaccounts?fields=id,name`, input.accessToken) as AdAccount | MetaError;

        if (isMetaError(data)) {
            console.error(`Meta-Error for Sync AdAccounts:`, data.error.message);
            await ctx.db.error.create({
                data: {
                    content: `Meta-Error for Sync AdAccounts: ${data.error.message}`
                }
            });
            return { success: false }
        }

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

    syncCampaigns: metaProcedure.input(z.object({ adAccountId: z.string() })).mutation(async ({ ctx, input }) => {
        const data = await fetchMeta(`/${input.adAccountId}/campaigns?fields=id,name,status,created_time`, ctx.session.user.metaAccessToken) as Campaign;

        for (const campaign of data.data) {
            await ctx.db.campaign.upsert({
                where: {
                    id: campaign.id
                },
                update: {
                    name: campaign.name,
                    status: campaign.status,
                    createdAt: new Date(campaign.created_time),
                },
                create: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status,
                    createdAt: new Date(campaign.created_time),
                    account: {
                        connect: {
                            id: input.adAccountId
                        }
                    }
                }
            })
        }

        return { success: true, count: data.data.length };
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
            const data = await fetchMetaCron(`/${account.id}/campaigns?fields=id,name,status,created_time`, input.accessToken) as Campaign | MetaError;

            if(isMetaError(data)) {
                console.error(`Meta-Error for Sync AdAccount (${account.id}):`, data.error.message);
                await ctx.db.error.create({
                    data: {
                        content: `Meta-Error for Sync AdAccount (${account.id}): ${data.error.message}`
                    }
                });
                continue;
            }

            for (const campaign of data.data) {
                await ctx.db.campaign.upsert({
                    where: {
                        id: campaign.id
                    },
                    update: {
                        name: campaign.name,
                        status: campaign.status,
                        createdAt: new Date(campaign.created_time),
                    },
                    create: {
                        id: campaign.id,
                        name: campaign.name,
                        status: campaign.status,
                        createdAt: new Date(campaign.created_time),
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
    if (!res.ok) {
        const error = await res.json() as MetaError;
        console.error('Meta-API-Error:', error);
        throw new Error(`Meta API responded with (${res.status}) ${error.error.message}`);
    }
    return res.json() as Promise<AdAccount | Campaign | CampaignInsights>;
}

async function fetchMetaCron(endpoint: string, access_token: string) {
    const res = await fetch(`${META_BASE}${endpoint}&access_token=${access_token}`);
    return res.json() as Promise<AdAccount | Campaign | CampaignInsights | MetaError>;
}

function isMetaError(data: AdAccount | Campaign | CampaignInsights | MetaError): data is MetaError {
    return (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error?.message === "string"
    );
}