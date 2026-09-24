# Full audit 2026-09-23 (`R2-`) — index

A read-only audit of the whole app (13 subsystems + the pending lists + test coverage), run while TUI-7 … AUD-31 were
being fixed. 175 findings → 173 after de-duplication → an independent agent re-checked 102: **100 confirmed, 1
refuted, 1 duplicate of an existing row**; the other 71 were not re-checked (session limit) and are marked *Unverified*.

| File | What | Rows |
|---|---|---|
| [01-high-medium.md](01-high-medium.md) | defects, High then Medium | 71 (R3 rows: found by the build lanes, 2026-09-24) |
| [02-low.md](02-low.md) | defects, Low | 65 (R3 rows: found by the build lanes, 2026-09-24) |
| [03-features-and-test-gaps.md](03-features-and-test-gaps.md) | features asked for and not built; controls with no test | 37 |

Defects: **134** — High 10, Medium 60, Low 64 (regressions, bugs and preview/PDF/Word parity).
Order of work: High → Medium → Low, then the features and test gaps. Each fix: fail-first test, row set in the same
commit, gate, push. A row that does not reproduce is closed as ✖ with the proof, never silently.

Dropped at verification (not filed): Generator ignores the letter's own Company and Recipient: the body pri, firestore.rules put no limit on path, shape or size under a user's own.
