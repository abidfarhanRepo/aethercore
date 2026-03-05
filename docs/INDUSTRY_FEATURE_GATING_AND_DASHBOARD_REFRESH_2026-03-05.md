# Industry Feature Gating and Dashboard Refresh Notes (2026-03-05)

## Overview
This update introduces system-level settings that control dashboard refresh behavior, checkout shortcuts and quick-sell widgets, and feature-flag based route/sidebar access for industry-specific modules.

## Dashboard Refresh and Per-User Cache Behavior
The dashboard now supports configurable auto-refresh intervals and per-user cached stats in `localStorage`.

Refresh interval options:
- Off (`0`)
- `15s` (`15000`)
- `30s` (`30000`)
- `60s` (`60000`)
- `5m` (`300000`)

Behavior details:
- Refresh interval is persisted per user with key format: `dashboard_refresh_interval_<userId>`.
- Dashboard stats are cached per user with key format: `dashboard_stats_cache_<userId>`.
- On load, cached stats render immediately when available, then data is refreshed in background.
- A manual `Refresh` button triggers a fetch without forcing full-page loading state.
- `Last updated` displays the timestamp from the latest successful fetch.

## Checkout Settings: Shortcuts and Quick-Sell
System settings now control checkout behavior:

- `checkout_shortcuts_enabled`:
  - `true`: keyboard shortcuts in checkout are active.
  - `false`: shortcut handler is bypassed, and the UI shows a disabled-shortcuts guidance message.

- `checkout_quicksell_enabled`:
  - `true`: displays a Quick Sell card in checkout.
  - `false`: quick-sell section is hidden.

- `checkout_quicksell_product_ids`:
  - Stored as a comma-separated product ID string.
  - Checkout resolves these IDs against loaded products to render quick-sell actions.
  - Each configured product supports quantity input and one-click add-to-cart.

## New Industry & Features Settings Tab
A new `Industry & Features` tab is available under Settings.

It supports:
- `industry_profile` selection (`GENERAL`, `SUPERMARKET`, `RESTAURANT`, `PHARMACY`).
- Feature toggles:
  - `feature_restaurant_enabled`
  - `feature_kitchen_enabled`
  - `feature_pharmacy_enabled`
  - `feature_receiving_enabled`
  - `feature_expiry_lots_enabled`
- Checkout controls:
  - `checkout_shortcuts_enabled`
  - `checkout_quicksell_enabled`
  - `checkout_quicksell_product_ids`

Save behavior for missing keys:
- Settings save attempts an update first.
- If update fails due to missing key (`404`, or error text indicating not found/missing), the setting is created automatically.
- New entries are created in category `system` with inferred type (or explicit meta type) and metadata labels/descriptions.

## Sidebar and Route Gating via Feature Flags
Feature flags are loaded from system settings at app startup for authenticated users.

Gating behavior:
- Sidebar items are filtered by both role permissions and feature flags.
- Protected routes are validated by both role permissions and feature flags.
- If a route is disabled by feature flag, navigation falls back to `/`.

Current path-to-flag mapping:
- `/expiry-lots` -> `feature_expiry_lots_enabled`
- `/restaurant/tables` -> `feature_restaurant_enabled`
- `/kitchen` -> `feature_kitchen_enabled`
- `/pharmacy` -> `feature_pharmacy_enabled`
- `/receiving` -> `feature_receiving_enabled`

## Operator and Admin Notes / Limitations
- Defaults are conservative: if a feature flag is absent or settings fail to load, feature-gated modules default to disabled.
- During authenticated app bootstrap, routes wait for feature settings load (`Loading settings...`) to avoid flicker or unauthorized exposure.
- Changing `industry_profile` applies opinionated default toggles in the settings UI; admins should verify individual toggles before saving if they want custom combinations.
- Quick-sell entries depend on existing product IDs; stale/removed IDs will not render as quick-sell products.
- Only users with Settings access (role-based, typically `ADMIN` and `MANAGER`) can configure these controls.
