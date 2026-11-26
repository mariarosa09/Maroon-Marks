<p align="center">
  <img src="source/assets/logo-rounded.png" alt="Maroon Marks logo" width="160">
</p>

<h1 align="center">Maroon Marks</h1>

<p align="center">
  A grade and GPA calculator for Manuel S. Enverga University Foundation (MSEUF) students.<br>
  It computes only: nothing is saved and nothing leaves your browser.
</p>

<p align="center">
  <a href="https://maroon-marks-tau.vercel.app"><strong>Open Maroon Marks</strong></a> · https://maroon-marks-tau.vercel.app
</p>

---

## What it does

Maroon Marks helps you work out your grades the way MSEUF computes them. You can:

- **compute** your Initial, Midterm and Final grades from your quiz, activity and exam scores;
- **combine** your Midterm and Final grades into your **Final Subject Grade** and convert it with the
  MSEUF handbook scale (1.00–5.00);
- **project** the final grade you need to reach a target grade point;
- **calculate** your GPA weighted by units, with an estimate of University Scholar or College Scholar standing.

Every result shows a step-by-step breakdown, so you can check each number yourself.

It is a single web page built with HTML, CSS and vanilla JavaScript. It has no libraries, no account,
no internet requirement and no tracking.

---

## Features

### Grade Calculator

The Grade Calculator has five tabs:

| Tab | What it computes |
|---|---|
| **Initial Grade** | A grade from weighted categories that you define. Weights total 100%. |
| **Midterm Grade** | Major Examinations (fixed 60%) plus your other categories (the remaining 40%). |
| **Final Grade** | The same structure as the Midterm Grade. |
| **Final Subject Grade** | Midterm × 40% + Final × 60%, converted to a grade point. |
| **What-If Projection** | The final grade you need to reach a target grade point or percentage. |

**Categories and items**
- A category has a name, a weight and any number of items. For example, Quizzes at 10% could hold Quiz 1 and Quiz 2.
- **Each category's weight is split equally among its items.** With Quizzes at 10% and 2 quizzes, each quiz
  is worth 5% of the grade. The editor shows this split as you type, for example
  "2 items · 10% ÷ 2 = 5% each", along with how many points each item contributes.
- In **Midterm** and **Final**, *Major Examinations* is a fixed category at 60% that you can't remove.
  Its 60% is split equally among the exams you enter, so 2 exams count 30% each.
- In **Initial Grade**, *Examinations* is optional: set its weight, rename it, or remove it.
- Quick-add chips cover common categories: Quizzes, Assignments, Activities, Recitations, Seatwork,
  Laboratory Activities, Projects and Attendance.
- An allocation meter shows how much weight you've assigned and how much is left. The
  **Distribute remaining** button splits the unassigned weight evenly across your categories.
- **Allow extra credit** lets a score go above its total, for bonus points.

**Grading methods.** You choose the method per calculation:

| Method | Formula | Example (8 out of 10) |
|---|---|---|
| Non-Zero-Based (50% Base), the MSEUF default | ((Earned ÷ Total) × 50) + 50 | 90% |
| Zero-Based | (Earned ÷ Total) × 100 | 80% |

**Save to Final Subject Grade.** The Midterm and Final tabs each have a **Save** button. Saving fills
that grade into the Final Subject Grade tab. A saved midterm also fills the What-If tab. You don't
need to retype anything.

**What-If Projection.** Enter your midterm, then move the slider to try different final grades.
Choose a target grade point (for example 1.75) or a target percentage, and the app tells you the
minimum final grade you need. It also tells you if your target is already secured, or out of reach above 100%.

### GPA Calculator

- Add subjects with an optional name, their **units** and their **grade point** (1.00–5.00, INC or DRP).
- GPA = Σ(grade point × units) ÷ total units. The app shows the working as a table:

  | Subject | Grade | Units | Total (Grade × Units) |
  |---|---|---|---|
  | CSAL102 | 1.50 | 3 | 4.50 |
  | Subject 2 | 1.25 | 2 | 2.50 |
  | **Total** | | **5** | **7.00** |

  Then **GPA = Total ÷ Total units = 7.00 ÷ 5 = 1.40**. Subjects that aren't counted (INC, DRP or no
  grade point yet) appear greyed out with "Not counted".
- **INC** and **DRP** aren't numerical grade points, so the app excludes them from the GPA and lists them separately.
  They still count against scholarship eligibility (see below).
- From the Final Subject Grade tab, **Add to GPA calculator** asks for the subject's units, then adds it.
- **Scholar classification (estimate):**

  | GPA | Classification |
  |---|---|
  | 1.00 – 1.30 | University Scholar |
  | above 1.30 – 1.50 | College Scholar |
  | above 1.50 | No scholar classification |

  **Eligibility rule:** every subject must be **2.00 or better**. A grade of **2.25 to 5.00**, an **INC**
  or a **DRP** in any subject makes the student **not eligible for a scholarship**, whatever the GPA.
  For example, 1.00, 1.25, 1.50 and 2.25 average out to a GPA in the College Scholar range, but the 2.25
  rules out the scholarship. The app shows "Not eligible for scholarship" and lists the subjects responsible.

  The classification always uses the unrounded GPA. If rounding to 2 decimals would put the GPA
  in a different band, the app shows more decimals.

### MSEUF grading scale (student handbook)

| Grade point | Percentage | Description |
|---|---|---|
| 1.00 | 98–100 | Excellent |
| 1.25 | 95–97 | Excellent |
| 1.50 | 92–94 | Superior |
| 1.75 | 89–91 | Superior |
| 2.00 | 87–88 | High Average |
| 2.25 | 84–86 | High Average |
| 2.50 | 81–83 | Average |
| 2.75 | 78–80 | Low Average |
| 3.00 | 75–77 | Passed |
| 5.00 | 74 and below | Failed |
| INC | — | Incomplete |
| DRP | — | Dropped |

**Rounding.** The handbook lists whole-number ranges only, so a grade like 91.5% falls between two ranges.
By default the app doesn't round. It flags these grades as **Needs review** instead of guessing.
Under the grading scale, you can switch to:
- **Round half up:** 91.5 → 92.
- **Drop decimals:** 91.9 → 91.

Confirm MSEUF's official rounding policy with your instructor or the Registrar before you rely on a rounded result.

---

## Worked example: a midterm grade

| Category | Weight | Items | Item % (50% Base) | Points |
|---|---|---|---|---|
| Major Examinations | 60% (fixed) | Midterm Exam 45/50 | 95.00 | 95.00 × 60% = **57.00** |
| Quizzes | 10% | Quiz 1 10/10, Quiz 2 5/10 | 100.00, 75.00 | 100 × 5% + 75 × 5% = **8.75** |
| Projects | 30% | Project 1 45/50 | 95.00 | 95.00 × 30% = **28.50** |
| **Midterm grade** | 100% | | | **94.25%** |

If the final grade is 92.00%, the Final Subject Grade is 94.25 × 0.40 + 92.00 × 0.60 = **92.90%**.
That falls within 92–94, so it converts to **1.50 (Superior)**. A result like 94.50%, which sits in the gap
between 92–94 and 95–97, is flagged **Needs review** unless you choose a rounding option.

---

## How to use it

1. **Midterm Grade tab:** enter your exam scores, add your other categories (for example Quizzes 10%,
   Projects 30%), give each a weight, then enter each item's score and total. Press **Save**.
2. **Final Grade tab:** do the same for the finals, then press **Save**.
3. **Final Subject Grade tab:** both grades are already filled in. Read your grade point and
   pass/fail status. Press **Add to GPA calculator**, then enter the subject's units.
4. **GPA Calculator:** add your other subjects' grade points and units to see your GPA and scholar standing.
5. **What-If Projection (optional):** find the final grade you need for the grade point you want.

---

## Your data and privacy

**Nothing is stored.** Everything you enter lives only in the open page, in memory:

- you can switch between tabs without losing anything;
- refreshing or closing the page clears everything;
- the app uses no LocalStorage, cookies, accounts, analytics or server;
- no request is sent anywhere, and the app works fully offline.

---

## Running it

You don't need to install or build anything.

- **Online:** open **https://maroon-marks-tau.vercel.app** in any browser.
- **Locally:** open `source/index.html` in your browser by double-clicking it.
- **Single file:** open `prototype/maroon-marks.html`. It is the same app in one file, with the styles,
  script and logo built in, which makes it easy to share.

It works in current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile.

## Deploying

Maroon Marks is a static website: no build step, no server code and no database. To publish it, upload
the contents of `source/` (with `index.html` at the top level) to any static host:

- **Netlify Drop:** drag the `source` folder onto app.netlify.com/drop.
- **GitHub Pages:** push the files to a repository and enable Pages in *Settings → Pages*.
- **Vercel:** import the repository. `vercel.json` tells Vercel to serve the `source` folder, so you
  don't need any extra settings.
- **Cloudflare Pages:** set the build output directory to `source`.

All paths are relative, so the app also works from a subfolder. You can also host `prototype/maroon-marks.html` on its own.

---

## Project structure

```
├── README.md
├── prototype/
│   └── maroon-marks.html      # the whole app in one self-contained file
└── source/
    ├── index.html             # page shell: sidebar, header, views, dialog
    ├── style.css              # maroon-and-gold theme, layout, themed form controls
    ├── script.js              # grade logic, rendering and event handling
    └── assets/
        ├── logo.png           # app logo (sidebar and header)
        ├── logo-rounded.png   # logo with rounded corners (this README)
        └── favicon.png        # browser tab icon
```

`script.js` is organised into sections:
1. constants and the grading scale;
2. pure computation functions: `computeInitial`, `computePeriod`, `computeFSG`, `computeGPA`, `convertGrade`, `classify`;
3. in-memory state;
4. user-interface helpers, including the themed dropdowns;
5. the views for each tab;
6. event handling.

The computation functions are exported when the file runs under Node.js, so you can test them without a browser:

```bash
node -e "const A = require('./source/script.js'); console.log(A.computeFSG(94.25, 92))"
```

---

## Accessibility

- The app supports the keyboard throughout. Dropdowns respond to the arrow keys, Home/End,
  Enter/Space, Escape and typing a letter to jump to an option.
- Status colours always come with text labels, such as "✓ 1.50 · Superior" or "⚠ Needs review".
- Result panels use `aria-live`, so screen readers announce updated grades.
- The app respects your operating system's reduced-motion setting.

---

## Disclaimer

Maroon Marks is an **unofficial student-made tool**. It is not affiliated with or endorsed by
Manuel S. Enverga University Foundation. Results are estimates based on the MSEUF student handbook.
Your official grades, academic standing and scholar awards come from MSEUF.
Always confirm with your instructor or the Registrar.
