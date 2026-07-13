import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Platform, KeyboardAvoidingView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter, Redirect } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { isLoyaltyApp } from "@/src/appMode";
import { pickImageFromGallery, PickedFile } from "@/src/imagePicker";
import { ImageCropEditor } from "@/src/components/ImageCropEditor";

export default function AdminSettingsRoute() {
  if (!isLoyaltyApp()) return <Redirect href={"/" as any} />;
  return <AdminSettings />;
}

// Per-screen decorative backgrounds on the customer app — independent of the
// home hero image, uploaded/replaced the same way (same endpoint/pattern).
type BgKey = "home" | "reservations" | "account" | "menu";
const BG_FIELDS: { key: BgKey; itemId: string; field: string; labelFr: string; labelEn: string }[] = [
  { key: "home", itemId: "bg_home", field: "bg_home_url", labelFr: "Arrière-plan Accueil", labelEn: "Home background" },
  { key: "reservations", itemId: "bg_reservations", field: "bg_reservations_url", labelFr: "Arrière-plan Réservations", labelEn: "Reservations background" },
  { key: "account", itemId: "bg_account", field: "bg_account_url", labelFr: "Arrière-plan Compte", labelEn: "Account background" },
  { key: "menu", itemId: "bg_menu", field: "bg_menu_url", labelFr: "Arrière-plan Menu", labelEn: "Menu background" },
];

function AdminSettings() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { lang } = useI18n();

  const [indoor, setIndoor] = useState("30");
  const [terrace, setTerrace] = useState("20");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroErr, setHeroErr] = useState<string | null>(null);
  const [heroSavedAt, setHeroSavedAt] = useState<Date | null>(null);

  const [bgUrls, setBgUrls] = useState<Record<BgKey, string | null>>({ home: null, reservations: null, account: null, menu: null });
  const [bgUploading, setBgUploading] = useState<Record<BgKey, boolean>>({ home: false, reservations: false, account: false, menu: false });
  const [bgErr, setBgErr] = useState<Record<BgKey, string | null>>({ home: null, reservations: null, account: null, menu: null });
  const [bgSavedAt, setBgSavedAt] = useState<Record<BgKey, Date | null>>({ home: null, reservations: null, account: null, menu: null });

  // Crop step shared by the hero image and the 4 backgrounds — differ only
  // in target aspect ratio and which upload path runs on confirm.
  type CropTarget = { kind: "hero"; file: PickedFile } | { kind: "bg"; cfg: (typeof BG_FIELDS)[number]; file: PickedFile };
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const c = await api.adminGetCapacity();
      setIndoor(String(c.indoor));
      setTerrace(String(c.terrace));
    } catch (e: any) {
      setErr(e?.message?.includes("403") ? (lang === "fr" ? "Accès refusé" : "Access denied") : (lang === "fr" ? "Erreur de chargement" : "Failed to load"));
    } finally {
      setFetching(false);
    }
  }, [lang]);

  const loadHero = useCallback(async () => {
    try {
      const s = await api.adminCmsGetSettings();
      setSettingsId(s.id);
      setHeroImageUrl(s.hero_image_url || null);
      setBgUrls({
        home: s.bg_home_url || null,
        reservations: s.bg_reservations_url || null,
        account: s.bg_account_url || null,
        menu: s.bg_menu_url || null,
      });
    } catch {
      // silent — the capacity card above already surfaces a load error if auth is the issue.
    }
  }, []);

  useEffect(() => {
    if (user && user.is_admin) { load(); loadHero(); }
  }, [user, load, loadHero]);

  const pickHeroImage = async () => {
    let picked: Awaited<ReturnType<typeof pickImageFromGallery>>;
    try {
      picked = await pickImageFromGallery();
    } catch (e: any) {
      console.log("[HERO-UPLOAD-DEBUG] stage=pick failed", { name: e?.name, message: e?.message, stack: e?.stack });
      setHeroErr(lang === "fr" ? "Échec du téléversement, réessayez" : "Upload failed, retry");
      return;
    }
    if (!picked) return;
    setCropTarget({ kind: "hero", file: picked });
  };

  const uploadHeroImage = async (picked: PickedFile) => {
    setHeroErr(null);
    setHeroSavedAt(null);
    setHeroUploading(true);

    let url: string;
    try {
      console.log("[HERO-UPLOAD-DEBUG] stage=upload start", { settingsId, name: picked.name, type: picked.type, size: picked.size, uri: picked.uri });
      const res = await api.adminCmsUploadImage("hero", picked, "original");
      url = res.url;
      console.log("[HERO-UPLOAD-DEBUG] stage=upload ok", { url });
    } catch (e: any) {
      console.log("[HERO-UPLOAD-DEBUG] stage=upload failed", { name: e?.name, message: e?.message, stack: e?.stack });
      setHeroErr(lang === "fr" ? "Échec du téléversement, réessayez" : "Upload failed, retry");
      setHeroUploading(false);
      return;
    }

    try {
      if (!settingsId) throw new Error("no settings row");
      await api.adminCmsUpdateSettings(settingsId, { hero_image_url: url });
      setHeroImageUrl(url);
      setHeroSavedAt(new Date());
    } catch (e: any) {
      console.log("[HERO-UPLOAD-DEBUG] stage=save-settings failed", { name: e?.name, message: e?.message, stack: e?.stack });
      setHeroErr(lang === "fr" ? "Échec du téléversement, réessayez" : "Upload failed, retry");
    } finally {
      setHeroUploading(false);
    }
  };

  const pickBgImage = async (cfg: (typeof BG_FIELDS)[number]) => {
    let picked: Awaited<ReturnType<typeof pickImageFromGallery>>;
    try {
      picked = await pickImageFromGallery();
    } catch (e: any) {
      console.log(`[BG-UPLOAD-DEBUG:${cfg.key}] stage=pick failed`, { name: e?.name, message: e?.message, stack: e?.stack });
      setBgErr((s) => ({ ...s, [cfg.key]: lang === "fr" ? "Échec du téléversement, réessayez" : "Upload failed, retry" }));
      return;
    }
    if (!picked) return;
    setCropTarget({ kind: "bg", cfg, file: picked });
  };

  const uploadBgImage = async (cfg: (typeof BG_FIELDS)[number], picked: PickedFile) => {
    setBgErr((s) => ({ ...s, [cfg.key]: null }));
    setBgSavedAt((s) => ({ ...s, [cfg.key]: null }));
    setBgUploading((s) => ({ ...s, [cfg.key]: true }));

    let url: string;
    try {
      console.log(`[BG-UPLOAD-DEBUG:${cfg.key}] stage=upload start`, { settingsId, name: picked.name, type: picked.type, size: picked.size, uri: picked.uri });
      const res = await api.adminCmsUploadImage(cfg.itemId, picked, "original");
      url = res.url;
      console.log(`[BG-UPLOAD-DEBUG:${cfg.key}] stage=upload ok`, { url });
    } catch (e: any) {
      console.log(`[BG-UPLOAD-DEBUG:${cfg.key}] stage=upload failed`, { name: e?.name, message: e?.message, stack: e?.stack });
      setBgErr((s) => ({ ...s, [cfg.key]: lang === "fr" ? "Échec du téléversement, réessayez" : "Upload failed, retry" }));
      setBgUploading((s) => ({ ...s, [cfg.key]: false }));
      return;
    }

    try {
      if (!settingsId) throw new Error("no settings row");
      await api.adminCmsUpdateSettings(settingsId, { [cfg.field]: url });
      setBgUrls((s) => ({ ...s, [cfg.key]: url }));
      setBgSavedAt((s) => ({ ...s, [cfg.key]: new Date() }));
    } catch (e: any) {
      console.log(`[BG-UPLOAD-DEBUG:${cfg.key}] stage=save-settings failed`, { name: e?.name, message: e?.message, stack: e?.stack });
      setBgErr((s) => ({ ...s, [cfg.key]: lang === "fr" ? "Échec du téléversement, réessayez" : "Upload failed, retry" }));
    } finally {
      setBgUploading((s) => ({ ...s, [cfg.key]: false }));
    }
  };

  const handleCropConfirm = (file: PickedFile) => {
    const target = cropTarget;
    setCropTarget(null);
    if (!target) return;
    if (target.kind === "hero") uploadHeroImage(file);
    else uploadBgImage(target.cfg, file);
  };

  const save = async () => {
    setErr(null);
    const i = parseInt(indoor, 10);
    const tr = parseInt(terrace, 10);
    if (!Number.isFinite(i) || !Number.isFinite(tr) || i < 0 || i > 500 || tr < 0 || tr > 500) {
      setErr(lang === "fr" ? "Valeurs entre 0 et 500" : "Values between 0 and 500");
      return;
    }
    setSaving(true);
    try {
      await api.adminUpdateCapacity(i, tr);
      setSavedAt(new Date());
    } catch (e: any) {
      const m = e?.message || "";
      setErr(m.includes("403") ? (lang === "fr" ? "Réservé au propriétaire / manager" : "Owner/manager only") : (lang === "fr" ? "Erreur, réessayez" : "Error, retry"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || (fetching && !err)) {
    return <View style={styles.container}><ActivityIndicator color={theme.color.brand} style={{ flex: 1 }} /></View>;
  }
  if (!user || !user.is_admin) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Feather name="lock" size={28} color={theme.color.brand} />
          <Text style={{ color: theme.color.onSurface, marginTop: 12, fontSize: 16 }}>
            {lang === "fr" ? "Accès administrateur requis" : "Admin access required"}
          </Text>
          <Pressable onPress={() => router.replace("/admin")} style={[styles.cta, { marginTop: 20 }]}>
            <Text style={styles.ctaTxt}>{lang === "fr" ? "Se connecter" : "Sign in"}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View testID="admin-settings-screen" style={styles.container}>
      <LinearGradient colors={["#0F0A05", "#050505"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="settings-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
              <Feather name="arrow-left" size={20} color={theme.color.onSurface} />
            </Pressable>
            <View>
              <Text style={styles.eyebrowSmall}>ADMIN · {lang === "fr" ? "PARAMÈTRES" : "SETTINGS"}</Text>
              <Text style={styles.title}>{lang === "fr" ? "Capacité des zones" : "Zone capacity"}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            <View style={styles.infoBox}>
              <Feather name="info" size={13} color={theme.color.brand} />
              <Text style={styles.infoTxt}>
                {lang === "fr"
                  ? "Capacité totale par zone, par créneau horaire. Les réservations existantes ne sont pas affectées par un changement."
                  : "Total capacity per zone, per time slot. Existing reservations are not affected by a change."}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}><Feather name="home" size={18} color={theme.color.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{lang === "fr" ? "Restaurant intérieur" : "Indoor restaurant"}</Text>
                  <Text style={styles.cardSub}>{lang === "fr" ? "Places assises totales" : "Total seats"}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Pressable testID="indoor-minus" onPress={() => setIndoor(String(Math.max(0, parseInt(indoor || "0", 10) - 1)))} style={styles.qtyBtn}>
                  <Feather name="minus" size={16} color={theme.color.brand} />
                </Pressable>
                <TextInput
                  testID="indoor-input"
                  style={styles.input}
                  keyboardType="number-pad"
                  value={indoor}
                  onChangeText={(v) => setIndoor(v.replace(/[^0-9]/g, ""))}
                />
                <Pressable testID="indoor-plus" onPress={() => setIndoor(String(Math.min(500, parseInt(indoor || "0", 10) + 1)))} style={styles.qtyBtn}>
                  <Feather name="plus" size={16} color={theme.color.brand} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.card, { marginTop: theme.space.md }]}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}><Feather name="sun" size={18} color={theme.color.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{lang === "fr" ? "Terrasse" : "Terrace"}</Text>
                  <Text style={styles.cardSub}>{lang === "fr" ? "Places assises totales" : "Total seats"}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Pressable testID="terrace-minus" onPress={() => setTerrace(String(Math.max(0, parseInt(terrace || "0", 10) - 1)))} style={styles.qtyBtn}>
                  <Feather name="minus" size={16} color={theme.color.brand} />
                </Pressable>
                <TextInput
                  testID="terrace-input"
                  style={styles.input}
                  keyboardType="number-pad"
                  value={terrace}
                  onChangeText={(v) => setTerrace(v.replace(/[^0-9]/g, ""))}
                />
                <Pressable testID="terrace-plus" onPress={() => setTerrace(String(Math.min(500, parseInt(terrace || "0", 10) + 1)))} style={styles.qtyBtn}>
                  <Feather name="plus" size={16} color={theme.color.brand} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.card, { marginTop: theme.space.md }]}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}><Feather name="image" size={18} color={theme.color.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{lang === "fr" ? "Image d'accueil" : "Home hero image"}</Text>
                  <Text style={styles.cardSub}>{lang === "fr" ? "Photo affichée en haut de l'écran d'accueil client" : "Photo shown at the top of the customer home screen"}</Text>
                </View>
              </View>
              {!!heroImageUrl && (
                <Image source={{ uri: heroImageUrl }} style={styles.heroPreview} resizeMode="cover" />
              )}
              <Pressable testID="hero-image-pick-btn" onPress={pickHeroImage} disabled={heroUploading} style={styles.heroPickBtn}>
                {heroUploading ? <ActivityIndicator color={theme.color.brand} /> : (
                  <>
                    <Feather name="upload" size={14} color={theme.color.brand} />
                    <Text style={styles.heroPickTxt}>{heroImageUrl ? (lang === "fr" ? "Remplacer l'image" : "Replace image") : (lang === "fr" ? "Choisir une image" : "Choose image")}</Text>
                  </>
                )}
              </Pressable>
              {heroErr && <Text testID="hero-error" style={styles.err}>{heroErr}</Text>}
              {heroSavedAt && !heroErr && (
                <View testID="hero-saved" style={styles.savedBox}>
                  <Feather name="check-circle" size={14} color={theme.color.success} />
                  <Text style={styles.savedTxt}>{lang === "fr" ? "Image mise à jour" : "Image updated"}</Text>
                </View>
              )}
            </View>

            <View style={[styles.card, { marginTop: theme.space.md }]}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}><Feather name="layers" size={18} color={theme.color.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{lang === "fr" ? "Arrière-plans des écrans" : "Screen backgrounds"}</Text>
                  <Text style={styles.cardSub}>
                    {lang === "fr"
                      ? "Image de fond derrière le contenu de chaque écran client (effet parallaxe au défilement)"
                      : "Backdrop image behind each customer screen's content (parallax on scroll)"}
                  </Text>
                </View>
              </View>
              {BG_FIELDS.map((cfg, i) => (
                <View key={cfg.key} style={i > 0 ? styles.bgRow : undefined}>
                  <Text style={styles.bgLabel}>{lang === "fr" ? cfg.labelFr : cfg.labelEn}</Text>
                  {!!bgUrls[cfg.key] && (
                    <Image source={{ uri: bgUrls[cfg.key]! }} style={styles.heroPreview} resizeMode="cover" />
                  )}
                  <Pressable
                    testID={`bg-${cfg.key}-pick-btn`}
                    onPress={() => pickBgImage(cfg)}
                    disabled={bgUploading[cfg.key]}
                    style={styles.heroPickBtn}
                  >
                    {bgUploading[cfg.key] ? <ActivityIndicator color={theme.color.brand} /> : (
                      <>
                        <Feather name="upload" size={14} color={theme.color.brand} />
                        <Text style={styles.heroPickTxt}>
                          {bgUrls[cfg.key] ? (lang === "fr" ? "Remplacer l'image" : "Replace image") : (lang === "fr" ? "Choisir une image" : "Choose image")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {bgErr[cfg.key] && <Text testID={`bg-${cfg.key}-error`} style={styles.err}>{bgErr[cfg.key]}</Text>}
                  {bgSavedAt[cfg.key] && !bgErr[cfg.key] && (
                    <View testID={`bg-${cfg.key}-saved`} style={styles.savedBox}>
                      <Feather name="check-circle" size={14} color={theme.color.success} />
                      <Text style={styles.savedTxt}>{lang === "fr" ? "Image mise à jour" : "Image updated"}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {err && <Text testID="settings-error" style={styles.err}>{err}</Text>}
            {savedAt && !err && (
              <View testID="settings-saved" style={styles.savedBox}>
                <Feather name="check-circle" size={14} color={theme.color.success} />
                <Text style={styles.savedTxt}>{lang === "fr" ? "Modifications enregistrées" : "Changes saved"}</Text>
              </View>
            )}

            <Pressable testID="save-settings-btn" onPress={save} disabled={saving} style={styles.submit}>
              {saving ? <ActivityIndicator color={theme.color.onBrandPrimary} /> : (
                <>
                  <Feather name="save" size={16} color={theme.color.onBrandPrimary} />
                  <Text style={[styles.submitTxt, { marginLeft: 8 }]}>{lang === "fr" ? "Enregistrer" : "Save"}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <ImageCropEditor
        visible={!!cropTarget}
        source={cropTarget?.file ?? null}
        aspectRatio={cropTarget?.kind === "hero" ? 9 / 16 : 9 / 19.5}
        lang={lang}
        onCancel={() => setCropTarget(null)}
        onConfirm={handleCropConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md, borderBottomWidth: 0.5, borderBottomColor: theme.color.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  eyebrowSmall: { color: theme.color.brand, fontSize: 9, letterSpacing: 2, fontWeight: "700", textAlign: "center" },
  title: { color: theme.color.onSurface, fontSize: 14, fontWeight: "500", textAlign: "center", marginTop: 2 },
  cta: { paddingHorizontal: 20, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center" },
  ctaTxt: { color: theme.color.onBrandPrimary, fontWeight: "700", letterSpacing: 1, fontSize: 13 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, marginBottom: theme.space.lg, borderRadius: theme.radius.md, backgroundColor: "rgba(212,175,55,0.08)", borderWidth: 1, borderColor: "rgba(212,175,55,0.3)" },
  infoTxt: { flex: 1, color: theme.color.onSurface, fontSize: 12, lineHeight: 16 },
  card: { padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: theme.space.md },
  cardIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: theme.color.brand, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.06)" },
  cardName: { color: theme.color.onSurface, fontSize: 15, fontWeight: "500" },
  cardSub: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  qtyBtn: { width: 44, height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.brand, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.06)", flexShrink: 0 },
  input: { flex: 1, flexShrink: 1, minWidth: 0, height: 52, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, paddingHorizontal: 8, color: theme.color.onSurface, backgroundColor: "rgba(255,255,255,0.04)", fontSize: 20, textAlign: "center", fontWeight: "600" },
  err: { color: theme.color.error, fontSize: 13, marginTop: theme.space.md, textAlign: "center" },
  savedBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: theme.space.md, paddingVertical: 10, borderRadius: theme.radius.md, backgroundColor: "rgba(46,160,67,0.08)", borderWidth: 1, borderColor: "rgba(46,160,67,0.3)" },
  savedTxt: { color: theme.color.success, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  submit: { flexDirection: "row", height: 54, borderRadius: theme.radius.md, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center", marginTop: theme.space.xl },
  submitTxt: { color: theme.color.onBrandPrimary, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  heroPreview: { width: "100%", height: 140, borderRadius: theme.radius.md, marginTop: theme.space.sm, marginBottom: theme.space.sm, backgroundColor: theme.color.surface },
  heroPickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.brand, backgroundColor: "rgba(212,175,55,0.06)" },
  heroPickTxt: { color: theme.color.brand, fontSize: 13, fontWeight: "600" },
  bgRow: { marginTop: theme.space.lg, paddingTop: theme.space.lg, borderTopWidth: 1, borderTopColor: theme.color.border },
  bgLabel: { color: theme.color.onSurface, fontSize: 13, fontWeight: "600", marginBottom: theme.space.sm },
});
