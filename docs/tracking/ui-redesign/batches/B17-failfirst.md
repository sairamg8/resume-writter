# B17 fail-first proof (CI run 37782678881, ref revamp-ui, failfirst only)

| Commit | Tests | Without the src change | With it |
|---|---|---|---|
| 88197e9c B11 shell | 190-ui-b11-shell, 103-r4-dph-07 | fail 3 | pass |
| 38f04cb1 editor sweep | 181-ui-b4-hunt-layout, 181-ui-b4-preview-states, 180-ui-b3-dock-overlay-classes, 181-ui-b3-hunt-dock-room, 181-ui-b4-editor-wiring | fail 4 | pass |
| 125a3641 doc switch 288 px | 181-ui-b4-hunt-layout | fail 1 | pass |
| 1b221ba9 Project views | 103-r4-dph-01, 103-r4-dvis-20 | fail 3 | pass |
| b54d466f kit colours | 103-r4-dvis-03/06/10/15, ui-kit.unit | fail 9 | pass |
| efa60368 kit + public page | 103-r4-dvis-04, ui-kit.unit | fail 2 | pass |
| b4e4a3c5 sidebar scrim, neutral avatar | cv-token-classes.unit, ui-format.unit, 180-ui-b3-editor-bar | passes without the change | pass |

b4e4a3c5 is a pure colour-class swap (bg-slate-900/40 to bg-cv-ink/40; AVATAR_NEUTRAL slate to cv-sunken/cv-muted). No existing test pins those two values and no behaviour changed, so no behavioural test exists; none was invented. Not proven by fail-first.
