import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { metaRouter } from "./routers/meta";
import { userRouter } from "./routers/user";
import { campaignRouter } from "./routers/campaign";
import { adAccountRouter } from "./routers/adaccount";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  meta: metaRouter,
  user: userRouter,
  campaign: campaignRouter,
  adAccount: adAccountRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
