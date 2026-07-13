// Shared pinch-to-zoom / drag-to-pan crop tool used by every admin image
// upload flow (menu item photos, hero image, screen backgrounds, kiosk ad
// slides). Shown as a full-screen modal right after the user picks an image
// and before it's uploaded — the confirmed crop is rendered at full quality
// (no re-compression beyond the source format's own lossless/quality-1
// encoding) via expo-image-manipulator and handed back as a PickedFile-
// shaped object that drops straight into the existing upload plumbing.
import React, { useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, useWindowDimensions, ActivityIndicator, Alert, Image as RNImage } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";
import { theme } from "@/src/theme";
import { PickedFile, pickedFileFromUri } from "@/src/imagePicker";

export type CropSource = { uri: string; type: string; name: string };

type Props = {
  visible: boolean;
  source: CropSource | null;
  /** width / height of the target crop frame. */
  aspectRatio: number;
  lang?: "fr" | "en";
  onCancel: () => void;
  onConfirm: (file: PickedFile) => void;
};

const MAX_SCALE = 4;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 96;
const FRAME_MARGIN = theme.space.xl;

export function ImageCropEditor({ visible, source, aspectRatio, lang = "fr", onCancel, onConfirm }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const availW = winW - FRAME_MARGIN * 2;
  const availH = winH - HEADER_HEIGHT - FOOTER_HEIGHT - FRAME_MARGIN * 2;
  let frameW = availW;
  let frameH = frameW / aspectRatio;
  if (frameH > availH) {
    frameH = availH;
    frameW = frameH * aspectRatio;
  }

  const baseScale = naturalSize ? Math.max(frameW / naturalSize.width, frameH / naturalSize.height) : 1;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Re-measure + reset the gesture state for each newly picked image.
  if (source && naturalSize === null) {
    RNImage.getSize(
      source.uri,
      (width, height) => setNaturalSize({ width, height }),
      () => setNaturalSize({ width: frameW, height: frameH }),
    );
  }

  const clampTranslate = (value: number, displayed: number, frame: number) => {
    "worklet";
    const max = Math.max(0, (displayed - frame) / 2);
    return Math.min(Math.max(value, -max), max);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      if (!naturalSize) return;
      const next = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
      scale.value = next;
      const eff = baseScale * next;
      translateX.value = clampTranslate(translateX.value, naturalSize.width * eff, frameW);
      translateY.value = clampTranslate(translateY.value, naturalSize.height * eff, frameH);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (!naturalSize) return;
      const eff = baseScale * scale.value;
      translateX.value = clampTranslate(savedTranslateX.value + e.translationX, naturalSize.width * eff, frameW);
      translateY.value = clampTranslate(savedTranslateY.value + e.translationY, naturalSize.height * eff, frameH);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    width: naturalSize ? naturalSize.width * baseScale : frameW,
    height: naturalSize ? naturalSize.height * baseScale : frameH,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const reset = () => {
    scale.value = 1; savedScale.value = 1;
    translateX.value = 0; savedTranslateX.value = 0;
    translateY.value = 0; savedTranslateY.value = 0;
  };

  const close = () => {
    setNaturalSize(null);
    reset();
    onCancel();
  };

  const confirm = async () => {
    if (!source || !naturalSize) return;
    setProcessing(true);
    try {
      const eff = baseScale * scale.value;
      const displayedW = naturalSize.width * eff;
      const displayedH = naturalSize.height * eff;
      const originXDisplayed = (displayedW - frameW) / 2 - translateX.value;
      const originYDisplayed = (displayedH - frameH) / 2 - translateY.value;
      const cropWidth = Math.min(Math.round(frameW / eff), naturalSize.width);
      const cropHeight = Math.min(Math.round(frameH / eff), naturalSize.height);
      const cropOriginX = Math.min(Math.max(Math.round(originXDisplayed / eff), 0), naturalSize.width - cropWidth);
      const cropOriginY = Math.min(Math.max(Math.round(originYDisplayed / eff), 0), naturalSize.height - cropHeight);

      const isPng = source.type.includes("png");
      const format = isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG;
      const result = await ImageManipulator.manipulateAsync(
        source.uri,
        [{ crop: { originX: cropOriginX, originY: cropOriginY, width: cropWidth, height: cropHeight } }],
        { compress: 1, format },
      );

      const ext = isPng ? "png" : "jpg";
      const outType = isPng ? "image/png" : "image/jpeg";
      const baseName = source.name.replace(/\.[a-zA-Z0-9]+$/, "");
      const file = await pickedFileFromUri(result.uri, `${baseName}-cropped.${ext}`, outType);

      setNaturalSize(null);
      reset();
      onConfirm(file);
    } catch {
      Alert.alert(
        lang === "fr" ? "Échec du recadrage" : "Crop failed",
        lang === "fr" ? "Réessayez avec une autre image." : "Try again with a different image.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable testID="crop-cancel" onPress={close} hitSlop={12} style={styles.headerBtn}>
            <Feather name="x" size={22} color={theme.color.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>{lang === "fr" ? "Ajuster l'image" : "Adjust image"}</Text>
          <Pressable testID="crop-reset" onPress={reset} hitSlop={12} style={styles.headerBtn}>
            <Feather name="refresh-ccw" size={18} color={theme.color.onSurfaceSecondary} />
          </Pressable>
        </View>

        <View style={styles.stage}>
          {source && naturalSize ? (
            <View style={[styles.frame, { width: frameW, height: frameH }]}>
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={imageAnimatedStyle}>
                  <RNImage source={{ uri: source.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </Animated.View>
              </GestureDetector>
            </View>
          ) : (
            <View style={[styles.frame, { width: frameW, height: frameH, alignItems: "center", justifyContent: "center" }]}>
              <ActivityIndicator color={theme.color.brand} />
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.hint}>
            {lang === "fr" ? "Pincez pour zoomer, glissez pour déplacer" : "Pinch to zoom, drag to reposition"}
          </Text>
          <Pressable
            testID="crop-confirm"
            disabled={!naturalSize || processing}
            onPress={confirm}
            style={[styles.confirmBtn, (!naturalSize || processing) && { opacity: 0.6 }]}
          >
            {processing ? <ActivityIndicator color={theme.color.onBrandPrimary} /> : (
              <Text style={styles.confirmTxt}>{lang === "fr" ? "Valider" : "Confirm"}</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "rgba(5,5,5,0.97)" },
  header: {
    height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.space.lg,
  },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.color.onSurface, fontSize: theme.size.lg, fontWeight: "600" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    overflow: "hidden", borderRadius: theme.radius.sm,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surfaceSecondary,
  },
  footer: { height: FOOTER_HEIGHT, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.lg, gap: theme.space.sm },
  hint: { color: theme.color.muted, fontSize: theme.size.sm },
  confirmBtn: {
    height: 48, minWidth: 160, borderRadius: theme.radius.md, backgroundColor: theme.color.brand,
    alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.xl,
  },
  confirmTxt: { color: theme.color.onBrandPrimary, fontSize: theme.size.base, fontWeight: "700" },
});
