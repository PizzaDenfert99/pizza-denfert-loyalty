import { Redirect } from "expo-router";

// Retired — see app/admin.tsx. Staff management lives only in the shared
// Loyalty Admin CMS. This route redirects to avoid a second admin panel.
export default function RetiredAdminStaff() {
  return <Redirect href={"/" as any} />;
}
