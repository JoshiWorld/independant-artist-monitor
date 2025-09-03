import type { CampaignStatus } from "@prisma/client";

export type AdAccount = {
    data: { id: string; name: string }[];
    paging: { cursors: { before: string; after: string } };
}

export type Campaign = {
    data: { id: string; name: string; status: CampaignStatus; created_time: Date }[];
    paging: { cursors: { before: string; after: string } };
}

export type CampaignInsights = {
    data: {
        impressions: string;
        clicks: string;
        spend: string;
        ctr: string;
        cpc: string;
        actions: { action_type: string; value: string }[];
        date_start?: string;
        date_stop?: string;
    }[];
    paging: { cursors: { before: string; after: string } };
}

export type TokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
}