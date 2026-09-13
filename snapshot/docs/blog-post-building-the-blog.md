# Building the Blog: A Behind-the-Scenes Look at Portal 360°'s News Reader

*How a small set of well-chosen dependencies turned a folder of RSS URLs into a
secure, cached, in-app reading experience.*

---

## What "the blog" actually is

Portal 360° is a Next.js admin portal, but tucked inside it lives a project of
its own: a **unified reader for the eight-plus Microsoft product blogs** that
admins care about — Power Apps, Power Automate, Power BI, Power Platform,
Copilot Studio, the Power Platform developer blog, the Microsoft Foundry blog,
and its "What's New" category.

Instead of asking users to bookmark eight sites, we pull the RSS feeds
server-side, cache them, sanitize them, and render them with a single reusable
React component. The whole feature lives in two places:

- One API route: [src/app/api/news/rss/route.ts](../src/app/api/news/rss/route.ts)
- One shared page component: [src/app/news/components/NewsFeedPage.tsx](../src/app/news/components/NewsFeedPage.tsx)

Everything else is a ten-line page file per feed. That's the whole design goal —
adding a new blog source should take a minute.

---

## The stack, and why each piece earns its keep

### Next.js 16 + React 19 (App Router)

The App Router is the backbone. It gives us three things this feature depends on:

- **Route handlers** — `app/api/news/rss/route.ts` is a first-class server
  endpoint. No separate Express server, no serverless glue.
- **`fetch` with `next: { revalidate: 3600 }`** — one line of config turns every
  outbound RSS request into a 1-hour cached response, shared across all users.
  We didn't have to bolt on Redis for this.
- **Server components by default** — the page shells stay on the server; only
  the interactive `NewsFeedPage` opts into `'use client'`.

### TypeScript

Every file in this feature is typed end-to-end. The `RSSItem` shape is declared
once and flows from the parser into the API response, into `useState`, and into
the JSX. When we later added `category?: string[]`, the compiler told us
everywhere that needed updating.

### Tailwind CSS v4

The reader UI — cards, hover states, the gradient border on articles, the
skeleton spinner — is all utility classes. No CSS files, no styled-components,
no theme layer to maintain. Tailwind v4's PostCSS plugin (`@tailwindcss/postcss`)
means there's no `tailwind.config.js` to babysit either.

### Heroicons

`@heroicons/react` gives us the `NewspaperIcon`, `CalendarIcon`, and
`ArrowTopRightOnSquareIcon` used throughout the reader. Tree-shakeable,
accessible by default, and matches the visual language of the rest of the
portal.

### `isomorphic-dompurify` (via `lib/sanitize.ts`)

RSS descriptions are HTML. HTML from the open internet is not safe to render.
We route every description through a shared `htmlToText` helper that strips
tags without executing scripts or firing `<img onerror>`. That helper is built
on isomorphic-dompurify so it works identically on the server and in the
browser.

This is the single most important line of code in the reader:

```tsx
{stripHtml(item.description)}
```

Without it, one compromised feed would be a stored XSS across every user
session.

---

## The security work you don't see

Half of the code in `route.ts` isn't about fetching RSS — it's about making
sure the endpoint can't be turned into an SSRF weapon. Because this endpoint
takes a URL from the client (`?url=...`) and fetches it server-side, a naive
implementation would let any signed-in user probe the internal network,
Azure IMDS (`169.254.169.254`), or `localhost`.

The route defends itself in layers:

1. **Authentication first.** `verifyAuth()` runs before anything else. No
   session, no fetch. This is the [portal-wide rule](../.github/copilot-instructions.md)
   for every API route.
2. **Hostname allowlist.** `RSS_ALLOWED_HOST_SUFFIXES` limits fetches to
   `*.microsoft.com`, `*.azure.com`, `*.github.com`, and a handful of security
   authorities (NIST, CISA, MITRE). Anything else is a 400.
3. **`assertExternalUrl`** (from `lib/validators`) enforces HTTPS-only, blocks
   private/loopback IPs, and re-checks the hostname after DNS-safe parsing.
4. **`redirect: 'error'`** on the outbound fetch. Redirects are a classic
   allowlist-bypass trick; we refuse them outright.
5. **Cache boundary.** `next: { revalidate: 3600 }` means one fetch per feed
   per hour — pleasant for us, pleasant for Microsoft's edge.

The whole thing is a good example of what the portal's copilot instructions
call the **BFF pattern**: the browser never touches an access token, an
external URL, or a raw HTML response. It asks the server for a typed JSON
payload, and that's it.

### `zod` for validation elsewhere

We didn't need Zod inside this route (the input is a single URL, validated
by `assertExternalUrl`), but it's worth naming as part of the stack because
every Server Action and mutating route in the portal uses Zod schemas from
`lib/schemas/`. It's how we keep the "never trust the client" rule mechanical
instead of aspirational.

---

## The component pattern that made this cheap

`NewsFeedPage` is a **single presentational component** that takes six props:

```tsx
type NewsFeedPageProps = {
  title: string
  subtitle: string
  feedUrl: string
  loadingText: string
  emptyText: string
  errorPrefix: string
}
```

Every product blog page is a ten-line file that fills those props in:

```tsx
// src/app/news/microsoft-foundry/blog/page.tsx
import NewsFeedPage from '../../components/NewsFeedPage'

export default function MicrosoftFoundryBlogPage() {
  return (
    <NewsFeedPage
      title="Microsoft Foundry Blog"
      subtitle="Latest posts from the Microsoft Foundry developer blog"
      feedUrl="https://devblogs.microsoft.com/foundry/feed/"
      loadingText="Loading Foundry posts..."
      emptyText="No Foundry posts found"
      errorPrefix="[Microsoft Foundry Blog] Error:"
    />
  )
}
```

Adding the ninth blog will take about ninety seconds:

1. Create the page file with those props.
2. Register the route in [`lib/route-registry.ts`](../src/lib/route-registry.ts)
   so the breadcrumb shows a proper title.
3. If the source host is new, add its suffix to `RSS_ALLOWED_HOST_SUFFIXES`.

That's it. No new API, no new component, no new CSS.

---

## What I'd add next

Three obvious upgrades, in priority order:

- **Swap the regex parser for `fast-xml-parser`** (already in the project's
  `package.json`). The current regex approach works but chokes on malformed
  CDATA and namespaced tags.
- **Wrap the client fetch in SWR** (also already a dependency). It would give
  us stale-while-revalidate, deduped requests across tabs, and free retry on
  focus — with fewer lines of code than the current `useEffect`.
- **Add a unified "All Microsoft" feed** that fans out all eight allowed URLs
  in parallel and merges by `pubDate`. The infrastructure already supports it;
  it's just a route handler that awaits `Promise.all` and sorts.

None of these are urgent. The feature does what it needs to today, and the
architecture leaves each of them as a small, contained change. Which, in the
end, is the point of building on components that each earn their keep.
