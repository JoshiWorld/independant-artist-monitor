import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Login } from "../_components/login";

export default async function LoginPage() {
    const session = await auth();
    if(session?.user) return redirect('/dashboard');

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
            <Login />
        </div>
    )
}