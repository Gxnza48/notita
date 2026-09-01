# notita

A ridiculously simple notebook for your classes. Minimal, fast, keyboard-first note-taking for Windows 11 — pure black or pure white, nothing in between.

Built with Tauri 2, Rust, SQLite, and React.

## Development

```
npm install
npm run tauri dev
```

## Releasing an update

Push a version tag (e.g. `v0.1.1`) — GitHub Actions builds, signs, and publishes the release automatically. Installed copies of notita pick it up via Settings > Updates.

```
git tag v0.1.1
git push origin v0.1.1
```
