# Kiosk Advertisement Pages Prompt

## Overview

Create **several advertisement pages** for the Smartwish kiosk application. These pages live under the route pattern `/kiosk/advertisement/Ad<number>` (e.g. `/kiosk/advertisement/Ad1`, `/kiosk/advertisement/Ad2`, …). Start with **Ad1** as specified below; subsequent ads (Ad2, Ad3, …) can be added later using the same structure.

---

## Route Structure

- **Base path:** `/kiosk/advertisement/`
- **Pattern:** `Ad<number>` (e.g. `Ad1`, `Ad2`, `Ad3`)
- **Example URLs:**
  - `/kiosk/advertisement/Ad1`
  - `/kiosk/advertisement/Ad2`

Use **Next.js App Router** dynamic routes, e.g. `smartwish-frontend/src/app/kiosk/advertisement/Ad[number]/page.tsx` or a single dynamic segment like `advertisement/[adId]/page.tsx` that resolves `Ad1`, `Ad2`, etc. Match the existing kiosk structure under `src/app/kiosk/` (see `home`, `gift-card`).

---

## Ad1 Requirements (First Implementation)

**Route:** `/kiosk/advertisement/Ad1`

### 1. Marketing Page

- Present a **dedicated marketing page** (full-screen, kiosk-appropriate layout).
- Design for typical kiosk displays (e.g. portrait 1080×1920 or landscape 1920×1080).
- Keep it clear, readable, and touch-friendly.

### 2. Cold Stone Creamery Logo

- **Demonstrate the Cold Stone Creamery logo** prominently on the page.
- Use the official Cold Stone Creamery logo (reddish-brown “COLD STONE” typography, “CREAMERY” in a golden-yellow-bordered band, circular emblem with ice cream cone above the wordmark).
- Options:
  - Host the logo under `public/` (e.g. `public/ads/cold-stone-logo.png`) and reference it from the page.
  - Or use an external URL if you have a licensed source.
- Ensure the logo is sharp and correctly proportioned on kiosk resolutions.

### 3. Offer: 10% Off for Printing

- **Offer:** **10% off** when the user **prints any greeting card or sticker** at the kiosk.
- Communicate this clearly on the page (e.g. “10% off Cold Stone when you print a greeting card or sticker”).
- Specify whether this is:
  - **Display-only** (informational): user sees the offer, then goes to Greeting Cards or Stickers and prints as usual; *or*
  - **Functional**: the 10% is applied via a promo code, QR code, or other mechanism (e.g. show a code, QR to a redemption page, or integrate with existing promo/print flow).

If you integrate with promos, align with existing behavior (e.g. `greetingCardsEnabled` / `stickersEnabled`, print logs, promo codes) in `smartwish-frontend` and any backend discount logic.

### 4. Navigation / CTA

- Provide a clear **call-to-action** (e.g. “Create Greeting Card” / “Create Sticker” or “Start”) that:
  - Navigates to **Greeting Cards** (`/templates` or the route used from kiosk home) or **Stickers** (`/stickers`), consistent with `KioskHome`.
- Optionally, a “Back” or “Home” action to return to `/kiosk/home`.

---

## Technical Context

**Relevant existing code:**

- `smartwish-frontend/src/app/kiosk/home/page.tsx` – kiosk home; tiles for Greeting Cards and Stickers.
- `smartwish-frontend/src/app/kiosk/gift-card/page.tsx` – example of a dedicated kiosk subflow (layout, navigation, `PrinterAlertBanner`).
- `smartwish-frontend/src/contexts/KioskContext.tsx`, `useKioskConfig` – kiosk config and context.
- `smartwish-frontend/src/utils/kioskConfig.ts` – kiosk configuration types and helpers.

**Recommendations:**

- Use `useKiosk`, `useKioskConfig`, and `useDeviceMode` as needed so ad pages behave correctly in kiosk mode.
- Consider `PrinterAlertBanner` if the ad is shown in a context where printing is relevant.
- Reuse existing kiosk layout/chrome (e.g. `AppChrome`) where appropriate so ad pages feel consistent with `/kiosk/home` and `/kiosk/gift-card`.

---

## Extensibility for Ad2, Ad3, …

- Structure the implementation so **additional advertisement pages** (Ad2, Ad3, …) can be added easily.
- Reuse shared layout, styling, and navigation patterns; vary content per ad (e.g. different partner, logo, offer).
- Optional: drive which ad to show from **kiosk config** (e.g. `config.ads` or similar) so admins can assign ads per kiosk without code changes.

---

## Summary Checklist for Ad1

- [ ] Route `/kiosk/advertisement/Ad1` implemented.
- [ ] Full-screen marketing layout, kiosk-optimized.
- [ ] Cold Stone Creamery logo displayed prominently.
- [ ] “10% off when you print any greeting card or sticker” offer clearly shown.
- [ ] CTAs to create/print greeting cards or stickers (and optionally back to `/kiosk/home`).
- [ ] Structure allows adding Ad2, Ad3, etc. with minimal duplication.

---

## Optional Enhancements

- **Analytics:** Emit events when users view Ad1 or tap CTAs (e.g. via existing session/tracking).
- **A/B or rotation:** If multiple ads exist, rotate or choose among them (e.g. via kiosk config or simple client logic).
- **Accessibility:** Sufficient contrast, focus management, and touch targets for kiosk users.
