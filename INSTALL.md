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

## 3. iPhone, free

Apple does not let you install an app on an iPhone for free without a Mac in the
loop somewhere. So there are exactly two free routes.

### 3a. No Mac — Expo Go

This is the only free way onto an iPhone without a Mac, and it is route 1 above.
Everything this app uses ships inside Expo Go — expo-image, expo-linear-gradient,
expo-haptics, react-native-svg, async-storage, expo-router — so nothing is
missing or stubbed out; you get the real app, running inside another app.

What you give up: no icon on the home screen (you open Expo Go first), and a
computer on the same Wi-Fi running `npx expo start` each time.

Your tracked shows persist between sessions — they live in Expo Go's storage for
this project — but they are gone if you delete Expo Go or clear its data.

### 3b. A Mac you can borrow — a real app, free, 7 days at a time

A free Apple ID can sign an app for your own phone. It gets a real icon and runs
with no computer attached, but the signature expires after **7 days** and the app
stops opening until you re-sign it.

```bash
npx expo prebuild --platform ios
open ios/*.xcworkspace
```

In Xcode: plug the phone in, pick it as the run target, open Signing &
Capabilities, set Team to your personal Apple ID, press Run. First launch needs
Settings → General → VPN & Device Management → trust the developer.

To renew, plug in and press Run again. Do that **before** it expires and while
the bundle id stays `com.tvshowstracker.app`: it installs over the top and your
progress survives. Let it lapse and delete the app instead, and iOS throws the
data away with it.

**Renewing without the Mac each week:** [SideStore](https://sidestore.io) or
AltStore installs onto the phone and re-signs apps over Wi-Fi automatically, so
you only need the Mac for the first build. You still need the Mac (or a paid
account) to produce the `.ipa` in the first place — there is no way to build one
from Windows or Linux.

### What free does not get you

Notifications when a show airs need a real build, and on iPhone that means one of
the routes above rather than Expo Go. Everything else in the app works identically.

### If you would rather pay

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
