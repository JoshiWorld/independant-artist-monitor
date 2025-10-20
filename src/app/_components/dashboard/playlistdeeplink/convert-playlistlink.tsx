"use client";

import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
    playlistUri: z.string().url(),
    trackUri: z.string().url(),
})

export function ConvertPlaylistDeeplink() {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            playlistUri: "",
            trackUri: ""
        }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        const deeplink = convertToPlaylistDeeplink(values.playlistUri, values.trackUri);
        if(deeplink) {
            await navigator.clipboard.writeText(deeplink);
            toast.success("Deeplink wurde kopiert", { description: deeplink });
        } else {
            toast.error("Ungültige Links angegeben.");
        }
    }

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 justify-center items-center">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-3xl space-y-8">
                    <div className="mt-5 flex items-center justify-between gap-5">
                        <FormField 
                            control={form.control}
                            name="playlistUri"
                            render={({ field }) => (
                                <FormItem className="grow">
                                    <FormLabel>Playlist Link</FormLabel>
                                    <FormControl>
                                        <Input type="url" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Link zur Spotify-Playlist
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="trackUri"
                            render={({ field }) => (
                                <FormItem className="grow">
                                    <FormLabel>Track Link</FormLabel>
                                    <FormControl>
                                        <Input type="url" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Link zum Spotify-Track
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex justify-center gap-5">
                        <Button type="submit" className="flex-1 cursor-pointer active:scale-95 transition-transform duration-150">
                            Deeplink konvertieren & kopieren
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

function convertToPlaylistDeeplink(playlistLink: string, playlistTrackLink: string): string | null {
    try {
        const playlistUrl = new URL(playlistLink);
        const trackUrl = new URL(playlistTrackLink);

        // Playlist-ID extrahieren
        const playlistMatch = /playlist\/([a-zA-Z0-9]+)/.exec(playlistUrl.pathname);
        if (!playlistMatch) return null;
        const playlistId = playlistMatch[1];

        // Track-ID extrahieren
        const trackMatch = /track\/([a-zA-Z0-9]+)/.exec(trackUrl.pathname);
        if (!trackMatch) return null;
        const trackId = trackMatch[1];

        // Basis-URL vom Track übernehmen (inkl. evtl. /intl-de/)
        const basePath = trackUrl.pathname.startsWith("/intl-")
            ? trackUrl.pathname
            : `/track/${trackId}`;

        // si-Parameter aus Playlist-Link nehmen
        const siParam = playlistUrl.searchParams.get("si");

        // Neuen Link bauen
        const newUrl = new URL(`https://open.spotify.com${basePath}`);
        newUrl.searchParams.set("context", `spotify:playlist:${playlistId}`);
        if (siParam) {
            newUrl.searchParams.set("si", siParam);
        }

        return newUrl.toString();
    } catch (err) {
        console.error("Ungültige Links:", err);
        return null;
    }
}