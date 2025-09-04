"use client";

import { useState } from "react";
import { CampaignCards, CampaignCardsSecondary } from "./campaign-cards";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRangeIcon } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch"
import { motion, AnimatePresence } from "framer-motion"
import { CampaignChart } from "./campaign-chart";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export function CampaignOverview({ accId, campaignId, initDates }: { accId: string; campaignId: string; initDates: DateRange }) {
    const [dateSwitch, setDateSwitch] = useState<boolean>(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(initDates);

    const initCampaignData = api.meta.syncCampaignInsights.useMutation({
        onSuccess: () => {
            toast.success("Kampagne erfolgreich neu initialisiert");
        },
        onError: (error) => {
            toast.error("Fehler beim Initialisieren der Kampagne", { description: error.message });
            console.error("Fehler beim Initialisieren der Kampagne:", error);
        } 
    })

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Button onClick={() => initCampaignData.mutate({ campaignId, lifetime: true })}>Kampagne neu initialisieren</Button>
            <SelectDateRange dateRange={dateRange} setDateRange={setDateRange} dateSwitch={dateSwitch} setDateSwitch={setDateSwitch} />
            <CampaignCards accId={accId} campaignId={campaignId} dateRange={dateRange} />
            <CampaignCardsSecondary accId={accId} campaignId={campaignId} dateRange={dateRange} />
            <div className="px-4 lg:px-6">
                <CampaignChart accId={accId} campaignId={campaignId} dateRange={dateRange} />
            </div>
            {/* <DashboardTable /> */}
        </div>
    )
}

function SelectDateRange({ dateRange, setDateRange, dateSwitch, setDateSwitch }: { dateRange: DateRange | undefined; setDateRange: (value: DateRange | undefined) => void; dateSwitch: boolean; setDateSwitch: (value: boolean) => void }) {
    function normalizeRange(range: DateRange | undefined): DateRange | undefined {
        if (!range?.from || !range?.to) return range;
        return range.from <= range.to
            ? range
            : { from: range.to, to: range.from }; // swap if reversed
    }

    return (
        <div className="flex flex-col justify-center items-center gap-3">
            <div className="flex justify-center gap-3">
                <Label htmlFor="dateSwitch" className="text-right">
                    Benutzerdefinierter Zeitraum
                </Label>
                <Switch id="dateSwitch" checked={dateSwitch} onCheckedChange={(checked) => {
                    setDateSwitch(checked);
                    if(!checked) {
                        setDateRange(undefined);
                    }
                }} />
            </div>
            <AnimatePresence>
                {dateSwitch && (
                    <motion.div 
                        key="dateRangeDiv"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden flex justify-center gap-3"
                    >
                        {/* <Label htmlFor="dateRange" className="text-right">
                            Zeitraum
                        </Label> */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="dateRange" variant="outline" className={cn(
                                    "w-[280px] justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground",
                                )}>
                                    <CalendarRangeIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                                {format(dateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Zeitraum auswählen</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="range"
                                    defaultMonth={dateRange?.from ?? new Date()}
                                    selected={dateRange}
                                    onSelect={(range) => {
                                        setDateRange(normalizeRange(range));
                                    }}
                                    className="rounded-lg border shadow-sm"
                                    disabled={{ after: new Date() }}
                                />
                            </PopoverContent>
                        </Popover>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}