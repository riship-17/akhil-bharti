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

## Online payment with Razorpay (optional)

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `server/.env` (Razorpay Dashboard → Account & Settings → API Keys). The payment step then opens Razorpay Checkout instead of the UPI QR. Payments are checked on the server, and the registration is confirmed straight away, with no screenshot and no manual check. If the keys are empty, the site goes back to the UPI QR + UTR + screenshot flow above.

Also recommended: in Razorpay Dashboard → Webhooks, add `https://<your-site>/api/pay/webhook` with the events `payment.captured` and `order.paid`, then put the webhook secret in `RAZORPAY_WEBHOOK_SECRET`. With the webhook in place, a registration is still saved if the participant closes the page right after paying.

UPI must be switched on for your Razorpay account (Dashboard → Account & Settings → Payment methods). If it is off, Checkout shows only cards, net banking and wallets.

Use `rzp_test_…` keys while testing (test card `4111 1111 1111 1111`, any future expiry, any CVV; or UPI ID `success@razorpay`). Switch to `rzp_live_…` keys before going live.

## WhatsApp Bhojan Pass with AiSensy (optional)

When a registration is confirmed (automatically after a Razorpay payment, or when an admin clicks **Verify payment**), the site sends a **Bhojan Pass** on WhatsApp: a QR code image plus a link to `/pass/<code>`. Scanning the QR code at the food counter opens that page, which shows **VALID** with the person's name and registration number. Participants can also open their pass from **Check status**, and admins can resend it from the registration drawer.

Setup in AiSensy:
1. Finish WhatsApp Business (WABA) verification in AiSensy. Until then AiSensy rejects every send with "WABA is not verified".
2. Create a template (category **Utility**) with an **Image** header and three body variables, for example:
   ```
   નમસ્તે {{1}},
   ABRSM ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ માટે આપનું રજિસ્ટ્રેશન કન્ફર્મ થયું છે.
   નોંધણી નંબર: {{2}}
   ભોજન સમયે ઉપરનો QR કોડ કાઉન્ટર પર બતાવો. ભોજન પાસ: {{3}}
   તારીખ: ૨૦ ડિસેમ્બર ૨૦૨૬, રવિવાર · ગુજરાત યુનિવર્સિટી કન્વેન્શન સેન્ટર, અમદાવાદ
   ```
   `{{1}}` = participant name, `{{2}}` = registration number, `{{3}}` = pass link. Keep this order.
3. Once Meta approves the template, create an **API campaign** that uses it, set it **Live**, and put its exact name in `AISENSY_CAMPAIGN_NAME`.
4. Set `AISENSY_API_KEY` (AiSensy → Manage → API Key) and `PUBLIC_URL` (the site's public https address). AiSensy downloads the QR image from `PUBLIC_URL`, so this only works on the deployed site, not on `localhost`.

If any of the three settings is empty, nothing is sent, but passes still work through **Check status**. Failed sends are shown in the admin drawer ("Last attempt failed: …").

## Email (optional)

Set `SMTP_*` in `server/.env`. For Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, your address as `SMTP_USER`, and a Google **App Password** as `SMTP_PASS`. Without SMTP the app works normally — use the WhatsApp button for confirmations.

## Deploy (single service)

Any Node host (Render, Railway, a VPS):

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `MONGODB_URI` (MongoDB Atlas), `ADMIN_PASSWORD`, `JWT_SECRET`, optional `SMTP_*`

The Express server serves the built React app and the API from the same URL. Uploaded screenshots are kept in MongoDB, so no persistent disk is needed.
