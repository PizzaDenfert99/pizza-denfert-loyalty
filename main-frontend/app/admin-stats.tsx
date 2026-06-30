import { Redirect } from "expo-router";

// Retired — see app/admin.tsx. Management (incl. statistics) lives only in the
// shared Loyalty Admin CMS. This route redirects to avoid a second admin panel.
export default function RetiredAdminStats() {
  return <Redirect href={"/" as any} />;
}
