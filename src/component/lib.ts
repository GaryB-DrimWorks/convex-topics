import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";

const topicObject = v.object({
  _id: v.id("topics"),
  _creationTime: v.number(),
  workspaceId: v.optional(v.string()),
  title: v.string(),
  slug: v.string(),
  parentId: v.optional(v.id("topics")),
  order: v.number(),
  icon: v.optional(v.string()),
  content: v.optional(v.string()),
  createdBy: v.optional(v.string()),
  updatedBy: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getNextOrder(
  ctx: MutationCtx,
  parentId?: Id<"topics">,
): Promise<number> {
  const siblings = await ctx.db
    .query("topics")
    .withIndex("by_parentId", (q) => q.eq("parentId", parentId))
    .collect();
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((s) => s.order)) + 1;
}

// The original read `workspace.topicLimit` from the host's `workspaces` table.
// A component cannot reach that table, so the host resolves the limit and
// passes it in. Mechanism lives here; policy stays in the app.
// `undefined` means unlimited, matching the old `topicLimit === -1` case.
async function enforceTopicLimit(
  ctx: MutationCtx,
  workspaceId: string | undefined,
  topicLimit: number | undefined,
): Promise<void> {
  if (topicLimit === undefined || topicLimit === -1) return;
  if (workspaceId === undefined) return;

  const count = (
    await ctx.db
      .query("topics")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .collect()
  ).length;

  if (count >= topicLimit) {
    throw new Error(
      `Topic limit reached (${topicLimit}). Upgrade your plan for more topics.`,
    );
  }
}

export const listAll = query({
  args: { workspaceId: v.string() },
  returns: v.array(topicObject),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("topics")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("topics") },
  returns: v.union(topicObject, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Count topics per workspace, batched.
 *
 * The host's admin screens previously counted topics inline while looping over
 * workspaces. That loop would now cross the component boundary once per
 * workspace, so this takes the whole list and answers in a single round trip.
 */
export const countByWorkspaces = query({
  args: { workspaceIds: v.array(v.string()) },
  returns: v.array(v.object({ workspaceId: v.string(), count: v.number() })),
  handler: async (ctx, args) => {
    const counts = [];
    for (const workspaceId of args.workspaceIds) {
      const topics = await ctx.db
        .query("topics")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      counts.push({ workspaceId, count: topics.length });
    }
    return counts;
  },
});

/** Total topics across every workspace. For host admin dashboards. */
export const countAll = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return (await ctx.db.query("topics").collect()).length;
  },
});

/**
 * Delete every topic in a workspace.
 *
 * The host cascades this when an organisation or workspace is deleted. Without
 * it, removing an org would orphan its topics inside the component, where the
 * host can no longer reach them to clean up.
 */
export const removeByWorkspace = mutation({
  args: { workspaceId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const t of topics) {
      await ctx.db.delete(t._id);
    }
    return topics.length;
  },
});

export const search = query({
  args: { query: v.string(), workspaceId: v.string() },
  returns: v.array(topicObject),
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];

    const titleResults = await ctx.db
      .query("topics")
      .withSearchIndex("search_title_content", (q) =>
        q.search("title", args.query).eq("workspaceId", args.workspaceId),
      )
      .take(20);

    const allTopics = await ctx.db
      .query("topics")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const lowerQuery = args.query.toLowerCase();
    const contentMatches = allTopics.filter(
      (t) =>
        (t.content && t.content.toLowerCase().includes(lowerQuery)) ||
        t.title.toLowerCase().includes(lowerQuery),
    );

    const seen = new Set<string>();
    const results = [];
    for (const t of [...titleResults, ...contentMatches]) {
      if (!seen.has(t._id)) {
        seen.add(t._id);
        results.push(t);
      }
    }
    return results.slice(0, 20);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.string(),
    title: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("topics")),
    order: v.optional(v.number()),
    icon: v.optional(v.string()),
    content: v.optional(v.string()),
    topicLimit: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  },
  returns: v.id("topics"),
  handler: async (ctx, args) => {
    await enforceTopicLimit(ctx, args.workspaceId, args.topicLimit);
    const order =
      args.order !== undefined
        ? args.order
        : await getNextOrder(ctx, args.parentId);
    return await ctx.db.insert("topics", {
      workspaceId: args.workspaceId,
      title: args.title,
      slug: args.slug,
      parentId: args.parentId,
      order,
      icon: args.icon,
      content: args.content,
      createdBy: args.createdBy,
      updatedBy: args.createdBy,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("topics"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    order: v.optional(v.number()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("topics")),
    updatedBy: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const patch: Record<string, unknown> = {
      ...updates,
      updatedAt: Date.now(),
    };
    for (const key of Object.keys(patch)) {
      if (patch[key] === undefined) delete patch[key];
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});

async function deleteRecursive(
  ctx: MutationCtx,
  topicId: Id<"topics">,
): Promise<void> {
  const children = await ctx.db
    .query("topics")
    .withIndex("by_parentId", (q) => q.eq("parentId", topicId))
    .collect();
  for (const child of children) {
    await deleteRecursive(ctx, child._id);
  }
  await ctx.db.delete(topicId);
}

export const remove = mutation({
  args: { id: v.id("topics") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteRecursive(ctx, args.id);
    return null;
  },
});

export const duplicate = mutation({
  args: {
    id: v.id("topics"),
    topicLimit: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  },
  returns: v.id("topics"),
  handler: async (ctx, args) => {
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Topic not found");

    await enforceTopicLimit(ctx, topic.workspaceId, args.topicLimit);

    async function duplicateRecursive(
      sourceId: Id<"topics">,
      newParentId: Id<"topics"> | undefined,
      titleSuffix: string,
      wsId: string | undefined,
    ): Promise<Id<"topics">> {
      const source = await ctx.db.get(sourceId);
      if (!source) throw new Error("Topic not found during duplication");
      const newOrder = await getNextOrder(ctx, newParentId);
      const newId = await ctx.db.insert("topics", {
        workspaceId: wsId,
        title: source.title + titleSuffix,
        slug: source.slug + (titleSuffix ? "-copy" : ""),
        parentId: newParentId,
        order: newOrder,
        icon: source.icon,
        content: source.content,
        createdBy: args.createdBy ?? source.createdBy,
        updatedBy: args.createdBy ?? source.updatedBy,
        updatedAt: Date.now(),
      });
      const children = await ctx.db
        .query("topics")
        .withIndex("by_parentId", (q) => q.eq("parentId", sourceId))
        .collect();
      for (const child of children) {
        await duplicateRecursive(child._id, newId, "", wsId);
      }
      return newId;
    }

    return await duplicateRecursive(
      args.id,
      topic.parentId,
      " (Copy)",
      topic.workspaceId,
    );
  },
});

export const rename = mutation({
  args: {
    id: v.id("topics"),
    title: v.string(),
    updatedBy: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      slug: slugify(args.title),
      updatedBy: args.updatedBy,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const addChild = mutation({
  args: {
    parentId: v.id("topics"),
    title: v.string(),
    topicLimit: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  },
  returns: v.id("topics"),
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentId);
    if (!parent) throw new Error("Parent topic not found");
    await enforceTopicLimit(ctx, parent.workspaceId, args.topicLimit);

    const order = await getNextOrder(ctx, args.parentId);
    return await ctx.db.insert("topics", {
      workspaceId: parent.workspaceId,
      title: args.title,
      slug: slugify(args.title),
      parentId: args.parentId,
      order,
      createdBy: args.createdBy,
      updatedBy: args.createdBy,
      updatedAt: Date.now(),
    });
  },
});

export const addPeer = mutation({
  args: {
    siblingId: v.id("topics"),
    title: v.string(),
    topicLimit: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  },
  returns: v.id("topics"),
  handler: async (ctx, args) => {
    const sibling = await ctx.db.get(args.siblingId);
    if (!sibling) throw new Error("Sibling topic not found");
    await enforceTopicLimit(ctx, sibling.workspaceId, args.topicLimit);

    const order = await getNextOrder(ctx, sibling.parentId);
    return await ctx.db.insert("topics", {
      workspaceId: sibling.workspaceId,
      title: args.title,
      slug: slugify(args.title),
      parentId: sibling.parentId,
      order,
      createdBy: args.createdBy,
      updatedBy: args.createdBy,
      updatedAt: Date.now(),
    });
  },
});

export const promote = mutation({
  args: { id: v.id("topics"), updatedBy: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Topic not found");
    if (!topic.parentId) throw new Error("Cannot promote a root topic");

    const parent = await ctx.db.get(topic.parentId);
    if (!parent) throw new Error("Parent not found");

    const newParentId = parent.parentId;
    const newSiblings = await ctx.db
      .query("topics")
      .withIndex("by_parentId", (q) => q.eq("parentId", newParentId))
      .collect();
    newSiblings.sort((a, b) => a.order - b.order);

    const parentOrder = parent.order;
    for (const sib of newSiblings) {
      if (sib.order > parentOrder) {
        await ctx.db.patch(sib._id, { order: sib.order + 1 });
      }
    }

    await ctx.db.patch(args.id, {
      parentId: newParentId,
      order: parentOrder + 1,
      updatedBy: args.updatedBy,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const demote = mutation({
  args: { id: v.id("topics"), updatedBy: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Topic not found");

    const siblings = await ctx.db
      .query("topics")
      .withIndex("by_parentId", (q) => q.eq("parentId", topic.parentId))
      .collect();
    siblings.sort((a, b) => a.order - b.order);

    const idx = siblings.findIndex((s) => s._id === args.id);
    if (idx <= 0)
      throw new Error("Cannot demote: topic is the first sibling of its parent");

    const prevSibling = siblings[idx - 1];
    const prevChildren = await ctx.db
      .query("topics")
      .withIndex("by_parentId", (q) => q.eq("parentId", prevSibling._id))
      .collect();
    const newOrder =
      prevChildren.length > 0
        ? Math.max(...prevChildren.map((c) => c.order)) + 1
        : 0;

    await ctx.db.patch(args.id, {
      parentId: prevSibling._id,
      order: newOrder,
      updatedBy: args.updatedBy,
      updatedAt: Date.now(),
    });
    return null;
  },
});
