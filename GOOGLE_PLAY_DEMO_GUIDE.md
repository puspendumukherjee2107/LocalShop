# LocalStore: Google Play Private Demo Deployment Guide

This guide explains how to release **LocalStore** as a private demo on Google Play that is **completely invisible to the public** and accessible only via direct invitation.

---

## 🔒 Why Google Play "Internal Testing"?
* **100% Hidden**: The app will **not** appear in Google Play Search or store rankings.
* **Zero Waiting / Fast Setup**: Google's review process for Internal Testing takes minutes (unlike production releases which take days).
* **Controlled Access**: You specify an email list (up to 100 people) or generate a private invite link. Only those exact Google accounts can download and install the app.
* **No Tester Quotas**: The 14-day 12-tester requirement only applies to Production releases, not Internal Testing.

---

## 🛠️ Step 1: Pre-Configured Files in this Codebase

The following files have already been configured for you:
1. [`app.json`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/app.json):
   * Android Package: `com.localstore.app`
   * Version Code: `1`
   * Permissions: `["INTERNET"]`
2. [`apiConfig.ts`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/src/services/apiConfig.ts):
   * Supports `process.env.EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_HUB_URL` with automatic local fallback.
3. [`eas.json`](file:///c:/PM%20Project/LocalStore/UI/local-shop-app/eas.json):
   * `internal` and `production` profiles for generating Android App Bundles (`.aab`).
   * `preview` profile for generating a direct installable `.apk` without Google Play.
4. [`PRIVACY_POLICY.md`](file:///c:/PM%20Project/LocalStore/PRIVACY_POLICY.md):
   * Ready-to-host privacy policy document compliant with Google Play Data Safety requirements.

---

## 📦 Step 2: Build the Android Bundle (`.aab`)

Open PowerShell in the `UI\local-shop-app` folder:

```powershell
cd "c:\PM Project\LocalStore\UI\local-shop-app"
```

### Option A: Build for Google Play Internal Testing (`.aab`)
```powershell
npx eas-cli login
npx eas-cli build --platform android --profile internal
```
* Log in with your free [Expo.dev](https://expo.dev) account.
* When asked: *"Generate a new Android Keystore?"*, select **Yes**.
* EAS Cloud will build your `.aab` file and provide a download link upon completion.

### Option B: Build a Direct Installable APK (`.apk`)
If you want to test on your own phone immediately without Google Play:
```powershell
npx eas-cli build --platform android --profile preview
```
* EAS will output a `.apk` file that you can directly download and install on any Android phone.

---

## 🚀 Step 3: Setting Up Private Internal Testing on Google Play

1. Log into [Google Play Console](https://play.google.com/console).
2. Click **Create App**:
   * App name: `LocalStore Demo`
   * Default language: English
   * App or game: App
   * Free or paid: Free
3. In the left sidebar, navigate to **Testing > Internal testing**.
4. Click **Create new release**:
   * Upload the `.aab` file you downloaded from Step 2.
   * Release name: `1.0.0 (Demo)`
   * Release notes: `Internal demo release for testing.`
   * Click **Save** and **Review release**, then **Start rollout to Internal testing**.
5. Set up your **Testers List**:
   * Under the **Testers** tab in Internal testing, click **Create email list**.
   * Name it `Demo Reviewers` and add your own Google email address (and anyone else who needs to test).
   * Copy the **Join on Android** or **Join on the web** link and open it on your phone to install!

---

## 📋 Step 4: Quick Play Console Compliance Answers

Google Play requires completing the initial questionnaire before releasing to internal testers. Use these exact answers:

| Section | Required Field / Value |
| :--- | :--- |
| **Privacy Policy** | Paste the URL where you host [`PRIVACY_POLICY.md`](file:///c:/PM%20Project/LocalStore/PRIVACY_POLICY.md) (e.g. GitHub Gist or GitHub Pages). |
| **App Access** | Select *"All or some functionality is restricted"*. Provide test account: Mobile `9876543210`, Password `Customer@2026!` (Select Customer role). |
| **Ads** | Select *"No, my app does not contain ads"*. |
| **Content Ratings** | Complete the questionnaire (Select Utility/Productivity/Communication; select "No" for violence, gambling, mature themes). |
| **Target Audience** | 18 and older. |
| **Data Safety** | Check "Yes" for Name, Phone, and Address (Used for App Functionality / Order fulfillment). Declare encrypted in transit. |
| **Financial Features** | Select *"The app does not provide any financial features"*. |
