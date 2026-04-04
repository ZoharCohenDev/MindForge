# LearnOS Starter

A clean React + TypeScript + Supabase starter for your personal learning and project hub.

## What is included

- Protected app shell with a sidebar layout
- Supabase email/password auth
- CRUD starter flows for:
  - Topics (AI Tree)
  - Projects
  - Notes
  - Resources
- Dashboard with quick stats
- SQL schema with RLS policies

## 1) Create the Supabase project

- Create a new Supabase project.
- Open the SQL Editor.
- Paste `supabase/schema.sql` and run it.
- In **Authentication > Providers**, keep Email enabled.
- In **Authentication > Users**, you can create a user manually or use the signup form from the app.

## 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## 3) Run locally

```bash
npm install
npm run dev
```

## 4) Deploy to Vercel

- Push this folder to GitHub.
- Import the repo into Vercel.
- Add the same environment variables in the Vercel project settings.
- Deploy.

## Good next improvements

- Add edit and delete actions
- Add Markdown editor for notes
- Add topic hierarchy tree UI
- Add task board page
- Add tags and search
- Add profile page and avatar

## AI Tree upgrade
- The full AI tree can now be seeded from the UI into Supabase.
- Every topic can have:
  - child topics
  - inline notes
  - done / not-done checkbox
- Topic notes are saved in `public.notes` with `topic_id`.
- If you already ran the old SQL schema, run `supabase/ai-tree-migration.sql`.
