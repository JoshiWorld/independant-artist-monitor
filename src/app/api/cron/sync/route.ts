import { env } from "@/env";
import { db } from "@/server/db";
import { api } from "@/trpc/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
        return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
    }

    // const campaigns = await db.campaign.findMany({
    //     where: {
    //         account: {
    //             user: {
    //                 id: process.env.TEST_USER_ID
    //             }
    //         }
    //     },
    //     select: {
    //         id: true,
    //         account: {
    //             select: {
    //                 user: {
    //                     select: {
    //                         metaAccessToken: true,
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // });
    // for (const campaign of campaigns) {
    //     await api.meta.syncCampaignInsightsFull({
    //         campaignId: campaign.id,
    //         accessToken: campaign.account.user.metaAccessToken!,
    //     });
    // }

    // return NextResponse.json({ message: "Sync done" }, { status: 200 });

    try {
        const usersWithToken = await db.user.findMany({
            where: {
                metaAccessToken: {
                    not: null
                }
            },
            select: {
                id: true,
                metaAccessToken: true,
                adAccounts: {
                    select: {
                        id: true,
                        campaigns: {
                            select: {
                                id: true,
                            }
                        }
                    }
                }
            }
        });

        // const campaigns = await db.campaign.findMany({
        //     where: {
        //         account: {
        //             user: {
        //                 metaAccessToken: {
        //                     not: null
        //                 }
        //             }
        //         }
        //     },
        //     select: {
        //         id: true,
        //         account: {
        //             select: {
        //                 user: {
        //                     select: {
        //                         metaAccessToken: true,
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // });

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        for (const user of usersWithToken) {
            if (!user.metaAccessToken) continue;

            await api.meta.syncAdAccountsCron({ accessToken: user.metaAccessToken, userId: user.id });
            await api.meta.syncCampaignsCron({ accessToken: user.metaAccessToken, userId: user.id });

            for (const campaign of user.adAccounts.flatMap(acc => acc.campaigns)) {
                await api.meta.syncCampaignInsightsCron({
                    since: yesterday.toISOString().split('T')[0]!,
                    until: today.toISOString().split('T')[0]!,
                    campaignId: campaign.id,
                    accessToken: user.metaAccessToken
                });
            }
        }

        return NextResponse.json({ message: "Sync done" }, { status: 200 });
    } catch (error) {
        console.error("[CRON][SYNC] Error during sync:", error);
        return NextResponse.json({ message: "Error during sync" }, { status: 500 });
    }
}