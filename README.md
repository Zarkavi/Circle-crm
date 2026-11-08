# Circle — personal CRM

A private app for remembering the people in your life: their kids' names, where they work, what you talked about last time, and small details like their coffee order.

- **Works on iPhone and Android** as an installable web app (PWA): no App Store needed
- **Login** with email + password or a magic link (Supabase Auth); each user only sees their own data (Row Level Security)
- **Modern UI**: React + Tailwind with shadcn-style components, dark/light mode, bottom tabs on phones, sidebar on desktop

## Features

| Area | What you get |
| --- | --- |
| People | Name, nickname, birthday (year optional), city, phone/email, how you met, notes, favorites |
| Small details | Categorised facts: food, drinks, hobbies, gift ideas, dislikes, health… |
| Family & connections | Children/spouse/pets with names and birthdays, plus links between people (shown on both pages) |
| Work history | Current and past jobs |
| Meetings | Timeline of meetings, calls and coffees, with an optional follow-up reminder |
| Reminders | One-off, monthly or yearly, plus birthdays (including kids') and "haven't talked in X days" nudges |
| Tags & search | Tags with colours; search across every field ("who has a dog named Max?") |
| Backup | Export or import everything as JSON |

## Try it locally (demo mode)

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in **demo mode** with sample data saved in your browser.

## Go live (about 10 minutes)

### 1. Supabase (database + login)
1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**: paste `supabase/schema.sql` and click **Run**.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
4. **Authentication → URL Configuration**: set *Site URL* to your app's URL (for example `https://circle-yourname.vercel.app`).

### 2. Deploy (Vercel; Netlify and Cloudflare Pages work the same way)
1. Push this folder to a GitHub repository.
2. Import it at https://vercel.com/new (it detects Vite automatically).
3. Add these environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

`vercel.json` already sends every route to `index.html`, so deep links work.

### 3. Lock it down
1. Open the deployed app and **create your account**.
2. In Supabase, go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. After that, nobody else can create an account.

### 4. Install on your phone
- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** ⋮ → *Install app*

## Project layout

```
supabase/schema.sql      tables + row level security
src/lib/backend.ts       Supabase backend + localStorage demo backend
src/lib/insights.ts      birthdays, nudges, search, relationship labels
src/state/               auth, data store, theme
src/pages/               Today, People, Person, Search, Reminders, Settings, Login
src/components/          UI kit, forms, app shell
```
