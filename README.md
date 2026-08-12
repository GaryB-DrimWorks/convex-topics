# convex-topics

Hierarchical, searchable topic trees as a [Convex component](https://docs.convex.dev/components).
Workspace-scoped and auth-agnostic, so the same content engine can back several
apps without them sharing a database.

Extracted from `ai-dictionary` / `online-help`, which carried byte-identical
copies of this logic.

## Status

✅ **Working, verified in two consumers.**

- `online-help` — the real consumer. Topic tree, content viewer and search all
  render correctly through the component in the browser, no console errors.
- `ai-dictionary` — installs and passes CLI-level tests, but note its `App.tsx`
  mounts only `AIDictionaryPage` and never reaches the topic UI. It may not need
  this component at all.

Full tree manipulation (`addChild`, `promote`, `demote`, `rename`, `duplicate`,
`remove`) verified via CLI against a seeded 15-topic workspace. See
[SETUP.md](./SETUP.md).

`removeByWorkspace` verified through a real org deletion: the org's workspace
went from 3 topics to 0 while every other workspace was left untouched.

One function remains unexercised: `countAll`, reachable only from the admin
dashboard, which needs a superadmin account.

## What it owns

One table, `topics`:

| field | type | notes |
|---|---|---|
| `workspaceId` | `string?` | host-owned id, opaque here |
| `title` / `slug` | `string` | |
| `parentId` | `Id<"topics">?` | component-owned, a real id |
| `order` | `number` | sibling ordering |
| `icon` / `content` | `string?` | |
| `createdBy` / `updatedBy` | `string?` | host-owned user ids, opaque |
| `updatedAt` | `number?` | |

Indexes: `by_workspaceId`, `by_parentId`, `by_workspace_parent`, `by_slug`, plus
a `search_title_content` search index filtered by `workspaceId`.

## API

Reached from the host as `components.topics.lib.*`.

**Queries** — `listAll`, `get`, `search`, `countByWorkspaces`, `countAll`
**Mutations** — `create`, `update`, `remove`, `duplicate`, `rename`,
`addChild`, `addPeer`, `promote`, `demote`, `removeByWorkspace`

## Boundary rules

Components are sandboxed: they cannot read host tables, call `ctx.auth`, or read
`process.env`. Three consequences shaped this API:

**1. Host ids cross as strings.** `v.id("workspaces")` and `v.id("users")` became
`v.string()`. Only `parentId` stays a real `Id`, because `topics` is owned here.

**2. `topicLimit` is passed in, not looked up.** The original read
`workspace.topicLimit` from the host's `workspaces` table. The host now resolves
it and passes it to `create` / `duplicate` / `addChild` / `addPeer`. Omitting it
means unlimited, matching the old `topicLimit === -1` sentinel. Mechanism lives
here; policy stays in the app.

**3. Auth stays in the app.** The component never identifies the caller. Pass
`createdBy` / `updatedBy` explicitly if you want audit fields populated.

## Installing

```bash
npm install convex-topics
```

For local development against a sibling checkout, use `--install-links` — a
plain `file:` install symlinks this directory including its own
`node_modules/convex`, and TypeScript then sees two unrelated copies of every
Convex type:

```bash
npm install --install-links file:../convex-topics
```

> **`bun install` does not work with a local `file:` link.** Bun has no
> `--install-links` equivalent, so the duplicate `convex` is unavoidable and the
> build fails with *"Two different types with this name exist, but they are
> unrelated."* Installing this package from a registry has no such problem —
> that is the main reason to publish it rather than link it.

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import topics from "convex-topics/convex.config.js";

const app = defineApp();
app.use(topics);
export default app;
```

Then wrap it for clients. Component functions must not be exposed directly —
they have no auth:

```ts
// convex/topics.ts
import { components } from "./_generated/api";
import { query } from "./_generated/server";

export const listAll = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) =>
    ctx.runQuery(components.topics.lib.listAll, {
      workspaceId: args.workspaceId,
    }),
});
```

`ai-dictionary/convex/topics.ts` is a complete worked example.

## Validation

Build order matters — the bundle must exist before a consuming app reads it.
Codegen must be run **from a linked app**, not from this package:

```bash
cd ../<app>
npx convex codegen --component-dir ../convex-topics/src/component
cd ../convex-topics && npm run build
```

Full sequence, including the `--install-links` requirement, is in
[SETUP.md](./SETUP.md).

## Publishing

`prepack` runs `clean && build`, so `npm pack` and `npm publish` always ship a
freshly compiled `dist/`.

`src/component/_generated/` is committed on purpose. Convex codegen needs a
linked deployment to run, so without it the package could not be built from a
clean checkout or in CI. Regenerate it from a linked app whenever the schema or
function signatures change:

```bash
cd ../<app>
npx convex codegen --component-dir ../convex-topics/src/component
```

Then publish:

```bash
npm login
npm publish
```

The name is unscoped, so no npm organisation is needed and `publishConfig` is
unnecessary — unscoped packages are public by default.

## Client helpers

The package root exports UI-side utilities that need no database round trip:

```ts
import { buildTopicTree, slugifyTitle } from "convex-topics";

const tree = buildTopicTree(await convex.query(api.topics.listAll, { workspaceId }));
```
