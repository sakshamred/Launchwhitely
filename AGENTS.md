# Launchwhitly — Agent Rules

## Project Overview

Open-source feature flag platform (LaunchDarkly alternative). Next.js 16 App Router, Supabase (Auth + Postgres), Prisma 7, Tailwind CSS v4, Resend (email).

## Architecture

```
src/
├── app/
│   ├── (auth)/              # Unauthenticated routes (login, signup, invite accept)
│   │   ├── auth-form.tsx         # Google OAuth button (shared login/signup UI)
│   │   ├── login/page.tsx        # /login — redirects signed-in users
│   │   ├── signup/page.tsx        # /signup — redirects signed-in users
│   │   └── invite/[token]/       # /invite/:token — accept invite flow
│   ├── (dashboard)/          # Authenticated routes (sidebar + project views)
│   │   ├── layout.tsx            # Dashboard shell: sidebar + auth guard
│   │   ├── page.tsx              # /projects redirect
│   │   └── projects/[projectId]/
│   │       ├── layout.tsx        # Project shell: top bar + env switcher + role guard
│   │       ├── page.tsx           # Project overview (flag list)
│   │       ├── flags/             # Flag CRUD + state editing
│   │       ├── environments/      # Environment CRUD
│   │       ├── api-keys/          # API key create/revoke
│   │       ├── members/           # Member list + invite
│   │       └── audit-logs/        # Audit log viewer
│   ├── actions/
│   │   ├── auth.ts               # signInWithGoogle, signOut
│   │   ├── projects.ts            # Project + flag + env + API key + member actions
│   │   └── invites.ts            # createInvite, revokeInvite, acceptInvite
│   ├── api/v1/                    # SDK endpoints (flag evaluation, streaming)
│   ├── auth/callback/route.ts     # OAuth code exchange
│   ├── layout.tsx                 # Root layout (fonts, globals)
│   └── page.tsx                   # Landing page → redirects / redirects to /projects
├── lib/
│   ├── auth.ts                    # getCurrentUser, getProjectRole, hasProjectRole
│   ├── auth/permissions.ts        # RBAC: requireProjectAction, requireOrgAction, can()
│   ├── api.ts                     # requireApiUser, canAccessProject (for REST endpoints)
│   ├── email.ts                   # sendInviteEmail (Resend)
│   ├── profile.ts                 # ensureProfile (upsert on first touch)
│   ├── sdk.ts                     # authenticateSdkRequest, buildFlagCache
│   ├── streaming.ts               # SSE helper
│   ├── rollout/                   # Flag evaluation engine (bucketing, segments, targeting)
│   └── supabase/
│       ├── client.ts              # createBrowserClient (for client components)
│       ├── server.ts              # createServerClient (cookies-based, for server components)
│       ├── proxy.ts               # refreshSession (called by src/proxy.ts)
│       └── env.ts                 # getSupabaseEnv (URL + key helper)
├── db/client.ts                   # Prisma singleton (PrismaPg adapter, pooled URL)
├── components/
│   ├── layout/                    # Sidebar, Header
│   ├── env-switcher.tsx           # Environment dropdown
│   └── ui/                        # Badge, Button, Card, Input, Modal, Select, Slider, Toggle
├── proxy.ts                        # Next.js 16 proxy (renamed from middleware.ts)
└── generated/prisma/              # Prisma 7 generated client (gitignored)
```

## Key Conventions

### Next.js 16 Breaking Changes

- **Middleware is now `proxy.ts`** — the file must be `src/proxy.ts` (or root), exporting `proxy()` not `middleware()`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Server Functions** (actions) are POST requests to the route they live on. A proxy matcher that excludes a path also skips server function calls on that path.
- **Always verify auth in Server Functions**, not just in proxy. Proxy is for redirects and session refresh only.
- Run `npx tsc --noEmit` before considering code done.

### Supabase Auth (SSR)

- **Server client**: `src/lib/supabase/server.ts` — uses `getAll/setAll` cookie pattern (required for SSR).
- **Browser client**: `src/lib/supabase/client.ts` — singleton `createBrowserClient`.
- **Proxy**: `src/proxy.ts` calls `refreshSession()` from `src/lib/supabase/proxy.ts` on every request. This is the only place cookies are refreshed — without it, `setAll` in server components silently fails.
- **Sign-in flow**: `actions/auth.ts:signInWithGoogle` → Supabase OAuth redirect → `/auth/callback` → code exchange → redirect.
- **Profile creation**: `src/lib/profile.ts:ensureProfile()` upserts a `profiles` row. Called in `createProject` and `acceptInvite`. A SQL trigger on `auth.users` also creates the row on signup (see `supabase/migrations/0001_auth_wiring.sql`).

### Prisma 7

- **`url` and `directUrl` are removed from `schema.prisma`**. Connection config lives in `prisma.config.ts` only.
- **`prisma.config.ts`** uses `DIRECT_URL` for CLI (migrations), `DATABASE_URL` (pooled) is read at runtime via `PrismaPg` adapter.
- **Generated client** goes to `src/generated/prisma/` (gitignored). Run `npm run db:generate` after schema changes.
- **`npm run db:push`** syncs schema to Supabase (no migration files).
- **`npm run db:migrate`** creates migration files (use when you need migration history).

### RBAC (Role-Based Access Control)

Roles: `OWNER > ADMIN > DEVELOPER > VIEWER` (org-scoped, not project-scoped).

| Action | VIEWER | DEVELOPER | ADMIN | OWNER |
|---|---|---|---|---|
| View project/flags | ✅ | ✅ | ✅ | ✅ |
| Toggle/edit flags | ❌ | ✅ | ✅ | ✅ |
| Create/archive flags | ❌ | ✅ | ✅ | ✅ |
| Create/delete envs | ❌ | ✅ | ✅ | ✅ |
| Create/revoke API keys | ❌ | ✅ | ✅ | ✅ |
| Invite/manage members | ❌ | ❌ | ✅ | ✅ |
| Change member roles | ❌ | ❌ | ✅ | ✅ |
| Remove members | ❌ | ❌ | ✅ | ✅ |
| Delete project | ❌ | ❌ | ❌ | ✅ |

**Permission helpers** (`src/lib/auth/permissions.ts`):
- `requireProjectAction(projectId, action)` — looks up org from project, checks role.
- `requireOrgAction(orgId, action)` — checks role in org.
- `can(role, action)` — boolean check.
- `getSessionUser()` — returns User or redirects to /login.

**Every mutatimg server action calls the appropriate `require*Action` before any DB writes.** No action should rely on just `requireUser()` — that only checks authentication, not authorization.

### Route Groups

- `(auth)` — unauthenticated layout (centered dark bg). Login, signup, invite accept.
- `(dashboard)` — authenticated layout (sidebar). All project views.
- Paths outside groups: `/` (landing), `/auth/callback`, `/invite/[token]` (uses `(auth)` layout).

### Invites

- **Token-based, email-delivered**. `createInvite` generates a `crypto.randomBytes(32).toString('base64url')` token, stores in `invites` table, sends via Resend.
- **7-day expiry**, single-use, revocable.
- **Email matching is NOT enforced** — any signed-in Google account can accept an invite. The invite email is for delivery only, not identity verification.
- **`createInvite`** requires ADMIN+ on the org. Fires email async (non-blocking).
- **`acceptInvite`** creates `organizationMember` row with the signed-in user's ID and the invite's role.

### UI Patterns

- Server components by default. Client components only when needed (event handlers, hooks).
- Server Actions (`'use server'`) for all mutations. Forms use `useActionState` for error/success handling.
- Use existing UI primitives in `src/components/ui/` (Button, Input, Select, Modal, Badge, Toggle, Card, EmptyState).
- Tailwind v4 classes only (no `@apply` in CSS files, utility classes in JSX).
- Dark theme: zinc-950 backgrounds, zinc-900 surfaces, indigo-600 accents.

### Environment Variables

```bash
# Required
DATABASE_URL=          # Pooled connection (Supavisor, port 6543, ?pgbouncer=true)
DIRECT_URL=            # Direct connection (Supabase, port 5432) — for Prisma CLI
NEXT_PUBLIC_SUPABASE_URL=   # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon/public key

# Required for auth
# (Google client ID/secret are configured in Supabase dashboard, not in .env)

# Required for invite emails
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=Launchwhitly <noreply@your-domain.com>

# Optional
NEXT_PUBLIC_SITE_URL=https://your-domain.com  # Invite links + OAuth redirect origin
```

### Database Schema

Run `supabase/migrations/0001_auth_wiring.sql` once in the Supabase SQL Editor:
- Trigger: `auth.users INSERT → profiles INSERT/UPDATE`
- RLS: enabled on all tables. `profiles` readable by authenticated users, writable by owner. Other tables: deny-by-default for anon/authenticated (Prisma uses postgres role which bypasses RLS).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema to Supabase (no migration files) |
| `npm run db:migrate` | Create a migration file |
| `npm run db:studio` | Open Prisma Studio |

### Things That Will Bite You

- **`/projects/new` matches `[projectId]`**. The sidebar and project layout validate that `projectId` is a UUID. Non-UUID segments redirect to `/projects`.
- **`ensureProfile()` is called in `createProject` and `acceptInvite`**. Without it, the `organization_members.user_id` FK fails because no `profiles` row exists yet. The SQL trigger handles this too, but there's a race on first login.
- **Prisma uses the direct postgres role which bypasses RLS**. Authorization is enforced in the app layer via `requireProjectAction` / `requireOrgAction`, not via RLS policies.
- **`RESEND_API_KEY` missing means emails silently skip**. Check console for `[launchwhitly] RESEND_API_KEY not set` warnings.
- **Next.js 16 renamed `middleware` to `proxy`**. The file is `src/proxy.ts`, exporting `proxy()`. Do NOT create `middleware.ts`.

## Code Style Rules

### General

- No comments in code unless explicitly asked. Code should be self-documenting — use descriptive variable and function names.
- Use TypeScript strict mode. No `any` types. If you must use one, add a TODO comment explaining why.
- Prefer early returns and guard clauses over nested if/else blocks.
- Keep functions small and focused — one responsibility per function.
- Use `const` by default. Use `let` only when reassignment is needed. Never use `var`.
- Prefer template literals over string concatenation.

### Naming

- Files: `kebab-case.ts` / `kebab-case.tsx` (already the convention — e.g. `flag-state-editor.tsx`, `create-api-key-button.tsx`).
- Components: `PascalCase` exported as default (e.g. `export default function FlagToggle()`).
- Server actions: `camelCase` (e.g. `createProject`, `toggleFlag`, `revokeInvite`).
- DB fields: `camelCase` in Prisma schema, maps to `snake_case` columns via `@map`.
- Environment variables: `UPPER_SNAKE_CASE` with `NEXT_PUBLIC_` prefix for client-visible vars.

### Server Components vs Client Components

- Default to server components. Only add `'use client'` when the component needs:
  - Event handlers (onClick, onSubmit, etc.)
  - React hooks (useState, useEffect, useActionState, etc.)
  - Browser-only APIs (localStorage, window, etc.)
- Keep `'use client'` boundary as low as possible. Extract interactive bits into small client components, leave the parent as a server component.

### Server Actions

- All mutations go through server actions in `src/app/actions/`.
- Every mutating action must call `requireProjectAction()` or `requireOrgAction()` before any DB writes. Never rely on just `requireUser()` or `getSessionUser()` for authorization — those only check authentication.
- Return typed objects: `{ success: true, data }` or `{ success: false, error: string }`. Never throw raw errors — catch and return structured error responses.
- Use `revalidatePath()` after mutations to bust the right caches.

### Prisma

- Always use the singleton from `src/db/client.ts`: `import { prisma } from '@/db/client'`.
- Never instantiate PrismaClient directly in route handlers or actions.
- Use `select` or `include` to limit fetched fields when you don't need the full row.
- After schema changes, always run `npm run db:generate` (regenerates client) then `npm run db:push` (syncs to Supabase).

### Auth & RBAC

- Use `getSessionUser()` to get the current user in server components and actions. It redirects to `/login` if no session.
- Use `requireProjectAction(projectId, 'flag.write')` or `requireOrgAction(orgId, 'member.invite')` for authorization checks in mutating actions.
- Use `can(role, 'flag.write')` for conditional UI rendering (show/hide buttons based on role).
- Never trust client-side role checks alone — always verify on the server.

### Error Handling

- Server actions: catch Prisma errors, return `{ success: false, error: 'Descriptive message' }`.
- API routes: return proper HTTP status codes (401, 403, 404, 500). Use `NextResponse.json({ error: 'message' }, { status: code })`.
- Never expose raw Prisma errors or stack traces to the client.
- Log errors server-side with `console.error('[launchwhitly] context:', error)`.

### UI / Styling

- Use existing UI primitives from `src/components/ui/` — don't create new ones without checking first.
- Dark theme palette: `zinc-950` (backgrounds), `zinc-900` (surfaces/cards), `zinc-800` (borders/dividers), `zinc-400` (muted text), `zinc-100` (primary text), `indigo-600` (actions/accents), `indigo-500` (hover).
- Tailwind v4 utility classes only. No `@apply` in CSS files. No inline styles.
- Use consistent spacing: `p-6` for card padding, `gap-4` for flex/grid gaps, `mb-8` for section spacing.

### File Organization

- Colocate related files: action button components live next to their page (e.g. `create-api-key-button.tsx` in `api-keys/`).
- Shared utilities go in `src/lib/`. Shared UI components go in `src/components/ui/`.
- Keep page files (`page.tsx`) thin — extract logic into separate components or actions.

### Git & Commits

- Never commit secrets, API keys, or `.env` files.
- Never commit `src/generated/prisma/` — it's gitignored and regenerated locally.
- Run `npx tsc --noEmit` before finalizing any code change.

## Progress Tracker

### Completed

- [x] Project scaffolding (Next.js 16, TypeScript, Tailwind v4, App Router, `src/` directory)
- [x] Prisma 7 wired to Supabase (pooled URL + direct URL, PrismaPg adapter)
- [x] Full database schema pushed (11 tables: profiles, organizations, organization_members, projects, environments, flags, flag_states, segments, api_keys, audit_logs, invites)
- [x] Google OAuth auth flow (proxy session refresh, server/browser Supabase clients, code exchange callback)
- [x] Auth pages (`(auth)/login`, `(auth)/signup`, `(auth)/auth-form.tsx` — Google-only UI)
- [x] Profile auto-create (`ensureProfile()` upsert + SQL trigger on `auth.users`)
- [x] RBAC system (`src/lib/auth/permissions.ts` — role matrix, `requireProjectAction`, `requireOrgAction`, `can()`)
- [x] Token-based email invites (create, revoke, accept — Resend delivery, 7-day expiry)
- [x] Invite accept flow (`/invite/[token]` page + accept-invite-form.tsx)
- [x] Members page (invite button, pending invites table, revoke button, role display)
- [x] Landing page (marketing, redirects signed-in users to `/projects`)
- [x] Project dashboard (project list, project layout with sidebar, env switcher)
- [x] Flag CRUD (create, toggle, archive, per-environment state editing)
- [x] Environment CRUD (create, delete environments per project)
- [x] API key management (create, revoke keys per project)
- [x] Audit log viewer
- [x] SDK API endpoints (`/api/v1/projects/[projectId]/flags`, flag evaluation, SSE streaming)
- [x] Rollout engine (bucketing, segments, targeting)
- [x] UUID validation guard in sidebar + project layout (prevents `/projects/new` matching `[projectId]`)

### Blocked / Needs Manual Steps

- [ ] Run `supabase/migrations/0001_auth_wiring.sql` in Supabase SQL Editor (profile trigger + RLS)
- [ ] Enable Google provider in Supabase Dashboard → Auth → Providers → Google
- [ ] Add `http://localhost:3000/auth/callback` to Supabase redirect URLs for local dev
- [ ] Test full end-to-end: sign up → create project → invite member → accept invite
- [ ] Deploy to `lowkeydev.me` and uncomment `NEXT_PUBLIC_SITE_URL`