# Rennerent Dashboard

## Setup

The server uses the Google Sheets API v4 and the configured spreadsheet ID in `lib/googleSheets.ts`. Enable the Google Sheets API in the service account's Google Cloud project, then share the spreadsheet with the service account email with Editor access. Keep the service account key private; it is excluded from Git.

```text
SESSION_SECRET=your-private-random-session-secret
GOOGLE_CREDENTIALS=<full contents of the service account JSON key>
```

For local development, place the service account key file at the project root as `renne-db-8dc44d24a856.json`; the `GOOGLE_CREDENTIALS` environment variable can be used instead. For Vercel, add `GOOGLE_CREDENTIALS` in **Project Settings > Environment Variables** and set its value to the complete contents of the service account JSON key. Add `SESSION_SECRET` there as well, select each environment where the app is deployed, and redeploy. Do not add either secret to Git or expose them in client-side variables such as `NEXT_PUBLIC_*`.

Run the app locally with `npm.cmd run dev` on Windows or `npm run dev` elsewhere, then open [http://localhost:3000](http://localhost:3000).

## Google Sheets tabs

The connected spreadsheet must contain `mobil`, `booking`, `keuangan`, `archive_booking`, `archive_keuangan`, and `users` tabs. The first row of each tab must contain its column names; the `users` header must include `username`, `password`, and optionally `nama`. Login credentials are checked server-side; the password values currently stored in the sheet are plain text, so restrict spreadsheet/API access and migrate to password hashes before exposing the application publicly.

New bookings and financial transactions are also copied to their archive tabs immediately, so they can be searched in Arsip while remaining in the active lists for the rest of the current calendar month. The Booking list uses the booking's `created_at` month; the Finance list uses the transaction's `tanggal` month. On the first day of the next month, older rows no longer appear in those active lists but remain searchable in Arsip by month or day. Booking payments are recorded as income in `keuangan`; the booking form's paid amount is cumulative, and only new amounts are added. Expenses are entered from the Finance page.

Booking service types are Lepas Kunci, Dengan Sopir, Antar Jemput Bandara, Event, or a custom value entered under Lainnya. Cars are marked Disewa while they have a booking that is not completed or cancelled, and return to Tersedia when no such booking remains; Maintenance status is preserved.

## Validation

Run `npx tsc --noEmit`, `npm run lint`, and `npm run build` to validate changes.
