import { api } from "@/trpc/server";
import { SettingsOverview } from "@/app/_components/dashboard/settings/settings-overview";

export default function SettingsMetaPage() {
    void api.user.getSettings.prefetch();

    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <SettingsOverview />
            </div>
        </div>
    )
}