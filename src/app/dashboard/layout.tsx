import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";

export default async function RootDashboardLayout({
    children,
    header
}: Readonly<{
    children: React.ReactNode;
    header: React.ReactNode;
}>) {
    const session = await auth();

    if(!session?.user) {
        return redirect("/login");
    }

    void api.user.getInfoForDashboard.prefetch();
    void api.user.getAdAccounts.prefetch({});

    return (
        <SidebarProvider
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                {header}
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}