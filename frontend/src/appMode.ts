// App mode detection — branches behaviour based on the host we're served from
// (web) or the build variant baked into the APK (native).
//
// WEB
//   * pizzadenfert.fr / admin.pizzadenfert.fr → "main"
//   * loyalty.pizzadenfert.fr                  → "loyalty"
//
// NATIVE (iOS / Android)
//   * APK built with `eas build --profile production-loyalty-apk`
//     (sets env APP_VARIANT=loyalty → app.config.ts injects extra.variant)
//                                              → "loyalty"
//   * Any other native build (main customer APK)
//                                              → "main"
//
// The same JS bundle ships for both variants; only the entitlement check
// here decides which routes / UI surface the user can reach at runtime.

import { Platform } from "react-native";
import Constants from "expo-constants";

export type AppMode = "main" | "loyalty";

function nativeVariantFromBuildConfig(): AppMode {
  // Order of precedence: typed config → manifest (legacy) → default main
  const fromExpoConfig = (Constants.expoConfig as any)?.extra?.variant;
  const fromManifest = (Constants as any)?.manifest?.extra?.variant;
  const v = (fromExpoConfig || fromManifest || "main") as string;
  return v === "loyalty" ? "loyalty" : "main";
}

export function getAppMode(): AppMode {
  // This project IS the loyalty tablet app (Admin + Kiosk + Loyalty). The build
  // variant defaults to "loyalty" (see app.json extra.variant), so both the
  // Emergent web preview and the generated APK run in loyalty mode.
  if (Platform.OS !== "web") return nativeVariantFromBuildConfig();
  if (typeof window === "undefined" || !window.location?.hostname) return "loyalty";
  const host = window.location.hostname;
  // The standalone main customer site is the only place we fall back to "main".
  if (host === "pizzadenfert.fr" || host === "www.pizzadenfert.fr") return "main";
  return "loyalty";
}

export const isLoyaltyApp = () => getAppMode() === "loyalty";
export const isMainApp = () => getAppMode() === "main";
