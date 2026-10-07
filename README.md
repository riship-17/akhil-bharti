# ABRSM Gujarat – State Conference 2026 Registration

MERN app for conference registration: participants fill their details, pay ₹500 by scanning the organiser's UPI QR, enter the UTR and upload the payment screenshot. Organisers verify payments in an admin panel and send confirmations by email and WhatsApp.

```
client/   React (Vite) — public site + /admin panel
server/   Express + MongoDB (Mongoose). Uploads stored in MongoDB GridFS
shared/   Form options (districts, designations) and validation used by both
```

## Run locally

```bash
npm install                          # installs client + server (npm workspaces)
cp server/.env.example server/.env   # then edit the values
npm run dev                          # API on :5000, site on http://localhost:5173
```

Needs MongoDB running locally (`brew services start mongodb-community`) or a MongoDB Atlas connection string in `MONGODB_URI`.

- Public site: `http://localhost:5173`
- Organiser panel: `http://localhost:5173/admin` (password = `ADMIN_PASSWORD` in `server/.env`)

## First-time setup in the admin panel

Go to **Payment & settings** and:
1. Upload the QR image from your bank / UPI app — or just enter the UPI ID and the site generates a QR with ₹500 pre-filled.
2. Fill in bank name, account number and IFSC (optional — empty fields are hidden).
3. Add contact people so participants can call for help.

## Verifying payments

**Registrations** opens on the *Pending* tab. Click a row, compare the UTR and screenshot with your bank / UPI statement, then:
- **Verify payment** — marks it confirmed and emails the participant (if email is set up).
- **Send confirmation on WhatsApp** — opens WhatsApp with a ready bilingual confirmation message.
- **Reject** — requires a note; the participant sees it on the *Check status* page.

**Export CSV** downloads the current list (opens correctly in Excel, including Gujarati).

## Email (optional)

Set `SMTP_*` in `server/.env`. For Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, your address as `SMTP_USER`, and a Google **App Password** as `SMTP_PASS`. Without SMTP the app works normally — use the WhatsApp button for confirmations.

## Deploy (single service)

Any Node host (Render, Railway, a VPS):

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `MONGODB_URI` (MongoDB Atlas), `ADMIN_PASSWORD`, `JWT_SECRET`, optional `SMTP_*`

The Express server serves the built React app and the API from the same URL. Uploaded screenshots are kept in MongoDB, so no persistent disk is needed.
