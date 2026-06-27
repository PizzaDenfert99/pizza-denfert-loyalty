import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView, Switch, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter, Redirect } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { pickImageFromGallery } from "@/src/imagePicker";
import { isLoyaltyApp } from "@/src/appMode";

type Item = {
  id: string;
  category: string;
  name: string;
  desc_fr?: string;
  desc_en?: string;
  ingredients_fr?: string;
  ingredients_en?: string;
  price?: number | null;
  prices?: Record<string, number> | null;
  image?: string;
};

const CATEGORIES = [
  { key: "pizzas", label: "Pizzas" },
  { key: "focaccias", label: "Focaccias" },
  { key: "gratins", label: "Gratins" },
  { key: "salades", label: "Salades" },
  { key: "desserts", label: "Desserts" },
  { key: "boissons", label: "Boissons" },
  { key: "vins", label: "Vins" },
];

export default function MenuCmsRoute() {
  if (!isLoyaltyApp()) return <Redirect href={"/" as any} />;
  return <MenuCms />;
}

function MenuCms() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const rows = await api.adminListMenu();
      setItems(rows || []);
    } catch (e: any) {
      showToast(e?.message || "Erreur de chargement");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) { router.replace("/admin"); return; }
    refresh();
  }, [user, loading]);

  if (loading || !user) {
    return <View style={s.center}><ActivityIndicator color={theme.color.brand} /></View>;
  }

  return (
    <View testID="menu-cms" style={s.container}>
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <Pressable testID="cms-back" onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={theme.color.brand} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>— CMS · MENU</Text>
            <Text style={s.title}>Gestion du menu</Text>
          </View>
          <Pressable testID="cms-add-item" onPress={() => setCreating(true)} style={s.addBtn}>
            <Feather name="plus" size={18} color={theme.color.onBrandPrimary} />
          </Pressable>
        </View>
      </SafeAreaView>

      {busy ? (
        <View style={s.center}><ActivityIndicator color={theme.color.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {CATEGORIES.map((c) => {
            const catItems = items.filter((i) => i.category === c.key);
            if (catItems.length === 0) return null;
            return (
              <View key={c.key} style={{ marginBottom: theme.space.xl }}>
                <Text style={s.catTitle}>{c.label} · {catItems.length}</Text>
                {catItems.map((it) => (
                  <Pressable key={it.id} testID={`cms-item-${it.id}`} onPress={() => setEditing(it)} style={s.itemRow}>
                    {it.image ? (
                      <Image source={it.image} style={s.thumb} contentFit="cover" />
                    ) : (
                      <View style={[s.thumb, s.thumbEmpty]}><Feather name="image" size={18} color={theme.color.muted} /></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{it.name}</Text>
                      <Text style={s.itemPrice}>
                        {it.prices
                          ? Object.entries(it.prices).map(([k, v]) => `${/^\d+$/.test(k) ? k + "cm" : k} ${Number(v).toFixed(2)}€`).join(" · ")
                          : (typeof it.price === "number" ? `${it.price.toFixed(2)} €` : "—")}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.color.muted} />
                  </Pressable>
                ))}
              </View>
            );
          })}
          {items.length === 0 && (
            <Text style={s.empty}>Aucun plat. Touchez + pour ajouter.</Text>
          )}
        </ScrollView>
      )}

      {(editing || creating) && (
        <ItemEditor
          item={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => { setEditing(null); setCreating(false); await refresh(); }}
          onToast={showToast}
        />
      )}

      {toast && (
        <View testID="cms-toast" style={s.toast}><Text style={s.toastTxt}>{toast}</Text></View>
      )}
    </View>
  );
}

function ItemEditor({ item, onClose, onSaved, onToast }: {
  item: Item | null; onClose: () => void; onSaved: () => void; onToast: (m: string) => void;
}) {
  const isNew = !item;
  const [category, setCategory] = useState(item?.category || "pizzas");
  const [name, setName] = useState(item?.name || "");
  const [descFr, setDescFr] = useState(item?.desc_fr || "");
  const [ingFr, setIngFr] = useState(item?.ingredients_fr || "");
  const [image, setImage] = useState(item?.image || "");
  const [usePizzaSizes, setUsePizzaSizes] = useState(!!item?.prices);
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");
  const [price26, setPrice26] = useState(item?.prices?.["26"] != null ? String(item.prices["26"]) : "");
  const [price31, setPrice31] = useState(item?.prices?.["31"] != null ? String(item.prices["31"]) : "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const picked = await pickImageFromGallery();
    if (!picked) return;
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(picked.blob);
      });
      setImage(dataUrl);
    } catch (e: any) {
      onToast(e?.message || "Échec de l'image");
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!name.trim()) { onToast("Nom requis"); return; }
    setSaving(true);
    try {
      const payload: any = {
        category, name: name.trim(),
        desc_fr: descFr, desc_en: descFr,
        ingredients_fr: ingFr, ingredients_en: ingFr,
        image,
      };
      if (usePizzaSizes) {
        payload.prices = { "26": parseFloat(price26) || 0, "31": parseFloat(price31) || 0 };
      } else {
        payload.price = parseFloat(price) || 0;
      }
      if (isNew) {
        await api.adminCreateMenuItem(payload);
      } else {
        await api.adminUpdateMenuItem(item!.id, payload);
      }
      onToast("Enregistré");
      onSaved();
    } catch (e: any) {
      onToast(e?.message || "Échec");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (isNew || !item) return;
    setSaving(true);
    try {
      await api.adminDeleteMenuItem(item.id);
      onToast("Supprimé");
      onSaved();
    } catch (e: any) {
      onToast(e?.message || "Échec");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>{isNew ? "Nouveau plat" : "Modifier le plat"}</Text>
                <Pressable testID="editor-close" onPress={onClose} hitSlop={12}><Feather name="x" size={22} color={theme.color.onSurface} /></Pressable>
              </View>

              {/* Image */}
              <Pressable testID="editor-pick-image" disabled={uploading} onPress={pick} style={s.imagePick}>
                {image ? (
                  <Image source={image} style={s.imagePreview} contentFit="cover" />
                ) : (
                  <View style={s.imagePlaceholder}>
                    {uploading ? <ActivityIndicator color={theme.color.brand} /> : (
                      <><Feather name="image" size={22} color={theme.color.brand} /><Text style={s.imagePickTxt}>Choisir une image</Text></>
                    )}
                  </View>
                )}
              </Pressable>

              {/* Category chips */}
              <Text style={s.lbl}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {CATEGORIES.map((c) => (
                  <Pressable key={c.key} testID={`editor-cat-${c.key}`} onPress={() => setCategory(c.key)} style={[s.chip, category === c.key && s.chipActive]}>
                    <Text style={[s.chipTxt, category === c.key && s.chipTxtActive]}>{c.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={s.lbl}>Nom</Text>
              <TextInput testID="editor-name" style={s.input} value={name} onChangeText={setName} placeholder="Margherita" placeholderTextColor={theme.color.muted} />

              <Text style={s.lbl}>Description</Text>
              <TextInput testID="editor-desc" style={[s.input, { height: 70 }]} value={descFr} onChangeText={setDescFr} placeholder="Notre signature…" placeholderTextColor={theme.color.muted} multiline />

              <Text style={s.lbl}>Ingrédients</Text>
              <TextInput testID="editor-ingredients" style={[s.input, { height: 70 }]} value={ingFr} onChangeText={setIngFr} placeholder="Tomate, mozzarella, basilic…" placeholderTextColor={theme.color.muted} multiline />

              <View style={s.sizeToggle}>
                <Text style={s.lbl}>Deux tailles (26/31 cm)</Text>
                <Switch testID="editor-sizes-toggle" value={usePizzaSizes} onValueChange={setUsePizzaSizes} trackColor={{ true: theme.color.brand, false: theme.color.border }} thumbColor="#fff" />
              </View>

              {usePizzaSizes ? (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lbl}>Prix 26 cm (€)</Text>
                    <TextInput testID="editor-price-26" style={s.input} value={price26} onChangeText={setPrice26} keyboardType="decimal-pad" placeholder="10.90" placeholderTextColor={theme.color.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lbl}>Prix 31 cm (€)</Text>
                    <TextInput testID="editor-price-31" style={s.input} value={price31} onChangeText={setPrice31} keyboardType="decimal-pad" placeholder="13.90" placeholderTextColor={theme.color.muted} />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={s.lbl}>Prix (€)</Text>
                  <TextInput testID="editor-price" style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="7.50" placeholderTextColor={theme.color.muted} />
                </>
              )}

              <Pressable testID="editor-save" onPress={save} disabled={saving} style={s.saveBtn}>
                {saving ? <ActivityIndicator color={theme.color.onBrandPrimary} /> : <Text style={s.saveTxt}>{isNew ? "Ajouter au menu" : "Enregistrer"}</Text>}
              </Pressable>
              {!isNew && (
                <Pressable testID="editor-delete" onPress={remove} disabled={saving} style={s.deleteBtn}>
                  <Feather name="trash-2" size={15} color={theme.color.error} />
                  <Text style={s.deleteTxt}>Supprimer</Text>
                </Pressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm, paddingBottom: theme.space.md, borderBottomWidth: 0.5, borderBottomColor: theme.color.border },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.color.borderStrong, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: theme.color.brand, letterSpacing: 3, fontSize: 10, fontWeight: "700", marginBottom: 2 },
  title: { color: theme.color.onSurface, fontSize: 24, fontWeight: "300", letterSpacing: -0.5 },
  catTitle: { color: theme.color.brand, fontSize: 12, letterSpacing: 2, fontWeight: "700", marginBottom: theme.space.md, textTransform: "uppercase" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, marginBottom: theme.space.sm },
  thumb: { width: 52, height: 52, borderRadius: theme.radius.sm },
  thumbEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceTertiary },
  itemName: { color: theme.color.onSurface, fontSize: 15, fontWeight: "500" },
  itemPrice: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 3 },
  empty: { color: theme.color.muted, textAlign: "center", padding: theme.space.xxl, fontStyle: "italic" },
  toast: { position: "absolute", bottom: 30, alignSelf: "center", backgroundColor: theme.color.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  toastTxt: { color: theme.color.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.space.xl, maxHeight: "92%", borderTopWidth: 1, borderColor: theme.color.borderStrong },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.space.lg },
  modalTitle: { color: theme.color.onSurface, fontSize: 22, fontWeight: "300" },
  imagePick: { height: 160, borderRadius: theme.radius.md, overflow: "hidden", marginBottom: theme.space.md, borderWidth: 1, borderColor: theme.color.border, borderStyle: "dashed" },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  imagePickTxt: { color: theme.color.brand, fontSize: 12, fontWeight: "600" },
  lbl: { color: theme.color.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, fontWeight: "600", marginBottom: 6, marginTop: theme.space.md },
  input: { borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, paddingHorizontal: theme.space.md, paddingVertical: 12, color: theme.color.onSurface, backgroundColor: "rgba(255,255,255,0.04)", fontSize: 15 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: theme.color.borderStrong, justifyContent: "center", flexShrink: 0 },
  chipActive: { borderColor: theme.color.brand, backgroundColor: "rgba(212,175,55,0.12)" },
  chipTxt: { color: theme.color.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  chipTxtActive: { color: theme.color.brand },
  sizeToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.space.sm },
  saveBtn: { height: 54, borderRadius: theme.radius.md, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center", marginTop: theme.space.xl },
  saveTxt: { color: theme.color.onBrandPrimary, fontWeight: "700", letterSpacing: 1, fontSize: 14 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.error, marginTop: theme.space.md },
  deleteTxt: { color: theme.color.error, fontWeight: "600", fontSize: 13 },
});
