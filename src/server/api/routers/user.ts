import { env } from "@/env";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import type { TokenResponse } from "@/types/meta";
import { subDays } from "date-fns";

export const userRouter = createTRPCRouter({
    getInfoForDashboard: protectedProcedure.query(({ ctx }) => {
        return ctx.db.user.findUnique({
            where: {
                id: ctx.session.user.id,
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["users", ctx.session.user.id]
            }
        });
    }),

    getAdAccounts: protectedProcedure.input(z.object({ name: z.string().optional() })).query(async ({ ctx, input }) => {
        if (input.name) {
            return ctx.db.adAccount.findMany({
                where: {
                    user: {
                        id: ctx.session.user.id,
                    },
                    name: {
                        contains: input.name,
                        mode: "insensitive",
                    }
                },
                select: {
                    id: true,
                    name: true,
                },
                cacheStrategy: {
                    ttl: 60 * 60 * 24, // 24 Stunden
                    tags: ["adAccounts"]
                }
            });
        }

        return ctx.db.adAccount.findMany({
            where: {
                user: {
                    id: ctx.session.user.id,
                }
            },
            select: {
                id: true,
                name: true,
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["adAccounts"]
            }
        });
    }),

    getDashboardStatsCards: protectedProcedure.query(async ({ ctx }) => {
        const user = await ctx.db.user.findUnique({
            where: {
                id: ctx.session.user.id
            },
            select: {
                yellowMax: true,
                greenMax: true,
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["users", ctx.session.user.id]
            }
        });

        const campaigns = await ctx.db.campaign.findMany({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id,
                    }
                },
                status: "ACTIVE"
            },
            select: {
                id: true,
                greenMax: true,
                yellowMax: true,
                name: true,
                status: true,
                metrics: {
                    where: {
                        date: {
                            gte: new Date(new Date().setDate(new Date().getDate() - 3)) // last 3 days
                        }
                    },
                    select: {
                        convPrice: true,
                    }
                }
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["campaigns"]
            }
        });

        let warningCount = 0;
        let criticalCount = 0;

        for (const campaign of campaigns) {
            let greenMax = campaign.greenMax;
            let yellowMax = campaign.yellowMax;

            greenMax ??= user?.greenMax ?? 0.5;
            yellowMax ??= user?.yellowMax ?? 0.59;

            const avgConvPrice =
                campaign.metrics.reduce((sum, m) => sum + m.convPrice, 0) /
                campaign.metrics.length;

            if (avgConvPrice >= greenMax && avgConvPrice <= yellowMax) {
                warningCount++;
            } else if (avgConvPrice > yellowMax) {
                criticalCount++;
            }
        }

        return {
            activeCampaigns: campaigns.length,
            warningCampaigns: warningCount,
            criticalCampaigns: criticalCount,
        }
    }),

    getDashboardStatsChart: protectedProcedure.query(async ({ ctx }) => {
        const campaigns = await ctx.db.campaign.findMany({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id,
                    }
                },
                status: "ACTIVE"
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
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["campaigns"]
            }
        });

        type Stat = { date: string; sum: number; count: number; convPrice: number };

        const stats: Stat[] = [];
        const dateMap: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split("T")[0]!;
            stats.push({ date: dateString, sum: 0, count: 0, convPrice: 0 });
            dateMap[dateString] = stats.length - 1;
        }

        for (const campaign of campaigns) {
            for (const metric of campaign.metrics) {
                const dateString = metric.date.toISOString().split("T")[0]!;
                const idx = dateMap[dateString];
                if (idx !== undefined) {
                    stats[idx]!.sum += metric.convPrice ?? 0;
                    stats[idx]!.count += 1;
                }
            }
        }

        for (const s of stats) {
            s.convPrice = s.count > 0 ? s.sum / s.count : 0;
        }

        return stats;
    }),

    getDashboardCampaigns: protectedProcedure.query(async ({ ctx }) => {
        const campaings = await ctx.db.campaign.findMany({
            where: {
                account: {
                    user: {
                        id: ctx.session.user.id,
                    }
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
                        date: true,
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["campaigns"]
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

            const avgConvPriceLast3Days = c.metrics.length > 0 ? c.metrics.filter((m) => m.date >= subDays(new Date(), 3)).reduce((sum, m) => sum + m.convPrice, 0) / c.metrics.filter((m) => m.date >= subDays(new Date(), 3)).length : null;

            const status = avgConvPriceLast3Days !== null && avgConvPriceLast3Days > 0 ? (avgConvPriceLast3Days < greenMax ? "GREEN" : avgConvPriceLast3Days <= yellowMax ? "YELLOW" : "RED") : "GRAY";

            const dataToReturn = {
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
            
            return dataToReturn;
        });
    }),

    setMetaAccessToken: protectedProcedure.input(z.object({ code: z.string() })).mutation(async ({ ctx, input }) => {
        const redirect_uri = `${env.NEXTAUTH_URL}/dashboard/meta/callback`;

        const tokenResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${env.FACEBOOK_CLIENT_ID}&redirect_uri=${redirect_uri}&client_secret=${env.FACEBOOK_CLIENT_SECRET}&code=${input.code}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
            next: { revalidate: 0 }
        });

        if (!tokenResponse.ok) {
            console.error("Fehler beim Abrufen des Access Tokens:", tokenResponse.statusText);
            throw new Error(`Fehler beim Abrufen des Access Tokens: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json() as TokenResponse;
        const longLivedAccessTokenRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.FACEBOOK_CLIENT_ID}&client_secret=${env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${tokenData.access_token}`,
        );

        if (!longLivedAccessTokenRes.ok) {
            console.error("Fehler beim Abrufen des Long Lived Tokens:", longLivedAccessTokenRes.statusText);
            throw new Error(`Fehler beim Abrufen des Long Lived Tokens: ${longLivedAccessTokenRes.statusText}`);
        }

        const longLivedToken = await longLivedAccessTokenRes.json() as TokenResponse;

        const updatedUser = await ctx.db.user.update({
            where: {
                id: ctx.session.user.id
            },
            data: {
                metaAccessToken: longLivedToken.access_token,
                metaTokenExpiry: new Date(Date.now() + longLivedToken.expires_in * 1000), // expires_in is in seconds
            },
        });

        await ctx.db.$accelerate.invalidate({
            tags: [ctx.session.user.id]
        })

        return { success: true, user: updatedUser };
    }),

    getSettings: protectedProcedure.query(({ ctx }) => {
        return ctx.db.user.findUnique({
            where: {
                id: ctx.session.user.id
            },
            select: {
                metaAccessToken: true,
                metaTokenExpiry: true,
                greenMax: true,
                yellowMax: true,
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["users", ctx.session.user.id]
            }
        });
    }),

    getMetaTokenExpiry: protectedProcedure.query(({ ctx }) => {
        return ctx.db.user.findUnique({
            where: {
                id: ctx.session.user.id
            },
            select: {
                metaTokenExpiry: true,
            },
            cacheStrategy: {
                ttl: 60 * 60 * 24, // 24 Stunden
                tags: ["users", ctx.session.user.id]
            }
        });
    }),

    removeMetaAccess: protectedProcedure.mutation(async ({ ctx }) => {
        const updatedUser = ctx.db.user.update({
            where: {
                id: ctx.session.user.id
            },
            data: {
                metaAccessToken: null,
                metaTokenExpiry: null
            },
        });

        await ctx.db.$accelerate.invalidate({
            tags: [ctx.session.user.id]
        })

        return updatedUser;
    }),

    removeMetaData: protectedProcedure.mutation(async ({ ctx }) => {
        const deletedData = await ctx.db.adAccount.deleteMany({
            where: {
                user: {
                    id: ctx.session.user.id
                }
            },
        });

        await ctx.db.$accelerate.invalidate({
            tags: ["adAccounts", "campaigns", "campaignInsights"]
        })

        return deletedData;
    }),

    update: protectedProcedure.input(z.object({ greenMax: z.number(), yellowMax: z.number() })).mutation(async ({ ctx, input }) => {
        const updatedUser = await ctx.db.user.update({
            where: {
                id: ctx.session.user.id
            },
            data: {
                greenMax: input.greenMax,
                yellowMax: input.yellowMax
            }
        });

        await ctx.db.$accelerate.invalidate({
            tags: [ctx.session.user.id, "campaigns", "campaignInsights"]
        })

        return updatedUser;
    })
})