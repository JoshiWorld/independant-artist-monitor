import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const campaignRouter = createTRPCRouter({
    update: protectedProcedure.input(z.object({
        id: z.string(),
        greenMax: z.number().nullable(),
        yellowMax: z.number().nullable()
    })).mutation(({ ctx, input }) => {
        return ctx.db.campaign.update({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id
                    }
                },
                id: input.id
            },
            data: {
                greenMax: input.greenMax,
                yellowMax: input.yellowMax
            }
        });
    }),

    getTableCellChart: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const campaign = await ctx.db.campaign.findUnique({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id
                    }
                },
                id: input.id
            },
            select: {
                metrics: {
                    where: {
                        date: {
                            gte: new Date(new Date().setDate(new Date().getDate() - 14)) // last 14 days
                        }
                    },
                    select: {
                        date: true,
                        convPrice: true,
                    }
                }
            }
        });

        if(!campaign) {
            throw new TRPCError({ message: "Kampagne konnte nicht gefunden werden", code: "BAD_REQUEST" });
        }

        const stats: { date: string; convPrice: number }[] = [];
        const dateMap: Record<string, number> = {};
        const today = new Date();
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            stats.push({ date: dateString!, convPrice: 0 });
            dateMap[dateString!] = stats.length - 1;
        }

        for (const metric of campaign.metrics) {
            const dateString = metric.date.toISOString().split('T')[0];
            if (dateMap[dateString!] !== undefined) {
                stats[dateMap[dateString!]!]!.convPrice = metric.convPrice;
            }
        }

        return stats;
    }),

    getCampaignStatsCards: protectedProcedure.input(z.object({ accId: z.string(), campaignId: z.string(), from: z.date().optional(), to: z.date().optional() })).query(async ({ ctx, input }) => {
        const campaign = await ctx.db.campaign.findUnique({
            where: {
                account: {
                    id: input.accId,
                    user: {
                        id: ctx.session.user.id
                    }
                },
                id: input.campaignId
            },
            select: {
                greenMax: true,
                yellowMax: true,
                account: {
                    select: {
                        user: {
                            select: {
                                greenMax: true,
                                yellowMax: true,
                            }
                        }
                    }
                },
                metrics: {
                    where: input.from && input.to ? {
                        date: {
                            gte: input.from,
                            lte: input.to
                        }
                    } : {},
                    select: {
                        convPrice: true,
                        cpc: true,
                        ctr: true,
                    }
                }
            }
        });

        if (!campaign) {
            throw new TRPCError({ message: "Kampagne wurde nicht gefunden", code: "BAD_REQUEST" });
        }

        const avgConvPrice =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.convPrice, 0) / campaign.metrics.length
                : 0;
        const avgCpc =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.cpc, 0) / campaign.metrics.length
                : 0;
        const avgCtr =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.ctr, 0) / campaign.metrics.length
                : 0;
        
        const greenMax = campaign.greenMax ?? campaign.account.user.greenMax ?? 0.5;
        const yellowMax = campaign.yellowMax ?? campaign.account.user.yellowMax ?? 0.59;

        const status = avgConvPrice !== null ? (avgConvPrice < greenMax ? "GREEN" : avgConvPrice <= yellowMax ? "YELLOW" : "RED") : "GRAY";

        return {
            convPrice: Number(avgConvPrice.toFixed(2)),
            performance: status,
            cpc: Number(avgCpc.toFixed(2)),
            ctr: Number(avgCtr.toFixed(2)),
        }
    }),

    getCampaignStatsCardsSecondary: protectedProcedure.input(z.object({ accId: z.string(), campaignId: z.string(), from: z.date().optional(), to: z.date().optional() })).query(async ({ ctx, input }) => {
        const campaign = await ctx.db.campaign.findUnique({
            where: {
                account: {
                    id: input.accId,
                    user: {
                        id: ctx.session.user.id
                    }
                },
                id: input.campaignId
            },
            select: {
                metrics: {
                    where: input.from && input.to ? {
                        date: {
                            gte: input.from,
                            lte: input.to
                        }
                    } : {},
                    select: {
                        clicks: true,
                        conversions: true,
                        impressions: true,
                        spend: true,
                    }
                }
            }
        });

        if (!campaign) {
            throw new TRPCError({ message: "Kampagne wurde nicht gefunden", code: "BAD_REQUEST" });
        }

        const sumClicks =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.clicks, 0)
                : 0;
        const sumConversions =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.conversions, 0)
                : 0;
        const sumImpressions =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.impressions, 0)
                : 0;
        const sumSpend =
            campaign.metrics.length > 0
                ? campaign.metrics.reduce((sum, m) => sum + m.spend, 0)
                : 0;

        return {
            clicks: sumClicks,
            conversions: sumConversions,
            impressions: sumImpressions,
            spend: Number(sumSpend.toFixed(2))
        }
    }),

    getCampaignStatsChart: protectedProcedure.input(z.object({ accId: z.string(), campaignId: z.string(), from: z.date().optional(), to: z.date().optional() })).query(async ({ ctx, input }) => {
        const campaign = await ctx.db.campaign.findUnique({
            where: {
                account: {
                    id: input.accId,
                    user: {
                        id: ctx.session.user.id
                    }
                },
                id: input.campaignId
            },
            select: {
                metrics: {
                    where: input.from && input.to ? {
                        date: {
                            gte: input.from,
                            lte: input.to
                        }
                    } : {},
                    select: {
                        convPrice: true,
                        date: true,
                    }
                }
            }
        });

        if(!campaign) {
            throw new TRPCError({ message: "Kampagne wurde nicht gefunden", code: "BAD_REQUEST" });
        }

        if (!campaign.metrics || campaign.metrics.length === 0) {
            return [];
        }

        const dateMap: Record<string, { sum: number; count: number }> = {};

        for (const metric of campaign.metrics) {
            const dateString = metric.date.toISOString().split("T")[0]!;
            dateMap[dateString] ??= { sum: 0, count: 0 };
            dateMap[dateString].sum += metric.convPrice ?? 0;
            dateMap[dateString].count += 1;
        }

        // Durchschnitt berechnen
        const stats = Object.entries(dateMap).map(([date, { sum, count }]) => ({
            date,
            convPrice: count > 0 ? sum / count : 0,
        }));

        // Sortieren nach Datum
        stats.sort((a, b) => a.date.localeCompare(b.date));

        return stats;
    }),

    getName: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
        return ctx.db.campaign.findUnique({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id
                    }
                },
                id: input.id
            },
            select: {
                name: true,
            }
        });
    })

    // getCampaignStatsCards2: protectedProcedure.input(z.object({ accId: z.string(), campaignId: z.string(), from: z.date().optional(), to: z.date().optional() })).query(async ({ ctx, input }) => {
    //     const user = await ctx.db.user.findUnique({
    //         where: {
    //             id: ctx.session.user.id
    //         },
    //         select: {
    //             yellowMax: true,
    //             greenMax: true,
    //         }
    //     });

    //     const campaign = await ctx.db.campaign.findUnique({
    //         where: {
    //             account: {
    //                 id: input.accId,
    //                 user: {
    //                     id: ctx.session.user.id
    //                 }
    //             },
    //             id: input.campaignId
    //         },
    //         select: {
    //             status: true,
    //             greenMax: true,
    //             yellowMax: true,
    //             name: true,
    //             metrics: {
    //                 where: input.from && input.to ? {
    //                     date: {
    //                         gte: input.from,
    //                         lte: input.to
    //                     }
    //                 } : {},
    //                 select: {
    //                     clicks: true,
    //                     conversions: true,
    //                     convPrice: true, // done
    //                     cpc: true, //done
    //                     ctr: true, //done
    //                     impressions: true,
    //                     spend: true,
    //                     date: true,
    //                 }
    //             }
    //         }
    //     });

    //     if(!campaign) {
    //         throw new TRPCError({ message: "Kampagne wurde nicht gefunden", code: "BAD_REQUEST" });
    //     }



    //     return {
    //         activeCampaigns: 0,
    //         warningCampaigns: 0,
    //         criticalCampaigns: 0,
    //     }
    // }),
})