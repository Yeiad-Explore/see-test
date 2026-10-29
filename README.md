# SeeTest

Student ID login (one login per ID) → 9 "can you see it?" pictures → shape question → results in a Google Sheet.

## Run

    node server.js                    # http://localhost:3000, results in data/store.json only
    node --env-file=.env server.js    # also sends every result to the Google Sheet in .env

`data/store.json` is the source of truth (logins, start times, results). Results are sent to the Sheet in batches in the background
and retried every 10 s until the Sheet accepts them, so a slow or offline Google never blocks a student and nothing is lost.

## Google Sheet

One-time setup (by whoever owns the script, e.g. you):

1. https://script.google.com → New project → paste `apps-script/Code.gs`, change `SECRET`.
2. Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → Authorize → copy the `/exec` URL.
3. Copy `.env.example` to `.env`: `SCRIPT_URL` = that URL, `SCRIPT_SECRET` = your `SECRET`, `SHEET_LINK` = the sheet's link.

Using the teacher's sheet: the teacher shares their sheet with the script owner's Google account as **Editor**, and sends the link.
Put it in `SHEET_LINK` and restart. No redeploy. On start the server copies every result that is not yet in that sheet into it.
The script writes only two tabs, created if missing: `SeeTest results` (one row per student) and `Correct answers` (the answer key,
rewritten from `questions.js` on every send). Other tabs are left alone. After editing `Code.gs`, redeploy: Deploy → Manage deployments → Edit → New version.
If the sheet isn't shared, the server log says so and keeps retrying.

Columns: Student ID, Logged in at, Started at, Submitted at, one column per picture (Correct / Not correct / Not answered),
Shapes correct, Shapes not correct, Shapes picked, Picture score, Shape score, Total, Out of, Time taken (s), Late, Ref.
Ref is a submission code the script uses to avoid duplicate rows; don't edit it.

## Add the pictures

All images are already in `public/img/` (originals in `source/`). In `questions.js`, `targets` are the correct tap circles for each picture (no `targets` = object absent).
In the shape question, A, B and C are the three hidden shapes (`shape_A/B/C.png`); the other options are decoys.

## Exam rules

- After login the student sees a Start screen. Timer: `EXAM_MINUTES` in `questions.js` (15). It starts when they press Start and the server tracks it, so a reload or a changed device clock can't extend it. At zero the page submits by itself. Late submissions are still saved, with `LATE` in the sheet.
- A student who closes the tab can reopen the page on the same browser and continue (answers and time kept). A different browser or device can't log in again.
- Each student sees the questions and shape options in their own order.
- Students see "Test submitted" only, never their marks.
- To let a student retake: stop the server, delete their entry under `logins` in `data/store.json`, start again.

## Marks

- Each of the 9 pictures: 1 mark for tapping inside a target circle, or for "No …" when the object is absent.
- Shapes: +1 per correct shape picked (A, B, C), −1 per wrong one (never below 0). Out of 3.
- Total out of 12.
