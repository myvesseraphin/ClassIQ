# ClassIQ

ClassIQ is a full-stack learning portal for students. It brings courses, assessments, exercises, resources, schedules, and notifications into one place, with a simple request-access flow.

**Features**
- Authentication (login, register, password reset)
- Student dashboard data (courses, assessments, exercises, resources)
- Tasks, schedule, notifications, and personalized learning plan (PLP)
- Request access with `fullName`, `school`, and `email`

**Tech Stack**
- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express
- Database: Postgres (Supabase recommended)

**Getting Started**
1. Install Node.js 18+ and npm.
2. Create a Postgres database (Supabase works well).
3. Run the database scripts in the Supabase SQL editor in this order: `Backend/Database/Tables.sql`, then `Backend/Database/Missing_Tables.sql`.
4. Start the backend:
```bash
cd Backend
npm install
npm run dev
```
5. Start the frontend (new terminal):
```bash
npm install
npm run dev
```

**Environment Variables**
- Frontend: `VITE_API_URL` (defaults to `http://localhost:4000/api`)
- Backend: `DATABASE_URL`
- Backend: `PGSSL` (set to `true` for Supabase SSL)
- Backend: `PORT` (defaults to `4000`)
- Backend: `CORS_ORIGIN` (comma-separated allowed origins, defaults to `*`)
- Backend: `JWT_SECRET`
- Backend: `JWT_EXPIRES_IN` (defaults to `7d`)
- Backend: `RESET_TOKEN_TTL_MINUTES` (defaults to `15`)
- Backend: `RETURN_RESET_TOKEN` (`true` to return reset token in dev)
- Backend: `SMTP_HOST`
- Backend: `SMTP_PORT`
- Backend: `SMTP_USER`
- Backend: `SMTP_PASS`
- Backend: `SMTP_FROM` (defaults to `SMTP_USER`)

**Useful Endpoints**
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/request-access`

**Project Structure**
- Frontend app: `src`
- Backend API: `Backend/src`
- Database scripts: `Backend/Database`
