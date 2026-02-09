# ClassIQ Backend

## Setup
- Create a Supabase project and run `Backend/sql/Tables.sql` in the SQL editor.
- Copy `Backend/.env.example` to `Backend/.env` and update the values.
- Install dependencies and run the API:
  - `npm install`
  - `npm run dev`

## Auth
- `POST /api/auth/login` { "email": "...", "password": "..." }
- `POST /api/auth/register` { "email", "password", "firstName", "lastName", "role?" }
- `POST /api/auth/request-password-reset` { "email" }
- `POST /api/auth/verify-reset-code` { "email", "code" }
- `POST /api/auth/reset-password` { "resetToken", "newPassword" }
- `POST /api/auth/request-access` { "fullName", "email", "School?"}
- `GET /api/auth/me` (Bearer token)

## Student data (Bearer token)
- `GET /api/student/profile`
- `PATCH /api/student/profile/settings` { "notifications", "autoSync" }
- `GET /api/student/dashboard`
- `GET /api/student/courses`
- `POST /api/student/appeals`
- `GET /api/student/assessments`
- `GET /api/student/exercises?includeQuestions=true`
- `GET /api/student/exercises/:id`
- `POST /api/student/exercises/:id/submit`
- `GET /api/student/exercises/:id/download`
- `GET /api/student/resources`
- `GET /api/student/plp`
- `GET /api/student/plp/:id`
- `GET /api/student/notifications`
- `PATCH /api/student/notifications/:id/read`
- `DELETE /api/student/notifications/:id`
- `DELETE /api/student/notifications`
- `GET /api/student/tasks`
- `POST /api/student/tasks`
- `PATCH /api/student/tasks/:id`
- `DELETE /api/student/tasks/:id`
- `GET /api/student/schedule`
- `POST /api/student/schedule`
- `DELETE /api/student/schedule/:id`

## Uploads
- `POST /api/uploads` (multipart/form-data, field: `file`)