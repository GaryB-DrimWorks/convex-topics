import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Component tables are isolated from the host app, so every id that belongs to
// the host (workspaces, users) crosses the boundary as an opaque string. Only
// `parentId` stays a real Id, because `topics` is owned by this component.
export default defineSchema({
  topics: defineTable({
    workspaceId: v.optional(v.string()), // host-owned id, opaque here
    title: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("topics")),
    order: v.number(),
    icon: v.optional(v.string()),
    content: v.optional(v.string()),
    createdBy: v.optional(v.string()), // host-owned user id, opaque here
    updatedBy: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_parentId", ["parentId", "order"])
    .index("by_workspace_parent", ["workspaceId", "parentId"])
    .index("by_slug", ["slug"])
    .searchIndex("search_title_content", {
      searchField: "title",
      filterFields: ["workspaceId"],
    }),
});
