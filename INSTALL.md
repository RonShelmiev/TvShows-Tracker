# Getting it onto your phone

Three routes, cheapest first. All of them start with the repo checked out on a
computer and `npm install` run once.

---

## 1. Expo Go — five minutes, free, no build

The fastest way to hold it in your hand. The app runs inside Expo Go rather than
as its own icon, and it needs the dev server running on your computer.

1. Install **Expo Go** from the App Store or Play Store.
2. On your computer, in the project: `npx expo start`
3. iPhone: point the Camera app at the QR code. Android: scan it from inside
   Expo Go.

Phone and computer must be on the same Wi-Fi. If they aren't (or the network
blocks it), use `npx expo start --tunnel`.

Good for trying it and for day-to-day use if you don't mind starting the server.
Not a real installed app.

---

## 2. Android — a real installed app, free

EAS builds it in the cloud and hands you an APK. Free Expo account, no Google
Play account needed.

```bash
npm install -g eas-cli
eas login          # create a free account at expo.dev if you have none
eas init           # writes the generated project id into app.json — commit that
npm run build:android
```

The build takes 10–20 minutes (longer if the free queue is busy). When it
finishes you get a link and a QR code — open it on the phone, download the APK,
and let Android install from an unknown source. After that it has its own icon,
works offline, and needs nothing from your computer.

---

## 3. iPhone — a real installed app

Apple makes this the awkward one. Pick whichever fits:

**With an Apple Developer account ($99/year)** — the clean route:

```bash
eas login && eas init
npm run build:ios
```

EAS walks you through registering your phone as a test device, then gives you a
link to install over the air. Good for a year.

**With a Mac, no money** — build and sideload with a free Apple ID:

```bash
npx expo prebuild --platform ios
open ios/*.xcworkspace
```

In Xcode: pick your phone as the target, set a Team under Signing, press Run.
A free Apple ID signs the app for **7 days**, after which it stops opening and
you plug in and run it again.

**Neither** — stay on Expo Go (route 1). It is the only way onto an iPhone
without a Mac or a paid account.

---

## Pushing changes later

Once the app is installed from a build, JavaScript changes can go out without
rebuilding. One-time setup:

```bash
npx expo install expo-updates
eas update:configure
```

Then `npm run update` after any JS change; the phone picks it up on next launch.
Changes to native config — the icon, the app name, a new native library — still
need a fresh build.

---

## What I could not test from here

`eas` needs your Expo account and network access this container does not have,
so the build config in `eas.json` and the icon set are written but unbuilt. What
*is* verified: the app bundles for iOS (`npx expo export --platform ios`),
typechecks, and passes its tests. If a build trips, it will be on signing or
account setup, not on the app code.
