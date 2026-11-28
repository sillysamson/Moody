# Moodys (internal: Interception)
Vite + React web app, packaged for Android with Capacitor. App ID: com.synapse.moodys

## Build on GitHub
Push to `main`, or Actions > "apk" > Run workflow. Download the `moodys-apk` artifact.
The APK is a debug build: it installs on a phone, but it is not for Play Store upload.
Delete any older workflow in `.github/workflows` first.

## Run locally
`npm install && npm run dev`
Android: `npm run build -- --base=./ && npx cap add android && npx cap sync android`

Version 1.2.0. Steps: needs a native step-counter plugin. See src/steps.js.
