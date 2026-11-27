## What changes

<!-- One or two sentences. Link the issue if there is one. -->

## Why

## How I checked it

- [ ] `node scripts/build-examples.mjs --no-png` passes
- [ ] `node evals/regress.mjs` shows no unintended change to existing types
      (existing diagrams stay byte-identical)
- [ ] For a new type: example, `references/` section, `SKILL.md` catalogue row
      and evals added
- [ ] For wording changes to `SKILL.md`: trigger evals re-run (see
      `evals/README.md`)
- [ ] Screenshot or preview PNG attached if a diagram looks different

## Anything reviewers should know

<!-- Trade-offs, open questions, things you could not test. -->
