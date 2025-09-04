"use client";

import { LoadingDots } from "@/components/ui/loading";
import { api } from "@/trpc/react";
import { IconBrandMeta } from "@tabler/icons-react";

export function SettingsOverview() {
    const { data: user } = api.user.getSettings.useQuery();

    if (!user) return <LoadingDots />;

    const daysLeft = daysUntilExpiry(
        user.metaTokenExpiry ? new Date(user.metaTokenExpiry) : null
    );

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 justify-center items-center">
            <div className="relative">
                <IconBrandMeta className="cursor-pointer text-blue-500 transition hover:text-blue-700" />
                {user.metaAccessToken ? (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                        ✓
                    </span>
                ) : (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        ✕
                    </span>
                )}
            </div>
            {user.metaAccessToken ? (
                <p>Meta-Account ist verknüpft</p>
            ) : (
                <p>Meta-Account ist nicht verknüpft</p>
            )}
            {daysLeft !== null ? (
                <p>Token erneuern in: {daysLeft} Tag{daysLeft === 1 ? "" : "en"}</p>
            ) : (
                <p>Kein Ablaufdatum vorhanden</p>
            )}
        </div>
    )
}

function daysUntilExpiry(expiry: Date | null): number | null {
    if (!expiry) return null;
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))); // in Tagen
}