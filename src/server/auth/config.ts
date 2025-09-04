import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
// import EmailProvider from "next-auth/providers/nodemailer";
// import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/server/db";
import { env } from "@/env";


/*
he signature '(config: NodemailerUserConfig): NodemailerConfig' of 'EmailProvider' is deprecated.ts(6387)
email.d.ts(5, 4): The declaration was marked as deprecated here.
(alias) EmailProvider(config: NodemailerUserConfig): NodemailerConfig
import EmailProvider
@deprecated
Import this provider from the providers/nodemailer submodule instead of providers/email.

To log in with nodemailer, change signIn("email") to signIn("nodemailer")
*/


/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    // EmailProvider({
    //   server: {
    //     host: String(env.EMAIL_SERVER_HOST),
    //     port: Number(env.EMAIL_SERVER_PORT),
    //     auth: {
    //       user: String(env.EMAIL_SERVER_USER),
    //       pass: String(env.EMAIL_SERVER_PASSWORD),
    //     },
    //   },
    //   from: `SmartSavvy <${process.env.EMAIL_FROM}>`,
    //   async generateVerificationToken() {
    //     return "ABCDEF";
    //   }
    // }),
    // FacebookProvider({
    //   clientId: String(env.FACEBOOK_CLIENT_ID),
    //   clientSecret: String(env.FACEBOOK_CLIENT_SECRET),
    // })
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  secret: env.AUTH_SECRET,
  adapter: PrismaAdapter(db),
  pages: {
    signIn: "/login"
  },
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        // id: process.env.TEST_USER_ID,
      },
    }),
    async signIn({ user }) {
      const users = await db.user.findMany({
        select: {
          email: true
        }
      });

      if(!users.find((u) => u.email === user.email)) return false; // Aktivieren für Login-Sperre
      return true;
    }
  },
} satisfies NextAuthConfig;
