import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { notify, requireUserId, writeAudit } from "./lib";
import { collabRole } from "./schema";

/** Anggota yang aku undang + akun yang membagikan datanya ke aku. */
export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const invited = await ctx.db
      .query("collaborators")
      .withIndex("by_owner", q => q.eq("ownerId", userId))
      .collect();
    const sharedWithMe = await ctx.db
      .query("collaborators")
      .withIndex("by_member", q => q.eq("memberUserId", userId))
      .collect();

    const members = await Promise.all(
      invited.map(async row => {
        const memberUser = row.memberUserId
          ? await ctx.db.get(row.memberUserId)
          : null;
        return {
          id: row._id,
          email: row.inviteEmail,
          name: memberUser?.name ?? null,
          role: row.role,
          status: row.status,
          invitedAt: row.invitedAt,
          acceptedAt: row.acceptedAt ?? null,
        };
      }),
    );

    const shares = await Promise.all(
      sharedWithMe
        .filter(row => row.status === "accepted")
        .map(async row => {
          const owner = await ctx.db.get(row.ownerId);
          const profile = await ctx.db
            .query("profiles")
            .withIndex("by_user", q => q.eq("userId", row.ownerId))
            .unique();
          return {
            id: row._id,
            ownerId: row.ownerId,
            ownerName:
              profile?.fullName ?? owner?.name ?? owner?.email ?? "Akun",
            ownerEmail: owner?.email ?? "",
            role: row.role,
          };
        }),
    );

    return { members, shares };
  },
});

export const invite = mutation({
  args: { email: v.string(), role: collabRole },
  returns: v.null(),
  handler: async (ctx, { email, role }) => {
    const userId = await requireUserId(ctx);
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
      throw new Error("Format email tidak valid");
    const me = await ctx.db.get(userId);
    if (me?.email?.toLowerCase() === clean)
      throw new Error("Tidak perlu mengundang diri sendiri");

    const existing = await ctx.db
      .query("collaborators")
      .withIndex("by_owner", q => q.eq("ownerId", userId))
      .collect();
    if (existing.some(r => r.inviteEmail === clean && r.status !== "revoked"))
      throw new Error("Email ini sudah diundang");

    // Kalau akunnya sudah ada, langsung aktif (tanpa email undangan).
    const users = await ctx.db.query("users").collect();
    const target = users.find(u => u.email?.toLowerCase() === clean);

    await ctx.db.insert("collaborators", {
      ownerId: userId,
      inviteEmail: clean,
      memberUserId: target?._id,
      role,
      status: target ? "accepted" : "pending",
      invitedAt: Date.now(),
      acceptedAt: target ? Date.now() : undefined,
    });
    if (target) {
      await notify(
        ctx,
        target._id,
        "Kamu diundang berkolaborasi",
        `${me?.name ?? me?.email ?? "Seseorang"} membagikan data keuangannya (${role === "editor" ? "bisa edit" : "lihat saja"}). Ganti akun lewat pemilih data di header.`,
        "collab",
      );
    }
    await writeAudit(ctx, userId, "collab_invite", `${clean} (${role})`);
    return null;
  },
});

export const updateRole = mutation({
  args: { id: v.id("collaborators"), role: collabRole },
  returns: v.null(),
  handler: async (ctx, { id, role }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.ownerId !== userId)
      throw new Error("Undangan tidak ditemukan");
    await ctx.db.patch(id, { role });
    return null;
  },
});

export const revoke = mutation({
  args: { id: v.id("collaborators") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.ownerId !== userId)
      throw new Error("Undangan tidak ditemukan");
    await ctx.db.delete(id);
    await writeAudit(ctx, userId, "collab_revoke", row.inviteEmail);
    return null;
  },
});
