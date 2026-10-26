# Mock Tracker

A revision and exam tracker built for one set of mocks: AQA Economics (Thursday 12 November), Edexcel Business and AQA Sociology (both Friday 13 November), with AAA as the target.

It runs on Next.js (App Router), Tailwind CSS, Supabase (Postgres + Auth) and Lucide icons, and deploys to Vercel.

## What it does

| Feature | Where | How it works |
| --- | --- | --- |
| Target & syllabus tracker | `/tracker` | 33 topics across the three subjects. Each has a red/amber/green light and a % complete. Per subject you see hours logged vs target, topics mastered, average completion, papers done vs target, and latest/average grade vs target. |
| Daily schedule | `/` and `/schedule` | The half-term → mop-up → timed-papers → mocks timetable is seeded for you (57 blocks). Today's page shows the current phase, exam countdowns and a checklist of today's blocks. Ticking a block logs its time against the subject, so "hours logged" fills itself in. |
| Past paper bank & score logger | `/papers` | Filter by AQA Econ, Edexcel Business or AQA Sociology. 37 papers (specimens plus the 2017–2025 series, including AS papers for Y12-only practice) with direct links where the board publishes them. Log a score and the grade is worked out from the boundaries. A Dropped Marks Analysis splits lost marks into knowledge gap, timing, structure and other, and tags weak topics. |
| Teach Me mini-tutor | `/teach/[topic]` | Every topic has a high-yield summary, key definitions, diagram checklists (Economics), formulas with worked answers (Business), key studies (Sociology), essay plans with model evaluation points, common mistakes and practice questions. An optional "Ask a follow-up" box uses Claude if you add an API key. |
| Settings | `/settings` | Target grade, hours and papers per subject, exam date and session, and your own grade boundaries once the school publishes them. |

## Database schema

Everything lives in its own Postgres schema called `mocks`, not in `public`. That lets the tracker share a Supabase project with another app (here, the homework tracker) without any table names clashing. It adds no triggers to `auth.users`, so sign-ups to the other app are unaffected.

Two migrations in `supabase/migrations/` build everything:

- `20261026000000_schema.sql`: tables, row level security, and the functions below.
- `20261026000100_reference_data.sql`: subjects, topics, the paper bank, default grade boundaries and the timetable.

**Reference data** (read-only for signed-in users):

| Table | Holds |
| --- | --- |
| `subjects` | The three papers: board, spec code, length, total marks, default exam date and session. |
| `topics` | 33 topics with section, spec reference, exam focus and estimated hours. |
| `past_papers` | Series, component, marks, duration, question paper and mark scheme links, and a fallback source page. |
| `plan_template` | The default timetable, copied into each user's schedule. |
| `grade_boundaries` | Minimum % per grade. Rows with `user_id = null` are defaults; your own rows override them. |

**Your data** (each row locked to its owner by RLS on `user_id = auth.uid()`):

| Table | Holds |
| --- | --- |
| `profiles` | One row per account. |
| `user_subjects` | Target grade, target hours, target papers, exam date and session per subject. |
| `topic_progress` | Red/amber/green status, % complete and notes per topic. |
| `schedule_items` | Your copy of the timetable. Edit, add or delete blocks; `completed_at` marks a tick. |
| `study_sessions` | Minutes logged. Ticked blocks create one automatically (linked by `schedule_item_id`). |
| `paper_attempts` | Date, paper, score out of total, timed or not, lost marks by reason, reflection, weak topics. A check constraint stops the dropped marks adding up to more than you lost. |

**Functions**

| Function | Does |
| --- | --- |
| `ensure_seeded()` | Called the first time you open the app. Runs `seed_user()` to create your profile, targets, red topic list and timetable. Safe to call again. |
| `set_block_done(item, done)` | Ticks or unticks a block and adds or removes the matching study session. |
| `reset_my_plan()` | Restores the original timetable. Logged hours stay. |

Target hours default to each subject's share of the planned timetable (Economics 30h, Business 26.5h, Sociology 32h).

## Core components

```
src/
  proxy.ts                     Refreshes the Supabase session; sends signed-out users to /login
  app/
    actions.ts                 Server actions: topic status, blocks, sessions, scores, targets, boundaries
    login/                     Email + password sign-in and sign-up
    auth/confirm/route.ts      Handles the email confirmation link
    api/tutor/route.ts         Optional streaming Claude tutor (needs ANTHROPIC_API_KEY)
    (app)/page.tsx             Today: countdowns, phase, checklist, quick log, "fix next"
    (app)/tracker/page.tsx     Syllabus tracker and per-subject metrics
    (app)/schedule/page.tsx    Full timetable by phase, with edit/add/delete/reset
    (app)/papers/page.tsx      Score log, Dropped Marks Analysis, paper bank, topic question sets
    (app)/teach/[topicId]/     Teach Me page
    (app)/settings/page.tsx    Targets, exam details, grade boundaries, sign out
  components/                  RagPicker, PercentPicker, BlockCheck, AttemptForm, TutorBox, …
  content/                     Teach Me notes and exam technique for every topic (econ.ts, business.ts, sociology.ts)
  lib/
    grades.ts                  Grade from %, user overrides, marks needed for a target
    metrics.ts                 Per-subject metrics and dropped-marks totals
    dates.ts, plan.ts          UK-time "today" and the four study phases
    data.ts                    Supabase queries
```

## Set up and deploy

You need a GitHub account (this repo), a free Supabase account and a free Vercel account. Allow about 15 minutes.

### 1. Pick a Supabase project

Either create a new project at [supabase.com/dashboard](https://supabase.com/dashboard) (London region if offered), or reuse one you already have. The tracker only adds a `mocks` schema, so it sits alongside whatever is already there. The free plan allows two active projects.

### 2. Create the tables

Pick one way.

**SQL editor (no tools needed).** Open **SQL Editor → New query**, paste the whole of `supabase/setup.sql` (both migrations in one file), and click **Run**.

**Supabase CLI.** From this folder:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then expose the schema to the app: **Project Settings → Data API → Exposed schemas**, add `mocks`, and save. Keep `public` in the list if another app uses it.

Check it worked: in **Table Editor**, switch the schema dropdown to `mocks`. You should see `subjects` (3 rows), `topics` (33) and `plan_template` (57).

### 3. Configure sign-in

If you're sharing a project with another app, skip this step and sign in with your existing account. Don't change that project's Site URL.

Otherwise, in **Authentication**:

1. Under the email provider settings, turn **Confirm email** off if you want to sign straight in after creating your account. This is the simplest option for a personal app. If you leave it on, the confirmation link comes back to `/auth/confirm`.
2. Under **URL Configuration**, set **Site URL** to your Vercel address (you get it in step 5; come back and update it). Add `https://<your-app>.vercel.app/auth/confirm` and `http://localhost:3000/auth/confirm` to **Redirect URLs**.

### 4. Copy the keys

Click **Connect** at the top of the dashboard (or open **Project Settings → API Keys**) and copy:

- the project URL, e.g. `https://abcd1234.supabase.co`
- the **publishable** key (`sb_publishable_…`). Older projects show an **anon** key instead; that works too.

Never put the secret or service-role key into this app.

### 5. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository.
2. Set **Root Directory** to `alevel-tracker`. Vercel detects Next.js by itself.
3. Under **Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable (or anon) key |
   | `ANTHROPIC_API_KEY` | optional, turns on the Teach Me follow-up box |

4. Click **Deploy**. When it finishes, copy the `.vercel.app` address back into Supabase's Site URL and Redirect URLs (step 3).

### 6. Make your account

Open the site and sign in (or choose **Create account**). Your timetable, targets and topic list are created the first time you open it. Then, so nobody else can use your deployment, turn off **Allow new users to sign up** in Supabase's authentication settings.

### Optional: keypad sign-in

Add `OWNER_EMAIL` (your account's email, not `NEXT_PUBLIC_`) to Vercel's environment variables and redeploy. The login page becomes a 6-digit keypad: the email is filled in on the server, and the code you tap is that account's password, so set the password to a 6-digit code. Supabase rate-limits sign-in attempts, but a 6-digit code is weaker than a long password.

### Optional: the follow-up tutor

Teach Me works fully without it. With `ANTHROPIC_API_KEY` set, each Teach Me page gets an "Ask a follow-up" box that streams answers from Claude, grounded in that topic's notes. Calls cost money on your Anthropic account and only work for signed-in users. It uses `claude-opus-5-5` by default; set `TUTOR_MODEL` to use a different model.

## Run it locally

```bash
cd alevel-tracker
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev                  # http://localhost:3000
```

To run against a local Supabase instead (needs Docker), `npx supabase start` applies both migrations and prints a local URL and publishable key for `.env.local`.

Checks:

```bash
npm test          # grade maths, dates and phases, metrics, and that every topic has Teach Me notes
npm run typecheck
npm run lint
npm run build
```

## Changing things

- **Timetable.** Edit blocks in the app, or change `plan_template` in the reference-data migration and use **Reset plan**.
- **Grade boundaries.** Settings → enter raw marks out of the paper total. Grades everywhere recalculate.
- **Exam session times.** Business and Sociology sessions on 13 November weren't known, so their blocks say "session not confirmed". Fix the times in Schedule and the session in Settings.
- **Teach Me notes.** Edit `src/content/*.ts`. `npm test` fails if a topic is missing notes.

## Sources and assumptions

- **Grade boundaries.** Economics uses AQA's June 2024 notional boundaries for 7136/1 (A* 59, A 52, B 44 out of 80). Sociology uses the average of AQA's June 2024 notional boundaries for 7192/1 and 7192/3, since the mock mixes both papers. Business uses Pearson's June 2024 overall 9BS0 boundaries as a percentage, because Pearson doesn't publish per-paper A-level boundaries. All three come from the boards' own published PDFs. Your school's mock boundaries will differ, so enter them in Settings when you get them.
- **Paper links** were checked on 26 October 2026. AQA hosts its 2020–2023 papers directly. Economics papers AQA no longer hosts link to Physics & Maths Tutor. Business links go to Pearson's exam-materials store; a few older Business question papers and some Sociology years aren't public, so those rows link to the board's past-paper search instead.
- **Practice questions** in Teach Me are written in exam style for this app. They are labelled as such and aren't presented as real past paper questions.
- **Sociology mock format.** The notes and timings assume the usual AQA question types (4, 6, 10, 20-mark Methods in Context, and 30). Check against your mock guidance.
- **Economics content.** The brief listed "Paper 3 Crime & Deviance cross-over" and the "10-mark Education / 20-mark Methods in Context" format under Economics. Those are Sociology, so they live in the Sociology topics. Economics covers the standard Y12 micro Paper 1 content.
