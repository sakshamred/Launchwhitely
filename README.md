# Launchwhitly

Open-source feature flag control plane with Supabase Auth, project RBAC, local
flag evaluation, and SSE configuration delivery.

## Client SDK

The first SDK surface lives in `packages/sdk/` and is designed for app code to import
directly before it is published to npm.

```ts
import { createClient } from '@launchwhitly/sdk'

const client = createClient({
  baseUrl: process.env.NEXT_PUBLIC_LAUNCHWHITLY_URL!,
  projectKey: process.env.LW_PROJECT_KEY!,
  environmentKey: process.env.LW_ENVIRONMENT_KEY!,
})

await client.init()
const result = client.evaluate('checkout-v2', { userId: 'user_123' })
```

The SDK uses a public project key plus a secret environment key to bootstrap
the local flag cache and stay synced over SSE.

## API

- `GET|POST /api/v1/projects` - authenticated control-plane projects
- `GET|POST /api/v1/projects/:projectId/flags` - list/create flags
- `PATCH|DELETE /api/v1/projects/:projectId/flags/:flagId` - update/archive flags
- `GET /api/v1/sdk/config` - project/environment bootstrap payload and cache
- `GET /api/v1/sdk/stream` - SSE cache updates with `Last-Event-ID` replay support

SDK routes accept `x-launchwhitly-project-key` and
`x-launchwhitly-environment-key`, or the matching `projectKey` and
`environmentKey` query params.

## Getting Started

Copy `.env.example`, add your Supabase and PostgreSQL credentials, then run:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
