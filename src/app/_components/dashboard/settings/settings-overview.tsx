"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoadingDots } from "@/components/ui/loading";
import { api } from "@/trpc/react";
import { IconBrandMeta, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
    greenMax: z.number(),
    yellowMax: z.number(),
})

export function SettingsOverview() {
    const utils = api.useUtils();
    const { data: user } = api.user.getSettings.useQuery();

    const updateUser = api.user.update.useMutation({
        onSuccess: async () => {
            await utils.user.getSettings.invalidate();
            toast.success("Einstellungen erfolgreich gespeichert.");
        },
        onError: (error) => {
            toast.error("Fehler beim Speichern der Einstellungen", { description: error.message });
            console.error("Fehler beim Speichern der Einstellungen:", error);
        }
    })

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            greenMax: 0,
            yellowMax: 0
        }
    });

    useEffect(() => {
        if(user) {
            form.setValue("greenMax", user.greenMax);
            form.setValue("yellowMax", user.yellowMax);
        }
    }, [user, form]);

    if (!user) return <LoadingDots />;

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        updateUser.mutate({ greenMax: values.greenMax, yellowMax: values.yellowMax });
    }

    const daysLeft = daysUntilExpiry(
        user.metaTokenExpiry ? new Date(user.metaTokenExpiry) : null
    );

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 justify-center items-center">
            <MetaDialog tokenExists={!!user.metaAccessToken} />
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

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="mt-5 flex items-center justify-between gap-5">
                        <FormField 
                            control={form.control}
                            name="greenMax"
                            render={({ field }) => (
                                <FormItem className="grow">
                                    <FormLabel>Grün Max.</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Maximaler Wert für grüne Ampel
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="yellowMax"
                            render={({ field }) => (
                                <FormItem className="grow">
                                    <FormLabel>Gelber Max.</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Maximaler Wert für gelbe Ampel
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex justify-center gap-5">
                        <Button type="submit" disabled={updateUser.isPending} className="flex-1">
                            <IconRefresh className={updateUser.isPending ? "animate-spin" : ""} />
                            {updateUser.isPending ? "Speichern..." : "Speichern"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

function MetaDialog({ tokenExists }: { tokenExists: boolean }) {
    const router = useRouter();

    const removeMetaAccess = api.user.removeMetaAccess.useMutation({
        onSuccess: () => {
            toast.success("Meta-Access wurde erfolgreich entfernt");
        },
        onError: (error) => {
            console.error("Fehler beim Entfernen vom Meta-Access:", error);
            toast.error("Fehler beim Entfernen vom Meta-Access", { description: error.message })
        }
    });

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="relative">
                    <IconBrandMeta className="cursor-pointer text-blue-500 transition hover:text-blue-700" />
                    {tokenExists ? (
                        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                            ✓
                        </span>
                    ) : (
                        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                            ✕
                        </span>
                    )}
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Meta Verknüpfung</DialogTitle>
                    <DialogDescription>Willst du deine Meta-Verknüpfung erneuern oder entfernen?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="destructive" onClick={() => removeMetaAccess.mutate()}>
                            <IconTrash />
                            Zugriff entfernen
                        </Button>
                    </DialogClose>
                    <Button onClick={() => router.push("/api/meta/login")}>
                        <IconRefresh />
                        Zugriff erneuern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function daysUntilExpiry(expiry: Date | null): number | null {
    if (!expiry) return null;
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))); // in Tagen
}