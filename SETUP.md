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
import topics from "convex-topics/convex.config.js";

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

`removeByWorkspace` verified separately through a real org deletion in
`online-help`: an org workspace holding 3 topics went to 0, while the demo
workspace's 17 and the personal workspace's 0 were untouched. The cascade is
correctly scoped.

`countAll` verified from the admin dashboard, which reported 17 topics —
matching the CLI count exactly. Every function in the API has now been
exercised against a live deployment.

### Reaching the admin dashboard

The dashboard is gated by `role === "superadmin"` in `userProfiles`, and the
only mutation that sets a role (`admin.ts` `setUserRole`) itself calls
`requireSuperAdmin`. **There is no bootstrap**, so the first superadmin has to
be created by editing the row directly in the Convex dashboard under
Data → `userProfiles`. `npx convex run` cannot substitute: the CLI carries no
user identity, so `getAuthUserId` returns null and the gate throws.

Worth fixing before any production deploy, or the same manual database edit
will be needed there.

## Auth on a fresh dev deployment

A newly created deployment has no environment variables, so sign-in and
password reset both fail. Minimum to get a working login:

```bash
npx convex env set ENABLE_TEST_AUTH true           # enables @test.local provider
npx convex env set JWT_PRIVATE_KEY -- "<PKCS#8 PEM, newlines as spaces>"
npx convex env set JWKS -- '<{"keys":[…]} JSON>'
npx convex env set SITE_URL -- "http://localhost:5176"
npx convex dev --once                               # redeploy to pick them up
```

Generate the keypair with `jose` (already a transitive dependency):

```js
const { generateKeyPair, exportPKCS8, exportJWK } = require("jose");
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
```

Then sign up with any `@test.local` address — `SignIn.tsx` and `SignUp.tsx`
route those to the test provider automatically, bypassing email verification.

Real addresses send OTP codes through Resend:

```bash
npx convex env set RESEND_API_KEY re_...
npx convex env set RESEND_FROM_ADDRESS noreply@your-verified-domain
```

Both belong on the **Convex deployment**, not in `.env.local` — the email code
runs inside Convex and never reads local files. Without
`RESEND_FROM_ADDRESS` the sender falls back to `onboarding@resend.dev`, which
Resend only permits sending to the account owner's own address, so real users
would silently receive nothing.

Verified working on `online-help`: both the signup verification and the
password reset emails were delivered.

> **Email verification is not enforced.** `signUp` returns valid tokens and
> leaves `emailVerificationTime` unset, so an unverified account has full
> access even though `Password({ verify: ... })` is configured. Decide whether
> that is wanted before opening signups to real users.

> `ENABLE_TEST_AUTH=true` enables a credentials backdoor. It is gated to
> `@test.local` addresses and belongs on dev deployments only — never
> production.
