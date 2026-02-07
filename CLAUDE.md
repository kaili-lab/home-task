# Claude Code Project Memory

## Testing

- Every time after implementing a feature or fixing a bug, automatically run tests by running `pnpm test` in the `packages/server` directory.
- If any test fails, automatically fix the code and re-run tests until all tests pass.
- After implementing new code, evaluate whether tests are needed. If so, unit tests are mandatory; for other types of tests (integration, route, etc.), ask the user whether they should be implemented.
