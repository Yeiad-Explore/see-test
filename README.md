# SeeTest

Student ID login (one login per ID) → 9 "can you see it?" pictures → 3 shape questions → results in a Google Sheet.

## Run and deploy

Logins, start times and results live in a Supabase database (`supabase/schema.sql`; every step is one atomic database function, so 100
students at once is safe). Finished results are copied to the Google Sheet in batches, one batch at a time; a failed batch is retried
after 60 s by the next submit, by `/api/sync`, or by the daily cron. A slow Google never blocks a student and nothing is lost.

    node --env-file=.env server.js    # local, http://localhost:3000 (same database as production)
    npx vercel deploy --prod          # production; settings are Environment Variables with the names in .env.example

Live: https://seetest.vercel.app. After changing an environment variable, redeploy. Turn off Vercel's Deployment Protection
(Project > Settings > Deployment Protection > Vercel Authentication: off) or students are asked to log in to Vercel.
Retake / reset a student: delete their row in the `logins` table (Supabase > Table editor).

## Google Sheet

One-time setup (by whoever owns the script, e.g. you):

1. https://script.google.com → New project → paste `apps-script/Code.gs`, change `SECRET`.
2. Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → Authorize → copy the `/exec` URL.
3. Copy `.env.example` to `.env`: `SCRIPT_URL` = that URL, `SCRIPT_SECRET` = your `SECRET`, `SHEET_LINK` = the sheet's link.

Using the teacher's sheet: the teacher shares their sheet with the script owner's Google account as **Editor**, and sends the link.
Put it in `SHEET_LINK` (Vercel env var, then redeploy). The next send copies every result that is not yet in that sheet into it.
The script writes only two tabs, created if missing: `SeeTest results` (one row per student) and `Correct answers` (the answer key,
rewritten from `questions.js` on every send). Other tabs are left alone. After editing `Code.gs`, redeploy: Deploy → Manage deployments → Edit → New version.
If the sheet isn't shared, the Vercel function log says so and the results stay safe in the database.

Columns: Student ID, Logged in at, Started at, Submitted at, one column per picture and per shape (Correct / Not correct / Not answered),
Shapes correct, Shapes not correct, Picture score, Shape score, Total, Out of, Time taken (s), Ref.
Ref is a submission code the script uses to avoid duplicate rows; don't edit it.

## Add the pictures

All images are already in `public/img/` (originals in `source/`). In `questions.js`, `targets` are the correct tap circles for each picture (no `targets` = object absent).
Shape questions (`SHAPES` in `questions.js`): `shape-1/2/3.png` are the drawings and `red-a/b/c.png` the red options. Each question shows one drawing and the student taps the red shape hidden in it. Shape 1 = A, shape 2 = B, shape 3 = C. Originals are in `source/`.

## Exam rules

- After login the student sees a Start screen. There is no timer and no time limit; the sheet records when they logged in, started and submitted, and the time taken.
- A student who closes the tab can reopen the page on the same browser and continue (answers and time kept). A different browser or device can't log in again.
- Each student sees the questions and shape options in their own order.
- Students see "Test submitted" only, never their marks.
- To let a student retake: stop the server, delete their entry under `logins` in `data/store.json`, start again.

## Marks

- Each of the 9 pictures: 1 mark for tapping inside a target circle, or for "No …" when the object is absent.
- Each of the 3 shape questions: 1 mark for tapping the right red shape. Total out of 12.
