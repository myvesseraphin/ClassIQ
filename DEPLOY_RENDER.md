# ClassIQ Deployment on Render

Use these exact values when creating services in Render.

## Step 1: Backend API (Already Live)

Your backend is already deployed on Render:

- Service name: `ClassIQ`
- URL: `https://classiq-r6vf.onrender.com`

If you keep using this existing backend, skip backend creation and go to Step 2.

If you ever need to recreate backend from this repo, use the values below.

## Step 1B: Create Backend API Service (Optional)

In Render dashboard:

1. Click `New +` -> `Web Service`.
2. Connect this repository.
3. Fill the fields:

| Field | Value to insert |
|---|---|
| Name | `ClassIQ` (or `classiq-api`) |
| Runtime | `Node` |
| Branch | `main` (or your deploy branch) |
| Root Directory | `Backend` |
| Build Command | `npm ci` |
| Start Command | `npm run start` |
| Health Check Path | `/api/health` |

4. In `Environment Variables`, insert:

| Key | Value to insert |
|---|---|
| `DATABASE_URL` | your Postgres URL (Supabase or Render Postgres) |
| `CORS_ORIGIN` | your frontend URL (for example `https://classiq-web.onrender.com`) |
| `JWT_SECRET` | a long random secret (or click Generate in Render) |
| `JWT_EXPIRES_IN` | `7d` |
| `RESET_TOKEN_TTL_MINUTES` | `15` |
| `RETURN_RESET_TOKEN` | `false` |

Optional backend env vars (only if you use those features):

| Key | Example |
|---|---|
| `PGSSL` | `true` |
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your SMTP username |
| `SMTP_PASS` | your SMTP password/app password |
| `SMTP_FROM` | sender email |
| `GEMINI_API_KEY` | your Gemini API key |

5. Click `Create Web Service`.

Current API URL:
`https://classiq-r6vf.onrender.com`

## Step 2: Create Frontend Static Site

In Render dashboard:

1. Click `New +` -> `Static Site`.
2. Select the same repository.
3. Fill the fields:

| Field | Value to insert |
|---|---|
| Name | `classiq-web` |
| Branch | `main` (or your deploy branch) |
| Root Directory | `.` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

4. In `Environment Variables`, insert:

| Key | Value to insert |
|---|---|
| `VITE_API_URL` | `https://classiq-r6vf.onrender.com/api` |

5. In `Redirects/Rewrites`, add SPA rewrite:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | `Rewrite` |

6. Click `Create Static Site`.

After deploy, copy your frontend URL, for example:
`https://classiq-web.onrender.com`

## Step 3: Final CORS Check

If your frontend URL is not exactly `https://classiq-web.onrender.com`:

1. Open the `ClassIQ` service in Render.
2. Go to `Environment`.
3. Update `CORS_ORIGIN` to the exact frontend URL.
4. Redeploy backend.

## Step 4: Verify

Run these checks:

1. Backend health: `https://YOUR_API_URL/api/health`
2. Frontend loads: `https://YOUR_FRONTEND_URL`
3. Login/register calls succeed from frontend without CORS errors.

## Blueprint Option (Fastest)

This repo includes [`render.yaml`](./render.yaml).

You can deploy both services at once:

1. Render -> `New +` -> `Blueprint`.
2. Select this repository.
3. Render will prompt for:
   - `DATABASE_URL`
   - `CORS_ORIGIN`
   - `VITE_API_URL`
4. Insert the same values listed above and deploy.
