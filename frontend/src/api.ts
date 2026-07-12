import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Choose the correct backend per environment:
//  - Production browsers on the Hetzner-served domains hit `https://api.pizzadenfert.fr`
//  - Everywhere else (Emergent dev preview, native dev/release) uses `EXPO_PUBLIC_BACKEND_URL`
const ENV_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
let BASE = ENV_BASE;
if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
  const host = window.location.hostname;
  if (host === "pizzadenfert.fr" || host === "www.pizzadenfert.fr" || host === "admin.pizzadenfert.fr") {
    BASE = "https://api.pizzadenfert.fr";
  }
}
// On native, EXPO_PUBLIC_BACKEND_URL is baked into the JS bundle at BUILD time (eas build/update),
// not read at runtime — an APK built from an older profile (e.g. "preview"/"development", which
// point at the Emergent preview backend, not "production") will silently keep hitting that stale
// URL forever regardless of what .env says today. Log it once so a wrong-backend install shows up
// immediately in adb logcat instead of masquerading as an upload/auth bug.
console.log("[HERO-UPLOAD-DEBUG] api.ts BASE resolved to", BASE, "platform:", Platform.OS);

let _token: string | null = null;
export async function loadToken() {
  if (_token) return _token;
  _token = await AsyncStorage.getItem("@auth_token");
  return _token;
}
export async function setToken(t: string | null) {
  _token = t;
  if (t) await AsyncStorage.setItem("@auth_token", t);
  else await AsyncStorage.removeItem("@auth_token");
}

async function req(path: string, opts: RequestInit = {}) {
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const tok = await loadToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;
  const r = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`${r.status}: ${txt}`);
  }
  return r.json();
}

export const api = {
  otpRequest: (phone: string, name?: string) =>
    req("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone, name }) }),
  otpVerify: (phone: string, code: string, name?: string) =>
    req("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code, name }) }),
  register: (email: string, password: string, name: string) =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  googleSession: (session_id: string) =>
    req("/auth/google/session", { method: "POST", body: JSON.stringify({ session_id }) }),
  me: () => req("/auth/me"),
  logout: () => req("/auth/logout", { method: "POST" }),
  menu: () => req("/menu"),
  menuVersion: () => req("/menu/version"),
  // CMS menu (Supabase-backed), proxied server-side — no Supabase creds on the client.
  // This is the actual source of truth the customer app reads; adminListMenu/adminCreateMenuItem/
  // etc. below are legacy MongoDB-backed and kept only as a fallback — they do NOT sync here.
  publicCategories: () => req("/public/categories"),
  publicMenuItems: () => req("/public/menu-items"),
  publicRestaurantSettings: () => req("/public/restaurant-settings"),
  adminListMenu: () => req("/admin/menu"),
  adminCreateMenuItem: (data: any) => req("/admin/menu", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateMenuItem: (id: string, patch: any) =>
    req(`/admin/menu/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  adminDeleteMenuItem: (id: string) =>
    req(`/admin/menu/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createReservation: (data: any) => req("/reservations", { method: "POST", body: JSON.stringify(data) }),
  createGuestReservation: (data: any) => req("/reservations/guest", { method: "POST", body: JSON.stringify(data) }),
  reservationAvailability: (date: string, time: string) =>
    req(`/reservations/availability?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`),
  myReservations: () => req("/reservations/me"),
  loyalty: () => req("/loyalty/me"),
  redeem: (reward: string) => req("/loyalty/redeem", { method: "POST", body: JSON.stringify({ reward }) }),
  adminScan: (qr_data: string) => req("/admin/scan", { method: "POST", body: JSON.stringify({ qr_data }) }),
  adminSearch: (query: string) => req("/admin/search", { method: "POST", body: JSON.stringify({ query }) }),
  adminAddPizza: (user_id: string, qr_token: string, pizza_count: number = 1, pizza_id?: string | null) =>
    req("/admin/customer/add-pizza", { method: "POST", body: JSON.stringify({ user_id, qr_token, pizza_count, pizza_id: pizza_id || null }) }),
  adminRedeem: (user_id: string, qr_token: string, reward: string) =>
    req("/admin/customer/redeem", { method: "POST", body: JSON.stringify({ user_id, qr_token, reward }) }),
  adminDashboard: (period: "today" | "week" | "month" | "all" = "all") =>
    req(`/admin/dashboard?period=${period}`),
  adminCreateStaff: (phone: string, name: string, role: string) =>
    req("/admin/staff/create", { method: "POST", body: JSON.stringify({ phone, name, role }) }),
  adminListStaff: () => req("/admin/staff"),
  adminUpdateRole: (user_id: string, role: string) =>
    req(`/admin/staff/${encodeURIComponent(user_id)}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  adminToggleDisabled: (user_id: string, disabled: boolean) =>
    req(`/admin/staff/${encodeURIComponent(user_id)}/disable`, { method: "PATCH", body: JSON.stringify({ disabled }) }),
  adminDeleteStaff: (user_id: string) =>
    req(`/admin/staff/${encodeURIComponent(user_id)}`, { method: "DELETE" }),
  adminGetCapacity: () => req("/admin/settings/capacity"),
  adminUpdateCapacity: (indoor: number, terrace: number, extras?: { tables_indoor?: number; tables_terrace?: number; seats_per_table?: number }) =>
    req("/admin/settings/capacity", { method: "PUT", body: JSON.stringify({ indoor, terrace, ...(extras || {}) }) }),
  adminListReservations: (params: { period?: string; from_date?: string; to_date?: string; status?: string; q?: string; zone?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); });
    const s = qs.toString();
    return req(`/admin/reservations${s ? `?${s}` : ""}`);
  },
  adminReservationsDay: (date: string) =>
    req(`/admin/reservations/day?date=${encodeURIComponent(date)}`),
  adminUpdateReservation: (rid: string, patch: any) =>
    req(`/admin/reservations/${encodeURIComponent(rid)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  adminCreateReservation: (data: any) =>
    req(`/admin/reservations`, { method: "POST", body: JSON.stringify(data) }),
  pushPublicKey: () => req("/push/web/public-key"),
  pushSubscribe: (sub: { endpoint: string; keys: any }) =>
    req("/push/web/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  pushUnsubscribe: (sub: { endpoint: string; keys: any }) =>
    req("/push/web/unsubscribe", { method: "POST", body: JSON.stringify(sub) }),
  pushStatus: () => req("/push/web/status"),
  pushTest: () => req("/push/web/test", { method: "POST" }),
  // Kiosk / Advertising Management
  publicAdSlides: () => req("/ads/slides"),
  adminListAdSlides: () => req("/admin/ads/slides"),
  adminCreateAdSlide: (data: { section: "loyalty"|"experience"|"ingredients"; title: string; subtitle?: string; image_url?: string; duration_ms?: number; active?: boolean; order?: number }) =>
    req("/admin/ads/slides", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateAdSlide: (id: string, patch: any) =>
    req(`/admin/ads/slides/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  adminDeleteAdSlide: (id: string) =>
    req(`/admin/ads/slides/${encodeURIComponent(id)}`, { method: "DELETE" }),
  adminReorderAdSlides: (ids: string[]) =>
    req(`/admin/ads/reorder`, { method: "PUT", body: JSON.stringify({ ids }) }),
  adminGetKioskSettings: () => req("/admin/ads/settings"),
  adminUpdateKioskSettings: (patch: { idle_seconds?: number; loop?: boolean; default_duration_ms?: number; show_section_titles?: boolean }) =>
    req("/admin/ads/settings", { method: "PUT", body: JSON.stringify(patch) }),
  // Admin CMS (Supabase-backed categories/menu_items/restaurant_settings) — proxied
  // server-side with the service-role key, protected by the same admin JWT as everything
  // else above (no separate Supabase Auth session).
  adminCmsListCategories: () => req("/admin/cms/categories"),
  adminCmsCreateCategory: (data: { name: string; slug: string; sort_order?: number; is_active?: boolean }) =>
    req("/admin/cms/categories", { method: "POST", body: JSON.stringify(data) }),
  adminCmsUpdateCategory: (id: string, patch: any) =>
    req(`/admin/cms/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  adminCmsDeleteCategory: (id: string) =>
    req(`/admin/cms/categories/${encodeURIComponent(id)}`, { method: "DELETE" }),
  adminCmsListMenuItems: () => req("/admin/cms/menu-items"),
  adminCmsCreateMenuItem: (data: any) =>
    req("/admin/cms/menu-items", { method: "POST", body: JSON.stringify(data) }),
  adminCmsUpdateMenuItem: (id: string, patch: any) =>
    req(`/admin/cms/menu-items/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  adminCmsDeleteMenuItem: (id: string) =>
    req(`/admin/cms/menu-items/${encodeURIComponent(id)}`, { method: "DELETE" }),
  adminCmsSeedFromMongo: () => req("/admin/cms/seed-from-mongo", { method: "POST" }),
  adminCmsGetSettings: () => req("/admin/cms/restaurant-settings"),
  adminCmsUpdateSettings: (id: string, patch: any) =>
    req(`/admin/cms/restaurant-settings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  adminCmsUploadImage: async (
    itemId: string,
    file: { name: string; type: string; uri?: string; blob?: Blob } & Partial<Blob>,
    kind: "original" | "thumb" = "original",
  ): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("item_id", itemId);
    form.append("kind", kind);
    // On native, stream directly from the local uri instead of re-sending a
    // Blob that was itself produced by fetch(uri).blob() — round-tripping a
    // local file through two fetch() calls (once to read it, once to upload
    // it) is a known-unreliable pattern on React Native/Android and can fail
    // the upload outright on some devices even though the read succeeded.
    // RN's fetch/FormData natively streams file contents from this
    // {uri, name, type} shape without an intermediate JS-side Blob.
    if (Platform.OS !== "web" && (file as any).uri) {
      form.append("file", { uri: (file as any).uri, name: file.name, type: file.type } as any);
    } else {
      form.append("file", (file.blob || (file as any)) as any, file.name);
    }
    const tok = await loadToken();
    const headers: any = {};
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
    const url = `${BASE}/api/admin/cms/upload-image`;
    console.log("[HERO-UPLOAD-DEBUG] uploading", { BASE, url, itemId, kind, name: file.name, type: file.type, hasToken: !!tok, platform: Platform.OS, tokLen: tok?.length ?? 0 });
    // 20s timeout so a request that silently hangs (bad wifi, MTU issues with
    // large multipart bodies, etc.) surfaces as a clear timeout log instead of
    // an indefinite spinner with no diagnostic trail.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let r: Response;
    const t0 = Date.now();
    try {
      r = await fetch(url, { method: "POST", headers, body: form, signal: ctrl.signal });
    } catch (e: any) {
      console.log("[HERO-UPLOAD-DEBUG] fetch threw", { name: e?.name, message: e?.message, ms: Date.now() - t0 });
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const contentType = r.headers.get("content-type") || "";
    console.log("[HERO-UPLOAD-DEBUG] response", { status: r.status, ok: r.ok, contentType, ms: Date.now() - t0 });
    const txt = await r.text();
    if (!r.ok) {
      console.log("[HERO-UPLOAD-DEBUG] error body", txt.slice(0, 500));
      throw new Error(`${r.status}: ${txt}`);
    }
    try {
      return JSON.parse(txt);
    } catch {
      console.log("[HERO-UPLOAD-DEBUG] response ok but not JSON", { contentType, body: txt.slice(0, 500) });
      throw new Error(`Upload succeeded but response wasn't JSON (content-type: ${contentType})`);
    }
  },
};

export { BASE };
