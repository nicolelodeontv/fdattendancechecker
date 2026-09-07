# FD Attendance Check Tracker

A compact Final Discord attendance response tracker styled to match the NZ Tracker UI: Geist typography, Geist Mono labels, dark compact panels, orange accent, and Philippine server time.

## Features

- IGN, Attendance, Pilot, Pilot Name, Hours, and optional Notes
- Attendance and Pilot choices use Discord-style ✅ / ❌ indicators
- One shared 48-hour response deadline, initialized on first load
- Live countdown and server clock using Asia/Manila (UTC+8)
- Submitted response becomes locked on the submitter's browser/device
- Admin area can edit or delete every submitted response
- Persistent shared data stored through the GitHub Contents API

## Vercel environment variables

Set these in the Vercel project:

- `GITHUB_TOKEN` — GitHub token with permission to read/write this private repository's contents
- `ADMIN_PASSWORD` — private password used by the Admin Controls panel

Do not put either value in the repository.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
