# WordPop! → Google Play: what's done, and the 6 steps only you can do

Everything automatable is finished. What remains needs an interactive Google
login, which is why it can't be scripted: **the Android Publisher API has no
endpoint that creates an app.** `POST /applications/com.abrlab.wordpop/edits`
currently returns `404 Package not found` — the package must exist in Play
Console before any API call can touch it. (Culture Ludo returns `200` from the
same credential, so this is a missing-app problem, not a broken credential.)

## Ready to upload

| File | Slot |
| --- | --- |
| `wordpop-v1-release.aab` | App bundle — signed, `jar verified`, 6.5 MB |
| `icon-512.png` | App icon (512×512, opaque) |
| `feature-1024x500.png` | Feature graphic (exactly 1024×500) |
| `screenshots/01…05.png` | Phone screenshots (1080×1920, clean status bar) |
| `LISTING.md` | Title, descriptions, and pre-filled answers for every form |

Privacy policy is already live: <https://abrlab-org.github.io/wordpop/privacy/>

## 🔴 Before you publish — two credential swaps

The build currently carries **Google's public test ad IDs**, so it will show
test ads and earn nothing. Both values must change together:

1. `android/app/src/main/AndroidManifest.xml` → `APPLICATION_ID` (uses `~`)
2. `src/platform/admob.js` → `AD_UNITS.interstitial` and `.rewarded` (use `/`)

Then rebuild: `npm run android:sync && cd android && ./gradlew app:bundleRelease`

`admob.js` flips its own `isTesting` flag off automatically once the IDs no
longer start with Google's test publisher prefix, so there is nothing else to
remember. Shipping with test IDs is not harmful — just unpaid.

## 🔑 Keystore — read this once

| | |
| --- | --- |
| File | `~/wordpop-upload.keystore` (PKCS12, alias `upload`, valid to 2053) |
| Password | `~/wordpop-upload-keystore-password.txt` (chmod 600) |
| SHA-256 | `0E:A1:26:B9:64:C5:F1:57:B7:8D:6E:15:1A:FE:30:34:34:64:F2:80:F5:C1:1C:46:55:29:38:F6:9A:69:E0:C7` |

**Move that password into 1Password (`abrlab` vault) and attach the keystore
file to the same item, exactly as Culture Ludo does.** If it is lost you can
never ship an update to this app again — a new key means a new listing. Your
own `android-release-setup.md` records that this already happened once with
`culture-ludo-upload.keystore`. Neither file is in git.

## The 6 manual steps

**1 — Create the app.** Play Console → *All apps* → **Create app**.
Name `WordPop!`, English (US), **App**, **Free**. Confirm the declarations.

**2 — Set the package name.** It is fixed by the first upload, not typed:
uploading the AAB registers `com.abrlab.wordpop` permanently. Say now if you
want a different id — it cannot be changed later.

**3 — Fill the listing.** *Grow → Store presence → Main store listing*.
Paste from `LISTING.md`, upload icon + feature graphic + screenshots.

**4 — Complete the policy forms.** *Policy → App content*: privacy policy URL,
ads (**yes**), content rating questionnaire, data safety, target audience
(13+). `LISTING.md` has every answer pre-written. I deliberately did not touch
these even where an API exists — content rating and data safety are legal
declarations that must come from you.

**5 — Upload the bundle.** *Release → Testing → Internal testing* → **Create
new release** → upload `wordpop-v1-release.aab`. Start with internal testing
rather than production; it reviews in hours instead of days and is the same
path Culture Ludo uses.

**6 — Grant the service account (optional but worth it).** *Users and
permissions* → `play-publisher@culture-ludo.iam.gserviceaccount.com` → add
WordPop! with **Manage store presence** (+ release-track permissions for CI).
Tick → **Apply** → then **Save changes** on the user page; closing the drawer
looks saved but isn't. Once granted, I can update screenshots, feature graphic,
icon, and listing text through the API without you opening the console again.

## After that

Ping me once step 6 is done and I can drive all future listing changes directly.
Google reviews internal-track releases in a few hours; production takes longer
on a first submission.
