import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/lib/api";
import { COLORS, AVATAR_PRESETS, resolveAvatar } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  currentAvatar?: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function AvatarPickerModal({
  visible,
  currentAvatar,
  onClose,
  onSaved,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>(currentAvatar ?? "preset:1");

  const save = async (val?: string) => {
    const v = val ?? selected;
    try {
      setBusy(true);
      await api.updateAvatar(v);
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert("Failed", e.message ?? "Could not save avatar");
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access in Settings to upload your own avatar.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      let dataUri: string;
      if (asset.base64) {
        const mime = asset.mimeType ?? "image/jpeg";
        dataUri = `data:${mime};base64,${asset.base64}`;
      } else if (Platform.OS === "web" && asset.uri.startsWith("data:")) {
        dataUri = asset.uri;
      } else {
        // Fallback: fetch URI and convert
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      if (dataUri.length > 1_500_000) {
        Alert.alert(
          "Image too large",
          "Please pick a smaller image (under ~1MB after compression).",
        );
        return;
      }
      setSelected(dataUri);
      await save(dataUri);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message ?? "Try again");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="avatar-picker">
          <View style={styles.header}>
            <Text style={styles.title}>CHOOSE AVATAR</Text>
            <TouchableOpacity onPress={onClose} testID="avatar-close">
              <Ionicons name="close" color={COLORS.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewWrap}>
            <Image source={{ uri: resolveAvatar(selected) }} style={styles.preview} />
          </View>

          <Text style={styles.sectionLabel}>FANTASY PRESETS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 4 }}
            style={{ flexGrow: 0 }}
          >
            {AVATAR_PRESETS.map((p) => {
              const isSel = selected === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  testID={`avatar-${p.key}`}
                  onPress={() => setSelected(p.key)}
                  style={[
                    styles.thumbWrap,
                    isSel && { borderColor: COLORS.accent, borderWidth: 3 },
                  ]}
                >
                  <Image source={{ uri: p.url }} style={styles.thumb} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              testID="avatar-upload"
              style={[styles.btn, styles.btnSecondary]}
              onPress={pickFromLibrary}
              disabled={busy}
            >
              <Ionicons name="cloud-upload-outline" color={COLORS.textPrimary} size={18} />
              <Text style={styles.btnSecondaryText}>UPLOAD CUSTOM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="avatar-save"
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => save()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>SAVE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "900", letterSpacing: 3 },
  previewWrap: { alignItems: "center", marginBottom: 16 },
  preview: {
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: COLORS.accent,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.borderStrong },
  btnPrimaryText: { color: "#fff", fontWeight: "800", letterSpacing: 2 },
  btnSecondaryText: { color: COLORS.textPrimary, fontWeight: "800", letterSpacing: 2, fontSize: 12 },
});
