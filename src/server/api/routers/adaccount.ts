import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const adAccountRouter = createTRPCRouter({
    getDashboardCampaigns: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const campaings = await ctx.db.campaign.findMany({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id,
                    },
                    id: input.id
                }
            },
            select: {
                id: true,
                name: true,
                status: true,
                greenMax: true,
                yellowMax: true,
                account: {
                    select: {
                        id: true,
                        name: true,
                        user: {
                            select: {
                                greenMax: true,
                                yellowMax: true,
                            }
                        }
                    }
                },
                metrics: {
                    select: {
                        convPrice: true,
                        clicks: true,
                        impressions: true,
                        cpc: true,
                        ctr: true,
                        spend: true,
                        conversions: true,
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["adAccounts", "campaigns", input.id]
            }
        });

        return campaings.map((c) => {
            const avgConvPrice =
                c.metrics.length > 0
                    ? c.metrics.reduce((sum, m) => sum + m.convPrice, 0) / c.metrics.length
                    : null;
            const avgCpc = c.metrics.length > 0 ? c.metrics.reduce((sum, m) => sum + m.cpc, 0) / c.metrics.length : null;
            const totalClicks = c.metrics.length > 0 ? c.metrics.reduce((sum, m) => sum + m.clicks, 0) : null;
            const totalImpressions = c.metrics.length > 0 ? c.metrics.reduce((sum, m) => sum + m.impressions, 0) : null;
            const totalSpend = c.metrics.length > 0 ? c.metrics.reduce((sum, m) => sum + m.spend, 0) : null;
            const totalConversions = c.metrics.length > 0 ? c.metrics.reduce((sum, m) => sum + m.conversions, 0) : null;
            // const ctr = totalImpressions && totalClicks ? (totalClicks / totalImpressions) * 100 : null;
            const avgCtr = c.metrics.length > 0 ? c.metrics.reduce((sum, m) => sum + m.ctr, 0) / c.metrics.length : null;

            const greenMax = c.greenMax ?? c.account.user.greenMax ?? 0.5;
            const yellowMax = c.yellowMax ?? c.account.user.yellowMax ?? 0.59;

            const status = avgConvPrice !== null ? (avgConvPrice < greenMax ? "GREEN" : avgConvPrice <= yellowMax ? "YELLOW" : "RED") : "GRAY";

            return {
                id: c.id,
                accId: c.account.id,
                name: c.name,
                status: c.status,
                accountName: c.account.name,
                convPrice: avgConvPrice,
                cpc: avgCpc,
                clicks: totalClicks,
                impressions: totalImpressions,
                ctr: avgCtr,
                spend: totalSpend,
                conversions: totalConversions,
                performanceStatus: status,
                greenMax: c.greenMax,
                yellowMax: c.yellowMax,
            };
        });
    }),

    getName: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
        return ctx.db.adAccount.findUnique({
            where: {
                user: {
                    id: ctx.session.user.id
                },
                id: input.id
            },
            select: {
                name: true,
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["adAccounts", input.id]
            }
        });
    })
})