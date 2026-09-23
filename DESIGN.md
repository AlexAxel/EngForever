# Eng Forever · Design contract (OpenDesign-guided experiment)

> Scope: `design/open-design-mobile` only. Original `main` is the live, stable product. This experiment changes presentation and gestures, NOT study data, scoring, rounds, card selection, or localStorage version/key.

## Sources and workflow
- `nexu-io/open-design/skills/redesign-skill/SKILL.md`: scan existing UI; diagnose generic patterns and missed states; make targeted upgrades on the existing stack; test after changes.
- `nexu-io/open-design/skills/frontend-design/SKILL.md`: commit to a distinct direction, design real interactions and state coverage, use semantic markup, accessible controls and responsive layout, critique the result.
- `nexu-io/open-design/design-systems/minimal/DESIGN.md`: deliberate whitespace, neutral surfaces and restrained accent; adapt for a language-learning card workflow. Do not transplant mockup-only iPhone frames or another application's mascot.
- `nexu-io/open-design/design-templates/mobile-app/SKILL.md`: one primary job per mobile screen, ≥44px touch targets, state coverage. This is an adaptive website, not an iPhone mockup.

## Scan / diagnosis of main UI
- Header, progress and both buttons currently compete with the text for a short viewport; the translation handle is small and looks like a separate tile instead of a physical sliding sheet.
- Several successive CSS overrides obscure the visual system; font, spacing, corner radii and state colors are inconsistent.
- Generic purple AI accent, boxed stats and app chrome do not express the calm act of recalling a phrase.
- Swipe direction has limited at-gesture feedback; translation drag only decides on release, without the sheet following a finger.
- The extra (off-counter) review must be distinct visually while preserving existing saved state and progress semantics.

## One direction: quiet language lab, tactile stack
- Warm paper background with a calm teal signal, dark ink and a single white raised paper-card surface.
- Translation is a top edge sliding drawer integrated INTO the card; it follows the finger down before settling open.
- Clear hierarchy: brand and settings > unique round progress > prompt > translation drawer > two familiar answer buttons.
- Answer actions are semantic (coral error, jade success); colors supplement labels, never replace them.
- Off-counter review uses a warm amber highlight, a text badge and an explicitly labeled counter.
- Responsive: small 320×568 phone through 390×760 mobile, tablet and desktop; safe-area insets; reduced motion and focus-visible.
- Keep light/dark auto theme without a user account or external font dependency. Never download or distribute fonts.

## Token contract
- Paper #F5F5F0, surface #FFFFFF, ink #162C30, secondary #657779, stroke #DCE5E1.
- Teal #0B7669 (interactive focus / progress); quiet teal #E3F3EE.
- Wrong #B53E4A, success #167455, review #A36B1F.
- Space scale: 4, 8, 12, 16, 24, 32; control height ≥44px; card radii 30px, internal radii 18px.
- Typography: geometric native sans for Cyrillic/Latin; system variable font stack avoids additional network dependencies. Tabular numbers for counters, balanced prompt wrapping.

## Functional invariants
- 120 numbered pairs remain untouched in `data/phrases.json`.
- Primary round = distinct IDs; off-counter retries never consume a numbered step; mistakes always enter subsequent round.
- A running session survives reload and catalogue growth; new IDs disabled until manual opt-in.
- Toggling selection begins a new session without erasing hardness/history; only explicit reset clears stats.
- Same current card state must be preserved by visual or gesture improvements; two answer buttons remain.
- Run all existing tests and visual-gesture regression on the experimental branch before inviting preview.
