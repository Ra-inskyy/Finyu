import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireEditScope, resolveScope } from "./lib";
import { categoryKind } from "./schema";

export const list = query({
  args: { ownerId: v.optional(v.id("users")), kind: v.optional(categoryKind) },
  handler: async (ctx, { ownerId, kind }) => {
    const scope = await resolveScope(ctx, ownerId);
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const filtered = rows.filter(r => !kind || r.kind === kind);
    return filtered
      .map(r => ({
        id: r._id,
        name: r.name,
        icon: r.icon,
        color: r.color,
        kind: r.kind,
        parentId: r.parentId ?? null,
        isDefault: r.isDefault,
        isArchived: r.isArchived,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  },
});

export const create = mutation({
  args: {
    ownerId: v.optional(v.id("users")),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    kind: categoryKind,
    parentId: v.optional(v.id("categories")),
  },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    const scope = await requireEditScope(ctx, args.ownerId);
    const name = args.name.trim();
    if (!name) throw new Error("Nama kategori wajib diisi");
    if (name.length > 50) throw new Error("Nama kategori maksimal 50 karakter");

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const duplicate = existing.some(
      c =>
        c.name.toLowerCase() === name.toLowerCase() &&
        (c.parentId ?? null) === (args.parentId ?? null) &&
        c.kind === args.kind,
    );
    if (duplicate) throw new Error("Nama kategori sudah dipakai");

    // Maksimal 2 level: sub-kategori tidak boleh punya anak.
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw new Error("Kategori induk tidak ditemukan");
      if (parent.parentId)
        throw new Error("Sub-kategori maksimal 2 tingkat kedalaman");
    }

    return await ctx.db.insert("categories", {
      userId: scope.ownerId,
      name,
      icon: args.icon ?? "tag",
      color: args.color ?? "#10B981",
      kind: args.kind,
      parentId: args.parentId,
      isDefault: false,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    const cat = await ctx.db.get(id);
    if (!cat) throw new Error("Kategori tidak ditemukan");
    await requireEditScope(ctx, cat.userId);
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) clean.name = patch.name.trim();
    if (patch.icon !== undefined) clean.icon = patch.icon;
    if (patch.color !== undefined) clean.color = patch.color;
    if (patch.isArchived !== undefined) clean.isArchived = patch.isArchived;
    await ctx.db.patch(id, clean);
    return null;
  },
});

/** Hapus kategori; kalau masih dipakai transaksi, diarsipkan saja. */
export const remove = mutation({
  args: { id: v.id("categories") },
  returns: v.object({ archived: v.boolean() }),
  handler: async (ctx, { id }) => {
    const cat = await ctx.db.get(id);
    if (!cat) throw new Error("Kategori tidak ditemukan");
    await requireEditScope(ctx, cat.userId);

    const used = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", q => q.eq("userId", cat.userId))
      .collect();
    const isUsed = used.some(
      t => t.categoryId === id || t.subCategoryId === id,
    );
    const children = await ctx.db
      .query("categories")
      .withIndex("by_parent", q => q.eq("parentId", id))
      .collect();

    if (isUsed) {
      await ctx.db.patch(id, { isArchived: true });
      return { archived: true };
    }
    for (const child of children) await ctx.db.delete(child._id);
    await ctx.db.delete(id);
    return { archived: false };
  },
});
