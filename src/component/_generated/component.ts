/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      addChild: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          parentId: string;
          title: string;
          topicLimit?: number;
        },
        string,
        Name
      >;
      addPeer: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          siblingId: string;
          title: string;
          topicLimit?: number;
        },
        string,
        Name
      >;
      countAll: FunctionReference<"query", "internal", {}, number, Name>;
      countByWorkspaces: FunctionReference<
        "query",
        "internal",
        { workspaceIds: Array<string> },
        Array<{ count: number; workspaceId: string }>,
        Name
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          content?: string;
          createdBy?: string;
          icon?: string;
          order?: number;
          parentId?: string;
          slug: string;
          title: string;
          topicLimit?: number;
          workspaceId: string;
        },
        string,
        Name
      >;
      demote: FunctionReference<
        "mutation",
        "internal",
        { id: string; updatedBy?: string },
        null,
        Name
      >;
      duplicate: FunctionReference<
        "mutation",
        "internal",
        { createdBy?: string; id: string; topicLimit?: number },
        string,
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          _creationTime: number;
          _id: string;
          content?: string;
          createdBy?: string;
          icon?: string;
          order: number;
          parentId?: string;
          slug: string;
          title: string;
          updatedAt?: number;
          updatedBy?: string;
          workspaceId?: string;
        } | null,
        Name
      >;
      listAll: FunctionReference<
        "query",
        "internal",
        { workspaceId: string },
        Array<{
          _creationTime: number;
          _id: string;
          content?: string;
          createdBy?: string;
          icon?: string;
          order: number;
          parentId?: string;
          slug: string;
          title: string;
          updatedAt?: number;
          updatedBy?: string;
          workspaceId?: string;
        }>,
        Name
      >;
      promote: FunctionReference<
        "mutation",
        "internal",
        { id: string; updatedBy?: string },
        null,
        Name
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        null,
        Name
      >;
      removeByWorkspace: FunctionReference<
        "mutation",
        "internal",
        { workspaceId: string },
        number,
        Name
      >;
      rename: FunctionReference<
        "mutation",
        "internal",
        { id: string; title: string; updatedBy?: string },
        null,
        Name
      >;
      search: FunctionReference<
        "query",
        "internal",
        { query: string; workspaceId: string },
        Array<{
          _creationTime: number;
          _id: string;
          content?: string;
          createdBy?: string;
          icon?: string;
          order: number;
          parentId?: string;
          slug: string;
          title: string;
          updatedAt?: number;
          updatedBy?: string;
          workspaceId?: string;
        }>,
        Name
      >;
      update: FunctionReference<
        "mutation",
        "internal",
        {
          content?: string;
          icon?: string;
          id: string;
          order?: number;
          parentId?: string;
          slug?: string;
          title?: string;
          updatedBy?: string;
        },
        null,
        Name
      >;
    };
  };
