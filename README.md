# ABRSM Gujarat – State Conference 2026 Registration

MERN app for conference registration: participants create an account, fill in their details, pay ₹500 by scanning the organiser's UPI QR and upload the payment screenshot. Organisers verify payments in the admin panel and send each participant a Bhojan Pass (a QR code for the food counter) by email — one at a time or as a broadcast — and a certificate of participation after the conference.

```
client/   React (Vite) — public site + /admin panel
server/   Express + MongoDB (Mongoose). Uploads stored in MongoDB GridFS
shared/   Form options (districts, designations) and validation used by both
```

## Run locally

```bash
npm install                          # installs client + server (npm workspaces)
cp server/.env.example server/.env   # then edit the values
npm run dev                          # API on :5050, site on http://localhost:5173
```

Needs MongoDB running locally (`brew services start mongodb-community`) or a MongoDB Atlas connection string in `MONGODB_URI`.

- Public site: `http://localhost:5173`
- Organiser panel: `http://localhost:5173/admin` (password = `ADMIN_PASSWORD` in `server/.env`)

## How registration works

1. **Account.** Participants create an account (name, email, mobile, password) and log in. Passwords are hashed with scrypt. "Forgot password" emails a reset link that works for 30 minutes (needs email, see below); resetting signs out every other session.
2. **Form + UPI payment.** The last step of the form shows a QR code for the organiser's PhonePe UPI `9879930825-4@ybl` with ₹500 pre-filled (on phones there is also a *Pay in UPI app* button). The participant pays, types the UTR and uploads the payment screenshot. One active registration per account; the registration always uses the account's email.
3. **Verification.** Organisers compare the UTR and screenshot with the bank statement and verify or reject it.
4. **Bhojan Pass.** Organisers then send the pass, one at a time or as a broadcast (below). It is emailed and also appears under **My registration** (`/account`), where participants can see their status at any time.

Registrations made before accounts existed are linked to an account automatically when someone signs up with the same email and mobile number.

### Screenshot storage

Screenshots are stored in MongoDB (GridFS), so they are kept small: the browser first shrinks the image (max 1080 px wide, JPEG), then the server re-encodes it as WebP, at most 900 px wide (`server/src/lib/files.js`). A typical 1–3 MB phone screenshot ends up around 40–120 KB with the UTR still readable. PDFs can't be shrunk this way and are only accepted up to 2 MB. iPhone HEIC photos are converted in Safari; elsewhere participants are asked for a JPG/PNG.

## First-time setup in the admin panel

Go to **Payment & settings** and:
1. Check the UPI ID (defaults to `9879930825-4@ybl`, AKHIL BHARTIY RASHTRIY SHAIKSHIK MAHASANGH GUJARAT). The site turns it into a QR with ₹500 pre-filled. You can upload the PhonePe QR image instead, but then participants must type the amount themselves.
2. Fill in bank name, account number and IFSC (optional — empty fields are hidden).
3. Add contact people so participants can call for help.

## Verifying payments

**Registrations** opens on the *Pending* tab. Click a row, compare the UTR and screenshot with your bank / UPI statement, then:
- **Verify payment** — marks it confirmed. Nothing is emailed yet; send the Bhojan Pass next.
- **Reject** — requires a note; the participant is emailed and sees the note under *My registration*.

**Export CSV** downloads the current list (opens correctly in Excel, including Gujarati).

## Sending the Bhojan Pass

Two ways, both from **Registrations**:
- **One at a time:** open a verified registration and click **Send Bhojan Pass** (or **Email pass again**).
- **Broadcast:** the *Bhojan Pass* panel at the top shows how many verified participants have been emailed. **Broadcast to N** emails everyone verified who hasn't received it yet, within the daily email limit (see *Daily email limit* below); you can leave the page while it runs. Failed sends are listed and retried by broadcasting again, which never re-sends to people who already got theirs.

The table's *Bhojan Pass* column shows who has been emailed. Without email set up, **Send Bhojan Pass** still puts the pass in the participant's account (the broadcast needs email). A pass link or QR only works once the pass has been sent, and shows **NOT VALID** if the registration is later moved out of *verified*.

## Email with Resend (optional)

Set `RESEND_API_KEY` in `server/.env` (Resend → API Keys). The site then emails:

- **Confirmation + Bhojan Pass**, with the fee receipt (PDF) attached: when an organiser sends it (see above). The QR code is inside the email, with a link to `/pass/<code>`.
- **Password reset**: when a participant uses *Forgot password*.
- **Rejected**: with the admin's note.
- **Certificate of participation**: after the conference (see below).

**Before going live, verify a sending domain.** In Resend → Domains, add your domain (for example `abrsmgujarat.org`), add the DNS records it shows, and wait until it says *Verified*. Then set `MAIL_FROM="ABRSM Gujarat <noreply@abrsmgujarat.org>"`. Until then, leave `MAIL_FROM` on `onboarding@resend.dev`: Resend only delivers those emails to the address you signed up to Resend with, so they are only useful for testing. A Gmail address cannot be used as `MAIL_FROM`. Set `MAIL_REPLY_TO` if participants should be able to reply to a real inbox.

### Daily email limit

**Payment & settings → Email sending limit** sets the most emails the site sends in any 24 hours (default 300). Bhojan Pass broadcasts and certificates go out in phases: they send until the limit is reached, pause, and carry on by themselves once room frees up in the rolling 24 hours (also after a server restart). The panels show progress, emails used in the last 24 hours, when sending resumes, and a *Stop sending* link. Single emails (one pass, a password reset, a rejection) always go out and count towards the limit, so keep it within your Resend plan: the free plan allows 100 emails a day and 3,000 a month; Pro has no daily limit.

Without email set up, the app still works, but nothing is emailed: passes only appear in participants' accounts, and *Forgot password* asks people to call the organisers.

## Certificates

After the conference, go to **Payment & settings → Certificates**:
1. Add up to three signatories (name and role), click **Save changes**, then **preview the certificate**.
2. Click **Send certificates**. Every confirmed participant gets an email with their certificate as a PDF, in daily phases within the email limit, and the page shows progress. If some fail, click the button again; it only sends to people who haven't received theirs yet.

Once certificates have been sent, participants can also download theirs under **My registration**. A single certificate can be previewed or emailed again from the registration drawer.

Certificates are drawn on the server with the bundled Noto Serif fonts (`server/assets/fonts`, SIL Open Font License), so names in Gujarati come out correctly. On Linux, the fonts are picked up through `fonts.conf` in that folder. On macOS, local previews use the system fonts instead and look slightly different.

## Deploy (single service)

Any Node host (Render, Railway, a VPS):

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `MONGODB_URI` (MongoDB Atlas), `ADMIN_PASSWORD`, `JWT_SECRET`, `PUBLIC_URL`, optional `RESEND_API_KEY` / `MAIL_FROM`

The Express server serves the built React app and the API from the same URL. Uploaded screenshots are kept in MongoDB, so no persistent disk is needed.

### Frontend on Vercel, API on Render

If the site is served from Vercel (project root directory `client`), `client/vercel.json` forwards `/api/*` to the Render service and sends every other path to the React app. Change the Render address in that file if your service URL is different. Set `PUBLIC_URL` on Render to the Vercel address (e.g. `https://akhil-bharti.vercel.app`) so pass, certificate and password-reset links point there.
