import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { theme } from "@/src/theme";
import { isLoyaltyApp } from "@/src/appMode";

// Menu CMS entry. The CMS is MongoDB-backed and reuses the admin JWT session.
// If the current user is an admin → go straight to the menu manager dashboard.
// Otherwise send them to the admin login (the lock screen on /admin).
export default function AdminCmsEntry() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user?.is_admin) router.replace("/admin-cms/dashboard");
  }, [user, loading, router]);

  if (!isLoyaltyApp()) return <Redirect href={"/" as any} />;
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: theme.color.surface }}><ActivityIndicator color={theme.color.brand} style={{ flex: 1 }} /></View>;
  }
  if (!user?.is_admin) return <Redirect href={"/admin" as any} />;
  return <View style={{ flex: 1, backgroundColor: theme.color.surface }}><ActivityIndicator color={theme.color.brand} style={{ flex: 1 }} /></View>;
}
