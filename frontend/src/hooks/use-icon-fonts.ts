// Icon font loader + premium brand serif/script fonts.
//
// ICONS (Expo Go only): @expo/vector-icons' .ttf files come back as 0 bytes
// from Metro's asset resolver on Android Expo Go, so under StoreClient we load
// them from a CDN. Native dev/prod builds + web pass an empty map (icons are
// bundled / web-stubbed) so useFonts resolves immediately.
//
// BRAND FONTS (all environments): Playfair Display (serif wordmark) and
// Dancing Script (script tagline) are bundled locally as .ttf and loaded via
// expo-font — NO @expo-google-fonts dependency. The screens reference the
// weight-suffixed family names (e.g. "PlayfairDisplay_600SemiBold"); we map
// each of those names to the bundled variable TTF so they all resolve.
//
// ICON_VECTOR_VERSION must match @expo/vector-icons in package.json.
// Usage: const [loaded, error] = useIconFonts();

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";

const ICON_VECTOR_VERSION = "15.1.1";

// short internal fontName (what the library queries) -> CDN .ttf file name
const ICON_FAMILIES: Record<string, string> = {
  anticon: "AntDesign",
  entypo: "Entypo",
  evilicons: "EvilIcons",
  feather: "Feather",
  FontAwesome: "FontAwesome",
  Fontisto: "Fontisto",
  foundation: "Foundation",
  ionicons: "Ionicons",
  "material-community": "MaterialCommunityIcons",
  material: "MaterialIcons",
  octicons: "Octicons",
  "simple-line-icons": "SimpleLineIcons",
  zocial: "Zocial",
  "FontAwesome5Free-Regular": "FontAwesome5_Regular",
  "FontAwesome5Free-Solid": "FontAwesome5_Solid",
  "FontAwesome5Free-Brand": "FontAwesome5_Brands",
  "FontAwesome6Free-Regular": "FontAwesome6_Regular",
  "FontAwesome6Free-Solid": "FontAwesome6_Solid",
  "FontAwesome6Free-Brand": "FontAwesome6_Brands",
};

const cdnUrl = (file: string): string =>
  `https://cdn.jsdelivr.net/npm/@expo/vector-icons@${ICON_VECTOR_VERSION}/build/vendor/react-native-vector-icons/Fonts/${file}.ttf`;

const iconFontMap = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ICON_FAMILIES).map(([key, file]) => [key, cdnUrl(file)]),
  );

// Bundled brand fonts (local .ttf). The same variable TTF backs each weight name.
const playfair = require("../../assets/fonts/PlayfairDisplay-Variable.ttf");
const dancing = require("../../assets/fonts/DancingScript-Variable.ttf");

const brandFontMap = (): Record<string, any> => ({
  PlayfairDisplay_400Regular: playfair,
  PlayfairDisplay_500Medium: playfair,
  PlayfairDisplay_600SemiBold: playfair,
  PlayfairDisplay_700Bold: playfair,
  CormorantGaramond: playfair,
  DancingScript_500Medium: dancing,
  DancingScript_600SemiBold: dancing,
  DancingScript_700Bold: dancing,
});

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    ...(Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? iconFontMap()
      : {}),
    ...brandFontMap(),
  });
