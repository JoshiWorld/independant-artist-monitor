"use client";

import { Button } from "@/components/ui/button";
import { IconBrandGoogle } from "@tabler/icons-react";
import {
    signIn,
} from "next-auth/react";

export function Login() {
    return (
        <div className="flex max-w-md items-center justify-center">
            <Button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="relative z-10 flex w-full items-center justify-center rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition duration-200 hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:hover:shadow-xl md:text-sm">
                <IconBrandGoogle />
                <span className="text-sm font-semibold leading-6">Login</span>
            </Button>
        </div>
    )
}