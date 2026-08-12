/**
 * App-facing helpers for @drimworks/convex-topics.
 *
 * The component's functions are reached through `components.topics.lib.*` in
 * the host app. These types exist so app code can talk about topics without
 * re-declaring the shape.
 */

/** A topic as returned across the component boundary. */
export type Topic = {
  _id: string;
  _creationTime: number;
  /** Host-owned workspace id. Opaque to the component. */
  workspaceId?: string;
  title: string;
  slug: string;
  parentId?: string;
  order: number;
  icon?: string;
  content?: string;
  /** Host-owned user id. Opaque to the component. */
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: number;
};

/** A topic with its children resolved, for rendering trees. */
export type TopicNode = Topic & { children: TopicNode[] };

/**
 * Build a tree from the flat array returned by `listAll`.
 *
 * The component stores topics flat and ordered; shaping them for the UI is a
 * client concern, so it lives here rather than costing a database round trip.
 */
export function buildTopicTree(topics: Topic[]): TopicNode[] {
  const byId = new Map<string, TopicNode>();
  for (const t of topics) {
    byId.set(t._id, { ...t, children: [] });
  }

  const roots: TopicNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      // A topic whose parent is missing would otherwise vanish from the tree,
      // so treat it as a root rather than dropping it silently.
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  const sortRecursive = (nodes: TopicNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);

  return roots;
}

/** Slugify a title the same way the component does, for optimistic UI. */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
