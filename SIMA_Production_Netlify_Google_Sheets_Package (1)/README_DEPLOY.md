# SIMA Production — Netlify + Google Sheets

This package is a deployable **production-connected application**, not a locally simulated demo. It has no Firebase dependency and does not need app-store publication. The student interface preserves SIMA's approved design, founder photograph, animated character, 11 books and 72 chapters. Student records, quizzes, points, leaderboard, certificates and administrator actions require the live Google Sheets backend.

## 1. Set up your Google Sheet

1. Create a **new private Google Sheet** in the Google account that will own SIMA.
2. Open **Extensions → Apps Script**. Replace the editor contents with `google-apps-script/Code.gs` from this package.
3. Save. Run `setupSIMA` once; grant Google permissions. This creates the database tabs.
4. Run `seedStarterQuestions` once to publish 20 real starter questions. You can add more later through Creator Studio.
5. In Apps Script **Project Settings → Script properties**, find the automatically generated `SIMA_BACKEND_SECRET` value. Keep it private; copy it for Netlify.
6. To set your admin password: temporarily edit the function call in Apps Script's editor to invoke `setAdminPasswordOnce('YOUR_LONG_UNIQUE_PASSWORD')` through a temporary function, run it once, then **delete that temporary function and save**. Never commit the password to the website files or put it in the spreadsheet.
7. Select **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the Web App `/exec` URL. The backend rejects requests without its private secret, which Netlify stores server-side.

## 2. Deploy to Netlify

1. Push the contents of this folder to a **private Git repository** and connect it to Netlify (recommended). Netlify Functions are included in the project; uploading only `index.html` by drag-and-drop is not enough.
2. In Netlify **Site configuration → Environment variables**, set:
   - `SIMA_APPS_SCRIPT_URL` = your deployed Apps Script Web App `/exec` URL
   - `SIMA_BACKEND_SECRET` = the exact secret in Apps Script's Script properties
3. Deploy or redeploy the site. Open your Netlify URL, create a student nickname + 6–12 digit PIN, and check the private Google Sheet for the record.
4. Open `https://YOUR-SITE.netlify.app/admin.html` for the private Creator Studio. Its URL is not linked on the public student landing page. Sign in using the administrator password you set.

## 3. Real-world checks before inviting students

- Create a test student account; sign out and sign back in with the same nickname/PIN.
- Complete a chapter; verify the `Progress` sheet changes.
- Take a practice quiz and a competition. Scores are calculated on the server, and each attempt can be submitted only once.
- Reach at least 80% on a competition, open the certificate, print/save PDF, and verify its ID in Creator Studio.
- Add a question in Creator Studio and confirm it appears in future quizzes.
- Check mobile layout, accessibility and browser speech support.

## Important limitations and responsibilities

- The student account uses a **nickname and PIN**, not email. Avoid collecting students' real names or contact details without appropriate consent and a privacy notice. PIN recovery is **not yet implemented**. Use a unique PIN and keep it safe.
- This version uses a basic Apps Script + Sheets authentication model, not a fully audited identity provider. It stores salted SHA-256 PIN hashes and session-token hashes, and it requires HTTPS and a private backend secret. **Before a large public launch**, add stronger password hashing, login rate limiting, moderation, data-retention and account recovery policies, and review applicable child-data privacy requirements.
- Google Apps Script / Sheets has execution and usage quotas. This stack is appropriate for a modest school-scale pilot, not unlimited simultaneous users.
- The sample content in the HTML is published educational material; lesson content is not yet editable in the admin dashboard. Quiz questions *are* editable through Creator Studio and stored in Sheets.
- The certificate is generated from a recorded qualifying score and can be checked by its ID in Creator Studio. It is not a government-accredited qualification or a promise of a prize.
- No payments, advertising, AI image-generation service or automatic prize fulfillment are integrated.
- Browser speech depends on the device's Web Speech support.
- Keep your Google Sheet **private**. Do not publish it to the web or place the Apps Script secret in frontend JavaScript.
