# Fabula Studio

A desktop-first Fabula-inspired writing/worldbuilding CMS using React + Vite + Supabase.

## 1. Supabase
1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql` in one go.
4. In Project Settings → API, copy the Project URL and anon/publishable key.
5. Copy `.env.example` to `.env.local` and fill the values.
6. Enable Email auth in Authentication → Providers.

## 2. Local
```bash
npm install
npm run dev
```

## 3. GitHub
Push this folder to a GitHub repository. Build with `npm run build`.

For GitHub Pages, the Vite app can be deployed from the `dist` folder using GitHub Actions. A workflow example is included in `.github/workflows/deploy.yml`.

## Architecture
- GitHub: source code + static deployment
- Supabase Postgres: all editable content
- Supabase Auth: owner login
- Supabase Storage: artwork/gallery
- RLS: authenticated owner can edit; public/anonymous can read published content

The editor is intentionally separated from the public read view, while both use the same Supabase data.
