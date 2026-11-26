# MSEUF Grade Calculator

Compute-only grade and GPA calculator for Manuel S. Enverga University Foundation students.
Built with HTML5, CSS3 and vanilla JavaScript. No libraries and no internet connection needed.

## Folders
- `source/`: the project code (`index.html`, `style.css`, `script.js`). Open `index.html` in a browser.
- `prototype/`: `mseuf-grade-calculator-prototype.html`, the same app in one self-contained file.
- `screenshots/`: captures of the earlier version. They still show the removed Dashboard, Subjects, History and Settings pages.

## Features
- **Grade Calculator** with five tabs: Initial, Midterm, Final, Final Subject Grade and What-If Projection.
  You can use Non-Zero-Based (50% Base, the default) or Zero-Based grading.
- **Equal split of weights:** each category's weight is divided equally among its items.
  For example, Quizzes at 10% with 2 quizzes makes each quiz worth 5% of the grade.
- Midterm/Final = Major Exams 60% (split equally among the exams) + Class Requirements 40%
  (your own categories, 40% total at most).
- Final Subject Grade = Midterm × 0.40 + Final × 0.60, converted with the MSEUF handbook scale.
- **GPA Calculator:** enter units and a final subject grade (%) or a grade point for each subject.
  It shows your GPA weighted by units and a University Scholar (1.00–1.30) or College Scholar (>1.30–1.50) estimate.

## Data
Nothing is saved. Everything you type stays only in the open page, in memory, and you can
move between tabs without losing it. Refreshing or closing the page clears everything.
The app uses no LocalStorage, cookies or server.

## Notes
- Default rounding is none. Grades that fall between handbook ranges (e.g. 94.5) are flagged for review.
  You can switch to round-half-up or truncate under the grading scale. Confirm MSEUF's official policy first.
- This is an unofficial student tool. It is not affiliated with or endorsed by MSEUF.
