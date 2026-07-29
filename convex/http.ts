import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

declare const process: { env: Record<string, string | undefined> };

const http = httpRouter();
// Registers Convex Auth's routes, including the OAuth endpoints used by
// "Sign in with Viktor": /api/auth/signin/viktor and /api/auth/callback/viktor.
auth.addHttpRoutes(http);

/**
 * Webhook pesan masuk dari gateway WhatsApp (WAHA / Fonnte).
 * Divalidasi dengan header `x-webhook-secret` = env `WA_WEBHOOK_SECRET`.
 *
 * Payload yang didukung:
 *  - WAHA:   { event: "message", payload: { from: "628xx@c.us", body: "..." } }
 *  - Fonnte: { sender: "628xx", message: "..." }
 */
http.route({
  path: "/wa/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.WA_WEBHOOK_SECRET;
    if (secret && request.headers.get("x-webhook-secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const payload = (body.payload ?? body) as Record<string, unknown>;
    const rawFrom = String(
      payload.from ?? payload.sender ?? body.sender ?? "",
    ).split("@")[0];
    const text = String(payload.body ?? payload.message ?? body.message ?? "");
    if (!rawFrom || !text) {
      return Response.json({ ok: false, reason: "payload tidak lengkap" });
    }

    const result = await ctx.runMutation(
      internal.whatsapp.handleGatewayMessage,
      {
        phone: rawFrom,
        text,
      },
    );
    return Response.json({ ok: result.handled });
  }),
});

// Fonnte requires webhook URL to accept GET (used for verification)
http.route({
  path: "/wa/webhook",
  method: "GET",
  handler: httpAction(async () => {
    return Response.json({ status: "ok", app: "finyu", webhook: "active" });
  }),
});

http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () =>
    Response.json({ status: "ok", app: "finyu" }),
  ),
});

export default http;
