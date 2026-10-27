# Contributing

Issues, bug fixes, documentation improvements, and gameplay improvements are welcome.
For substantial changes, open an issue first to discuss the approach. Search existing
issues and pull requests before starting work.

## Development

Use Node.js 22.12 or later and npm. From a clone of the repository:

```sh
npm ci
npm run dev
```

See the [README](README.md) for controls, deployment, and the full verification
commands. Run `npm test` and `npm run build` before submitting a change. Run the
browser or simulation tests when relevant; they require a local Chromium installation.
Describe any checks you could not run in the pull request.

Keep changes focused, explain the problem and solution, and include reproduction
steps or screenshots where helpful. Please do not submit assets or code that you
are not entitled to contribute. By submitting a contribution, you agree that it
may be distributed under the repository's [MIT License](LICENSE).

Report security vulnerabilities using [SECURITY.md](SECURITY.md), rather than a
public issue.
