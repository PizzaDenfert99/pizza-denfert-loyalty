import { Redirect } from "expo-router";

// SINGLE ADMIN PANEL — the main PizzaDenfert app no longer hosts its own admin.
// All management (menu, prices, categories, images, loyalty, staff, stats) is
// handled exclusively by the shared Loyalty Admin CMS at
// https://loyalty.pizzadenfert.fr/admin-cms (same backend + same MongoDB).
// This retired route redirects customers back to the app so there is never a
// second/parallel admin system.
export default function RetiredAdmin() {
  return <Redirect href={"/" as any} />;
}
