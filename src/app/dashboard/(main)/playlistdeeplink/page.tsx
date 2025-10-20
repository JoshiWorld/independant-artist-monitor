import { ConvertPlaylistDeeplink } from "@/app/_components/dashboard/playlistdeeplink/convert-playlistlink";

export default function PlaylistDeeplinkMainPage() {

    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <ConvertPlaylistDeeplink />
            </div>
        </div>
    )
}