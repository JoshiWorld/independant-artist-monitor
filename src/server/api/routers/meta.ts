import type { AdAccount, Campaign, CampaignInsights, MetaError } from "@/types/meta";
import { createTRPCRouter, metaProcedure, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import type { CampaignStatus } from "@prisma/client";

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
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["campaigns"]
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
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["adAccounts"]
            }
        });
    }),

    syncCampaignInsightsFull: publicProcedure
        .input(
            z.object({
                campaignId: z.string(),
                accessToken: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            let totalMetrics = 0;

            try {
                const insights = await fetchAllInsightsFull(
                    input.campaignId,
                    input.accessToken,
                );

                for (const dataDay of insights) {
                    const rawValue = dataDay.actions?.find((a) =>
                        a.action_type.includes("offsite_conversion.fb_pixel")
                    )?.value;
                    const conversions = Number(rawValue);
                    const safeConversions = isNaN(conversions) ? 0 : conversions;

                    const convPrice =
                        safeConversions > 0
                            ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2))
                            : 0;

                    await ctx.db.dailyMetric.upsert({
                        where: {
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
                            campaign: { connect: { id: input.campaignId } },
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                            conversions: safeConversions,
                            spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                            impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                            ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                            cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                            clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                            convPrice: isNaN(convPrice) ? 0 : convPrice,
                        },
                        select: {
                            id: true
                        }
                    });
                }

                totalMetrics += insights.length;
            } catch (error) {
                if (error instanceof Error) {
                    console.error(`Meta-Error for Sync CampaignInsights (${input.campaignId}):`, error.message);
                    await ctx.db.error.create({
                        data: {
                            content: `Meta-Error for Sync CampaignInsights (${input.campaignId}): ${error.message}`,
                        },
                    });
                }
            }

            return { success: true, metrics: totalMetrics };
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
            if(!input.campaignId) {
                const campaigns = await ctx.db.campaign.findMany({
                    where: {
                        account: {
                            user: { id: ctx.session.user.id },
                        },
                    },
                    select: { id: true },
                });

                let totalMetrics = 0;

                for (const campaign of campaigns) {
                    try {
                        const insights = await fetchAllInsightsSync(
                            campaign.id,
                            ctx.session.user.metaAccessToken,
                            input.since,
                            input.until,
                            input.lifetime
                        );

                        for (const dataDay of insights) {
                            const rawValue = dataDay.actions?.find((a) =>
                                a.action_type.includes("offsite_conversion.fb_pixel")
                            )?.value;
                            const conversions = Number(rawValue);
                            const safeConversions = isNaN(conversions) ? 0 : conversions;

                            const convPrice =
                                safeConversions > 0
                                    ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2))
                                    : 0;

                            await ctx.db.dailyMetric.upsert({
                                where: {
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
                                    campaign: { connect: { id: campaign.id } },
                                    date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                                    conversions: safeConversions,
                                    spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                                    impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                                    ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                                    cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                                    clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                                    convPrice: isNaN(convPrice) ? 0 : convPrice,
                                },
                                select: {
                                    id: true,
                                }
                            });
                        }

                        totalMetrics += insights.length;
                    } catch (error) {
                        if (error instanceof Error) {
                            console.error(`Meta-Error for Sync CampaignInsights (${campaign.id}):`, error.message);
                            await ctx.db.error.create({
                                data: {
                                    content: `Meta-Error for Sync CampaignInsights (${campaign.id}): ${error.message}`,
                                },
                            });
                        }
                        continue;
                    }
                }

                return { success: true, campaigns: campaigns.length, metrics: totalMetrics };
            }

            let totalMetrics = 0;

            try {
                const insights = await fetchAllInsightsSync(
                    input.campaignId,
                    ctx.session.user.metaAccessToken,
                    input.since,
                    input.until,
                    input.lifetime
                );

                for (const dataDay of insights) {
                    const rawValue = dataDay.actions?.find((a) =>
                        a.action_type.includes("offsite_conversion.fb_pixel")
                    )?.value;
                    const conversions = Number(rawValue);
                    const safeConversions = isNaN(conversions) ? 0 : conversions;

                    const convPrice =
                        safeConversions > 0
                            ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2))
                            : 0;

                    await ctx.db.dailyMetric.upsert({
                        where: {
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
                            campaign: { connect: { id: input.campaignId } },
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                            conversions: safeConversions,
                            spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                            impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                            ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                            cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                            clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                            convPrice: isNaN(convPrice) ? 0 : convPrice,
                        },
                        select: {
                            id: true,
                        }
                    });
                }

                totalMetrics += insights.length;
            } catch (error) {
                if (error instanceof Error) {
                    console.error(`Meta-Error for Sync CampaignInsights (${input.campaignId}):`, error.message);
                    await ctx.db.error.create({
                        data: {
                            content: `Meta-Error for Sync CampaignInsights (${input.campaignId}): ${error.message}`,
                        },
                    });
                }
            }

            return { success: true, metrics: totalMetrics };
            // if (!input.campaignId) {
            //     const campaigns = await ctx.db.campaign.findMany({
            //         where: {
            //             account: {
            //                 user: {
            //                     id: ctx.session.user.id
            //                 }
            //             }
            //         },
            //         select: {
            //             id: true,
            //         }
            //     });

            //     for (const campaign of campaigns) {
            //         let query = `/${campaign.id}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_increment=1`;

            //         if (input.lifetime) {
            //             query += `&date_preset=maximum`;
            //         } else if (input.since && input.until) {
            //             query += `&time_range[since]=${input.since}&time_range[until]=${input.until}`;
            //         } else {
            //             query += `&date_preset=yesterday`; // fallback
            //         }

            //         const data = (await fetchMeta(query, ctx.session.user.metaAccessToken)) as CampaignInsights;

            //         for (const dataDay of data.data) {
            //             const rawValue = dataDay.actions?.find(
            //                 (action) => action.action_type === "offsite_conversion.fb_pixel_custom"
            //             )?.value;
            //             const conversions = Number(rawValue);
            //             const safeConversions = isNaN(conversions) ? 0 : conversions;

            //             const convPrice =
            //                 safeConversions > 0 ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2)) : 0;

            //             await ctx.db.dailyMetric.upsert({
            //                 where: {
            //                     // Composite Key: campaignId + date
            //                     campaignId_date: {
            //                         campaignId: campaign.id,
            //                         date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
            //                     },
            //                 },
            //                 update: {
            //                     conversions: safeConversions,
            //                     spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
            //                     impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
            //                     ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
            //                     cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
            //                     clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
            //                     convPrice: isNaN(convPrice) ? 0 : convPrice,
            //                 },
            //                 create: {
            //                     campaign: {
            //                         connect: {
            //                             id: campaign.id
            //                         }
            //                     },
            //                     date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
            //                     conversions: safeConversions,
            //                     spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
            //                     impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
            //                     ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
            //                     cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
            //                     clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
            //                     convPrice: isNaN(convPrice) ? 0 : convPrice,
            //                 },
            //             });
            //         }
            //     }
            //     return { success: true, count: campaigns.length };
            // }

            // let query = `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_increment=1`;

            // if (input.lifetime) {
            //     query += `&date_preset=maximum`;
            // } else if (input.since && input.until) {
            //     query += `&time_range[since]=${input.since}&time_range[until]=${input.until}`;
            // } else {
            //     query += `&date_preset=yesterday`; // fallback
            // }

            // const data = (await fetchMeta(query, ctx.session.user.metaAccessToken)) as CampaignInsights;

            // for (const dataDay of data.data) {
            //     const rawValue = dataDay.actions?.find(
            //         // (action) => action.action_type === "offsite_conversion.fb_pixel_custom"
            //         (action) => action.action_type.includes("offsite_conversion.fb_pixel")
            //     )?.value;
            //     const conversions = Number(rawValue);
            //     const safeConversions = isNaN(conversions) ? 0 : conversions;

            //     const convPrice =
            //         safeConversions > 0 ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2)) : 0;

            //     await ctx.db.dailyMetric.upsert({
            //         where: {
            //             // Composite Key: campaignId + date
            //             campaignId_date: {
            //                 campaignId: input.campaignId,
            //                 date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
            //             },
            //         },
            //         update: {
            //             conversions: safeConversions,
            //             spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
            //             impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
            //             ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
            //             cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
            //             clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
            //             convPrice: isNaN(convPrice) ? 0 : convPrice,
            //         },
            //         create: {
            //             campaign: {
            //                 connect: {
            //                     id: input.campaignId
            //                 }
            //             },
            //             date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
            //             conversions: safeConversions,
            //             spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
            //             impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
            //             ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
            //             cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
            //             clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
            //             convPrice: isNaN(convPrice) ? 0 : convPrice,
            //         },
            //     });
            // }

            // return { success: true, count: data.data.length };
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
            let total = 0;

            try {
                const insights = await fetchAllInsights(
                    input.campaignId,
                    input.since,
                    input.until,
                    input.accessToken
                );

                for (const dataDay of insights) {
                    const rawValue = dataDay.actions?.find((a) =>
                        a.action_type.includes("offsite_conversion.fb_pixel")
                    )?.value;
                    const conversions = Number(rawValue);
                    const safeConversions = isNaN(conversions) ? 0 : conversions;

                    const convPrice =
                        safeConversions > 0
                            ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2))
                            : 0;

                    await ctx.db.dailyMetric.upsert({
                        where: {
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
                            campaign: { connect: { id: input.campaignId } },
                            date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
                            conversions: safeConversions,
                            spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
                            impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
                            ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
                            cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
                            clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
                            convPrice: isNaN(convPrice) ? 0 : convPrice,
                        },
                        select: {
                            id: true,
                        }
                    });
                }

                total += insights.length;
            } catch (error) {
                if (error instanceof Error) {
                    console.error(`Meta-Error for Sync CampaignInsights (${input.campaignId}):`, error.message);
                    await ctx.db.error.create({
                        data: {
                            content: `Meta-Error for Sync CampaignInsights (${input.campaignId}): ${error.message}`,
                        },
                    });
                }
            }

            return { success: true, metrics: total };

            // const data = await fetchMetaCron(
            //     `/${input.campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&time_range[since]=${input.since}&time_range[until]=${input.until}&time_increment=1`,
            //     input.accessToken
            // ) as CampaignInsights | MetaError;

            // if (isMetaError(data)) {
            //     console.error(`Meta-Error for Sync CampaignInsights (${input.campaignId}):`, data.error.message);
            //     await ctx.db.error.create({
            //         data: {
            //             content: `Meta-Error for Sync CampaignInsights (${input.campaignId}): ${data.error.message}`
            //         }
            //     });
            //     return { success: false }
            // }

            // for (const dataDay of data.data) {
            //     const rawValue = dataDay.actions?.find(
            //         (action) => action.action_type.includes("offsite_conversion.fb_pixel")
            //     )?.value;
            //     const conversions = Number(rawValue);
            //     const safeConversions = isNaN(conversions) ? 0 : conversions;

            //     const convPrice =
            //         safeConversions > 0 ? Number((parseFloat(dataDay.spend) / safeConversions).toFixed(2)) : 0;

            //     await ctx.db.dailyMetric.upsert({
            //         where: {
            //             // Composite Key: campaignId + date
            //             campaignId_date: {
            //                 campaignId: input.campaignId,
            //                 date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
            //             },
            //         },
            //         update: {
            //             conversions: safeConversions,
            //             spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
            //             impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
            //             ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
            //             cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
            //             clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
            //             convPrice: isNaN(convPrice) ? 0 : convPrice,
            //         },
            //         create: {
            //             campaign: {
            //                 connect: {
            //                     id: input.campaignId
            //                 }
            //             },
            //             date: dataDay.date_start ? new Date(dataDay.date_start) : new Date(),
            //             conversions: safeConversions,
            //             spend: isNaN(parseFloat(dataDay.spend)) ? 0 : parseFloat(dataDay.spend),
            //             impressions: isNaN(parseInt(dataDay.impressions)) ? 0 : parseInt(dataDay.impressions),
            //             ctr: isNaN(parseFloat(dataDay.ctr)) ? 0 : parseFloat(dataDay.ctr),
            //             cpc: isNaN(parseFloat(dataDay.cpc)) ? 0 : parseFloat(dataDay.cpc),
            //             clicks: isNaN(parseInt(dataDay.clicks)) ? 0 : parseInt(dataDay.clicks),
            //             convPrice: isNaN(convPrice) ? 0 : convPrice,
            //         },
            //     });
            // }

            // return { success: true, count: data.data.length };
        }),

    syncAdAccounts: metaProcedure.mutation(async ({ ctx }) => {
        try {
            const accounts = await fetchAllAdAccounts(ctx.session.user.metaAccessToken);

            for (const account of accounts) {
                await ctx.db.adAccount.upsert({
                    where: { id: account.id },
                    update: { name: account.name },
                    create: {
                        id: account.id,
                        name: account.name,
                        user: { connect: { id: ctx.session.user.id } },
                    },
                    select: {
                        id: true,
                    }
                });
            }

            return { success: true, count: accounts.length };
        } catch (error) {
            if (error instanceof Error) {
                console.error("Meta-Error for Sync AdAccounts:", error.message);
                await ctx.db.error.create({
                    data: { content: `Meta-Error for Sync AdAccounts: ${error.message}` },
                });
            }
            return { success: false };
        }

        // const data = await fetchMeta(`/me/adaccounts?fields=id,name`, ctx.session.user.metaAccessToken) as AdAccount;

        // for (const account of data.data) {
        //     await ctx.db.adAccount.upsert({
        //         where: {
        //             id: account.id
        //         },
        //         update: {
        //             name: account.name,
        //         },
        //         create: {
        //             name: account.name,
        //             id: account.id,
        //             user: {
        //                 connect: {
        //                     id: ctx.session.user.id
        //                 }
        //             }
        //         }
        //     })
        // }

        // return { success: true, count: data.data.length }
    }),

    syncAdAccountsCron: publicProcedure.input(z.object({ accessToken: z.string(), userId: z.string() })).mutation(async ({ ctx, input }) => {
        try {
            const accounts = await fetchAllAdAccounts(input.accessToken);

            for (const account of accounts) {
                await ctx.db.adAccount.upsert({
                    where: { id: account.id },
                    update: { name: account.name },
                    create: {
                        id: account.id,
                        name: account.name,
                        user: { connect: { id: input.userId } },
                    },
                    select: {
                        id: true,
                    }
                });
            }

            return { success: true, count: accounts.length };
        } catch (error) {
            if(error instanceof Error) {
                console.error("Meta-Error for Sync AdAccounts:", error.message);
                await ctx.db.error.create({
                    data: { content: `Meta-Error for Sync AdAccounts: ${error.message}` },
                });
            }
            return { success: false };
        }

        // const data = await fetchMetaCron(`/me/adaccounts?fields=id,name`, input.accessToken) as AdAccount | MetaError;

        // if (isMetaError(data)) {
        //     console.error(`Meta-Error for Sync AdAccounts:`, data.error.message);
        //     await ctx.db.error.create({
        //         data: {
        //             content: `Meta-Error for Sync AdAccounts: ${data.error.message}`
        //         }
        //     });
        //     return { success: false }
        // }

        // for (const account of data.data) {
        //     await ctx.db.adAccount.upsert({
        //         where: {
        //             id: account.id
        //         },
        //         update: {
        //             name: account.name,
        //         },
        //         create: {
        //             name: account.name,
        //             id: account.id,
        //             user: {
        //                 connect: {
        //                     id: input.userId
        //                 }
        //             }
        //         }
        //     })
        // }

        // return { success: true, count: data.data.length }
    }),

    syncCampaigns: metaProcedure.input(z.object({ adAccountId: z.string() })).mutation(async ({ ctx, input }) => {
        let totalCampaigns = 0;

        try {
            const campaigns = await fetchAllCampaigns(input.adAccountId, ctx.session.user.metaAccessToken);

            for (const campaign of campaigns) {
                await ctx.db.campaign.upsert({
                    where: { id: campaign.id },
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
                            connect: { id: input.adAccountId },
                        },
                    },
                    select: {
                        id: true,
                    }
                });
            }

            totalCampaigns += campaigns.length;
        } catch (error) {
            if (error instanceof Error) {
                console.error(
                    `Meta-Error for Sync AdAccount-Campaigns (${input.adAccountId}):`,
                    error.message
                );
                await ctx.db.error.create({
                    data: {
                        content: `Meta-Error for Sync AdAccount-Campaigns (${input.adAccountId}): ${error.message}`,
                    },
                });
            }
        }

        return { success: true, campaigns: totalCampaigns };

        // const data = await fetchMeta(`/${input.adAccountId}/campaigns?fields=id,name,status,created_time`, ctx.session.user.metaAccessToken) as Campaign;

        // for (const campaign of data.data) {
        //     await ctx.db.campaign.upsert({
        //         where: {
        //             id: campaign.id
        //         },
        //         update: {
        //             name: campaign.name,
        //             status: campaign.status,
        //             createdAt: new Date(campaign.created_time),
        //         },
        //         create: {
        //             id: campaign.id,
        //             name: campaign.name,
        //             status: campaign.status,
        //             createdAt: new Date(campaign.created_time),
        //             account: {
        //                 connect: {
        //                     id: input.adAccountId
        //                 }
        //             }
        //         }
        //     })
        // }

        // return { success: true, count: data.data.length };
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

        let totalCampaigns = 0;

        for (const account of accounts) {
            try {
                const campaigns = await fetchAllCampaigns(account.id, input.accessToken);

                for (const campaign of campaigns) {
                    await ctx.db.campaign.upsert({
                        where: { id: campaign.id },
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
                                connect: { id: account.id },
                            },
                        },
                        select: {
                            id: true,
                        }
                    });
                }

                totalCampaigns += campaigns.length;
            } catch (error) {
                if(error instanceof Error) {
                    console.error(
                        `Meta-Error for Sync AdAccount-Campaigns (${account.id}):`,
                        error.message
                    );
                    await ctx.db.error.create({
                        data: {
                            content: `Meta-Error for Sync AdAccount-Campaigns (${account.id}): ${error.message}`,
                        },
                    });
                }
                continue;
            }
        }

        return { success: true, accounts: accounts.length, campaigns: totalCampaigns };

        // for (const account of accounts) {
        //     const data = await fetchMetaCron(`/${account.id}/campaigns?fields=id,name,status,created_time`, input.accessToken) as Campaign | MetaError;

        //     if(isMetaError(data)) {
        //         console.error(`Meta-Error for Sync AdAccount (${account.id}):`, data.error.message);
        //         await ctx.db.error.create({
        //             data: {
        //                 content: `Meta-Error for Sync AdAccount (${account.id}): ${data.error.message}`
        //             }
        //         });
        //         continue;
        //     }

        //     for (const campaign of data.data) {
        //         await ctx.db.campaign.upsert({
        //             where: {
        //                 id: campaign.id
        //             },
        //             update: {
        //                 name: campaign.name,
        //                 status: campaign.status,
        //                 createdAt: new Date(campaign.created_time),
        //             },
        //             create: {
        //                 id: campaign.id,
        //                 name: campaign.name,
        //                 status: campaign.status,
        //                 createdAt: new Date(campaign.created_time),
        //                 account: {
        //                     connect: {
        //                         id: account.id
        //                     }
        //                 }
        //             }
        //         })
        //     }
        // }

        // return { success: true, count: accounts.length };
    }),

    invalidateCache: protectedProcedure.mutation(({ ctx }) => {
        return ctx.db.$accelerate.invalidate({
            tags: ["adAccounts", "campaigns", "campaignInsights"]
        });
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

async function fetchAllAdAccounts(
    accessToken: string
): Promise<{ id: string; name: string }[]> {
    let url = `/me/adaccounts?fields=id,name&limit=100`;
    let allAccounts: { id: string; name: string }[] = [];

    while (url) {
        const res = (await fetchMetaCron(url, accessToken)) as AdAccount | MetaError;

        if ("error" in res) {
            throw new Error(res.error.message);
        }

        allAccounts = allAccounts.concat(res.data);

        // Falls es eine nächste Seite gibt URL updaten
        url = res.paging?.next
            ? res.paging.next.replace(META_BASE, "")
            : "";
    }

    return allAccounts;
}

async function fetchAllCampaigns(
    accountId: string,
    accessToken: string
): Promise<{ id: string; name: string; status: CampaignStatus; created_time: Date }[]> {
    let url = `/${accountId}/campaigns?fields=id,name,status,created_time&limit=100`;
    let allCampaigns: {
        id: string;
        name: string;
        status: CampaignStatus;
        created_time: Date;
    }[] = [];

    while (url) {
        const res = (await fetchMetaCron(url, accessToken)) as Campaign | MetaError;

        if ("error" in res) {
            throw new Error(res.error.message);
        }

        allCampaigns = allCampaigns.concat(res.data);

        url = res.paging?.next
            ? res.paging.next.replace("https://graph.facebook.com/v21.0", "")
            : "";
    }

    return allCampaigns;
}

async function fetchAllInsights(
    campaignId: string,
    since: string,
    until: string,
    accessToken: string
): Promise<CampaignInsights["data"]> {
    let url = `/${campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions,date_start&time_range[since]=${since}&time_range[until]=${until}&time_increment=1&limit=100`;
    let allData: CampaignInsights["data"] = [];

    while (url) {
        const res = (await fetchMetaCron(url, accessToken)) as CampaignInsights | MetaError;

        if ("error" in res) {
            throw new Error(res.error.message);
        }

        allData = allData.concat(res.data);

        url = res.paging?.next
            ? res.paging.next.replace("https://graph.facebook.com/v21.0", "")
            : "";
    }

    return allData;
}

async function fetchAllInsightsSync(
    campaignId: string,
    accessToken: string,
    since?: string,
    until?: string,
    lifetime?: boolean
): Promise<CampaignInsights["data"]> {
    let url = `/${campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions,date_start&time_increment=1&limit=100`;

    if (lifetime) {
        url += `&date_preset=maximum`;
    } else if (since && until) {
        url += `&time_range[since]=${since}&time_range[until]=${until}`;
    } else {
        url += `&date_preset=yesterday`;
    }

    let allData: CampaignInsights["data"] = [];

    while (url) {
        const res = (await fetchMetaCron(url, accessToken)) as CampaignInsights | MetaError;

        if ("error" in res) {
            throw new Error(res.error.message);
        }

        allData = allData.concat(res.data);

        url = res.paging?.next
            ? res.paging.next.replace("https://graph.facebook.com/v21.0", "")
            : "";
    }

    return allData;
}

async function fetchAllInsightsFull(
    campaignId: string,
    accessToken: string
): Promise<CampaignInsights["data"]> {
    let url = `/${campaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions,date_start&time_increment=1&limit=100&date_preset=maximum`;

    let allData: CampaignInsights["data"] = [];

    while (url) {
        const res = (await fetchMetaCron(url, accessToken)) as CampaignInsights | MetaError;

        if ("error" in res) {
            throw new Error(res.error.message);
        }

        allData = allData.concat(res.data);

        url = res.paging?.next
            ? res.paging.next.replace("https://graph.facebook.com/v21.0", "")
            : "";
    }

    return allData;
}