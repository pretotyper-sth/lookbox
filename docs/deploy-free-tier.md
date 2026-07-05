# LOOKBOX Free-Tier Deployment

This is the deployment path for the service version of LOOKBOX.

## Services

- Frontend: Vercel, root directory `frontend`
- Backend: Render Web Service, root directory `backend`
- Auth, DB, Storage: Supabase
- Keep-alive: UptimeRobot

## Supabase

Create a Supabase project and run:

```sql
-- Supabase SQL Editor
-- Paste the contents of supabase/schema.sql
```

Create a storage bucket:

```txt
wardrobe
```

For the current beta, a public bucket is the simplest option. Move to private
storage with signed URLs before handling real customer data at scale.

## Render

Create a Web Service.

```txt
Name: lookbox-api
Root Directory: backend
Language: Python 3
Branch: main
Region: Singapore
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```txt
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4o
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_QUALITY=medium
SUPABASE_URL=https://xxaghgxyppkceobvtcyl.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET=wardrobe
FRONTEND_ORIGINS=https://lookbox.vercel.app,http://localhost:5173
APP_ENV=production
DEFAULT_IMAGE_CREDITS=25
```

Health check:

```txt
https://lookbox-w1st.onrender.com/health
```

## Vercel

Use the existing Vercel project or create a new one.

```txt
Root Directory: frontend
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Environment variables:

```txt
VITE_API_BASE_URL=https://lookbox-w1st.onrender.com
VITE_SUPABASE_URL=https://xxaghgxyppkceobvtcyl.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Do not put these in Vercel:

```txt
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## UptimeRobot

Create an HTTP(s) monitor.

```txt
URL: https://lookbox-w1st.onrender.com/health
Interval: 5 minutes
```

The free monitor keeps Render's free web service warm most of the time. Render
can still restart free instances, so this is a beta workaround rather than a
production availability guarantee.

## Cost Controls

- New users start with `DEFAULT_IMAGE_CREDITS`.
- Product image generation charges one credit.
- Outfit image generation charges one credit.
- Same outfit image combinations are cached in `generated_images`.
- Daily outfits are opt-in, not automatic.
