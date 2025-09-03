import { env } from "@/env";
import { NextResponse } from "next/server";

export async function GET() {
    const META_APP_ID = env.FACEBOOK_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${env.NEXTAUTH_URL}/dashboard/meta/callback`);

    // Erstelle die Meta-Login-URL
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=ads_read,business_management,read_insights`;

    // Umleiten zur Login-Seite von Meta
    return NextResponse.redirect(authUrl);
}