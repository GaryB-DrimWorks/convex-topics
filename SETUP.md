# Setup

Verified against `ai-dictionary` on 2026-08-11. These are the commands that
actually worked, not a plan.

## Installing into a second app (e.g. online-help)

### 1. Link a Convex project

```bash
cd E:\AI\projects\<app>
npx convex dev
```

Create a new project. This writes `.env.local` with `CONVEX_DEPLOYMENT` and
generates `convex/_generated/`.

Do this **before** wiring the component in. The app's `convex.config.ts` imports
the component's built output, so a first run with the wiring already active
fails on an unresolvable path before the project can be created.

### 2. Generate the component's types — from the APP, not the package

```bash
cd E:\AI\projects\<app>
npx convex codegen --component-dir ../convex-topics/src/component
```

> Running this from inside `convex-topics` **does not work**, even with
> `CONVEX_DEPLOYMENT` borrowed from the app. Codegen synthesises a virtual
> config at `./convex/convex.config.ts` and fails to resolve both
> `convex/server` and the component path, because a standalone package has no
> app-style `convex/` directory.

### 3. Build the package

```bash
cd E:\AI\projects\convex-topics
npm run build
```

### 4. Wire it up

```ts
// <app>/convex/convex.config.ts
import { defineApp } from "convex/server";
import topics from "@drimworks/convex-topics/convex.config.js";

const app = defineApp();
app.use(topics, {}); // the {} is required — see below
export default app;
```

The empty options object is **not** decorative. `app.use`'s second parameter is
only optional when the component's env type narrows to `never`, which it does
not through the package's emitted declaration. Omitting it gives
`TS2554: Expected 2 arguments, but got 1`.

### 5. Install with `--install-links`

```bash
cd E:\AI\projects\<app>
npm install --install-links
```

**This flag is essential during local development.** A plain `file:` install
symlinks the whole component directory, including its own
`node_modules/convex`. TypeScript then sees two copies of every Convex type and
reports:

```
Two different types with this name exist, but they are unrelated.
  <app>/node_modules/convex  vs  convex-topics/node_modules/convex
```

`--install-links` packs the package instead of symlinking, and `files:
["dist","src"]` excludes `node_modules`. Installing from npm proper does not
have this problem, because `devDependencies` are not installed for consumers.

### 6. Push

```bash
npx convex dev --once
```

Expect `✔ Installed component topics.`

## Windows: set CONVEX_TMPDIR

If your project is on `E:` and temp is on `C:`, Convex warns about crossing
filesystems. Silence it and avoid watcher issues:

```bash
set CONVEX_TMPDIR=E:\AI\projects\<app>\.tmp\convex
```

## Verified behaviour

Exercised against a seeded 15-topic demo workspace:

| Function | Result |
|---|---|
| `listAll` | 15 topics returned |
| `search` "invoic" | 2 hits (Invoicing, Xero) |
| `addChild` | nested at order 3 |
| `promote` | lifted to root, order 1 |
| `demote` | nested back, order 3 |
| `rename` | title + slug regenerated |
| `duplicate` | "… (Copy)" / "…-copy" |
| `remove` | count back to 15 |
| `countByWorkspaces` | 15, agrees with `listAll` |

**Not yet exercised:** `removeByWorkspace` and `countAll`. Both are reached only
through org deletion and the admin dashboard, which need an authenticated
session. Low risk (each is an indexed query plus a loop), but unproven.
