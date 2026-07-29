import "./authEnv";
import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { configuredAuthProviders } from "./viktorSpaceAuthConfig";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, ...configuredAuthProviders()],
});

export const googleSignInEnabled = query({
  args: {},
  handler: async () =>
    Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
});

export const currentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
