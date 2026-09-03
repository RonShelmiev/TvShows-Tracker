# Getting it onto your phone

Several routes. All of them start with the repo checked out on a computer and
`npm install` run once.

**On an iPhone and not wanting to pay Apple? Skip to [route 3](#3-iphone-free--install-it-from-the-web-recommended)** —
deploy the web build and add it to the home screen. Real icon, works offline,
never expires, no Mac needed.

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

## 3. iPhone, free — install it from the web (recommended)

This is the best free route and it needs no Mac, no Apple account, no cable and
no 7-day renewal. You deploy the web build once, then add it to the home screen:
iOS gives it a real icon, opens it fullscreen with no Safari chrome, and it keeps
working offline.

**Deploy it (once, ~3 minutes):**

```bash
npm install -g vercel
npm run deploy          # vercel --prod
```

Answer the prompts (link to a new project, accept the defaults — `vercel.json`
already says how to build and route it). You get a URL like
`tvshows-tracker.vercel.app`. Free tier, no card.

**Put it on the phone:**

1. Open that URL in **Safari** on the iPhone (Safari specifically — this is how
   iOS installs web apps)
2. Share button → **Add to Home Screen** → Add

That is it. The icon appears on your home screen and launching it looks like any
other app — no address bar, no tabs, dark status bar.

**What you get:** everything in the app, offline-capable (a service worker caches
the shell, and your tracked shows and episode lists are stored on the phone).

**What you give up:**

- **No push notifications** for shows airing. iOS supports web push for installed
  web apps, but it needs a server sending them — it is not in this app yet.
- **No haptic tick** when marking an episode; the web has no equivalent.
- **Storage is Safari's.** Your progress lives in the phone's local storage for
  that site. Installed web apps keep it far longer than a browser tab, but iOS
  can still clear it if you go a long time without opening the app, or if you
  clear website data. An export/import of your library would remove this risk and
  is not built yet.

**Updating it later:** `npm run deploy` again. The phone picks up the new version
next time you open it — no reinstall, nothing to approve.

## 4. iPhone, free — a real native build (needs a Mac)

Only worth it if you want notifications or the haptics. A free Apple ID can sign
the app for your own phone, but the signature expires after **7 days**.

```bash
npx expo prebuild --platform ios
open ios/*.xcworkspace
```

In Xcode: plug the phone in, pick it as the run target, open Signing &
Capabilities, set Team to your personal Apple ID, press Run. First launch needs
Settings → General → VPN & Device Management → trust the developer.

To renew, plug in and press Run again **before** it expires and while the bundle
id stays `com.tvshowstracker.app` — it installs over the top and your progress
survives. Let it lapse and delete the app instead, and iOS bins the data with it.
[SideStore](https://sidestore.io) or AltStore can re-sign over Wi-Fi so you only
need the Mac for the first build.

## 5. iPhone, paid

$99/year for an Apple Developer account gets `npm run build:ios`, install over
the air, and a signature that lasts a year instead of a week.

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
