// Expo dynamic configuration for the Pizza Denfert LOYALTY tablet app.
//
// This project IS the loyalty/admin/kiosk tablet app. The variant defaults to
// "loyalty" so the generated APK and the Emergent web preview both run in
// loyalty mode (src/appMode.ts reads Constants.expoConfig.extra.variant).
//
// Set APP_VARIANT=main only if you ever want to reuse this same codebase to
// produce the customer-facing build.

import type { ExpoConfig, ConfigContext } from "expo/config";
const base = require("./app.json").expo as ExpoConfig;

type Variant = "main" | "loyalty";

const variant: Variant = process.env.APP_VARIANT === "main" ? "main" : "loyalty";

export default ({ config: _c }: ConfigContext): ExpoConfig => {
  if (variant === "loyalty") {
    return {
      ...base,
      name: "Pizza Denfert · Fidélité",
      android: {
        ...(base.android || {}),
        package: "fr.pizzadenfert.loyalty",
      },
      ios: {
        ...(base.ios || {}),
        bundleIdentifier: "fr.pizzadenfert.loyalty",
      },
      extra: {
        ...(base.extra || {}),
        variant: "loyalty",
        buildLabel: "loyalty",
      },
    };
  }

  return {
    ...base,
    extra: {
      ...(base.extra || {}),
      variant: "main",
      buildLabel: "main",
    },
  };
};
