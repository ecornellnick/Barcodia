import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Link } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS, IMAGES } from "@/src/lib/theme";
import { signInWithGoogle } from "@/src/lib/googleAuth";

export default function Register() {
  const { register, setAuthFromGoogle } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async () => {
    if (!username || !email || !password) {
      Alert.alert("Missing", "Fill in all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters");
      return;
    }
    try {
      setBusy(true);
      await register(email.trim(), password, username.trim());
      router.replace("/character");
    } catch (e: any) {
      Alert.alert("Registration failed", e.message ?? "Try again");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setGoogleBusy(true);
      const r = await signInWithGoogle();
      if (r) {
        await setAuthFromGoogle(r.token, r.user);
        router.replace("/character");
      }
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e.message ?? "Try again");
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <ImageBackground source={{ uri: IMAGES.bgMystical }} style={styles.bg} resizeMode="cover">
      <LinearGradient
        colors={["rgba(10,12,16,0.4)", "rgba(10,12,16,0.95)"]}
        style={styles.overlay}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>FORGE YOUR</Text>
          <Text style={styles.subtitle}>HERO</Text>

          <View style={styles.card}>
            <TouchableOpacity
              testID="register-google"
              style={styles.googleBtn}
              onPress={handleGoogle}
              disabled={googleBusy || busy}
            >
              {googleBusy ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#000" />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>HERO NAME</Text>
            <TextInput
              testID="register-username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Aragon"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              maxLength={20}
            />
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="register-email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="hero@realm.com"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              testID="register-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="6+ characters"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <TouchableOpacity
              testID="register-submit"
              style={styles.button}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>BEGIN QUEST</Text>
              )}
            </TouchableOpacity>
            <Link href="/login" asChild>
              <TouchableOpacity testID="goto-login" style={styles.linkBtn}>
                <Text style={styles.linkText}>
                  Already a hero?  <Text style={styles.linkAccent}>Sign in →</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  overlay: { ...StyleSheet.absoluteFillObject },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: 3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 44,
    fontWeight: "900",
    color: COLORS.accent,
    letterSpacing: 10,
    textAlign: "center",
    marginBottom: 24,
    textShadowColor: "rgba(255,215,0,0.4)",
    textShadowRadius: 20,
  },
  card: {
    backgroundColor: "rgba(26,29,36,0.85)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
  },
  googleText: { color: "#000", fontWeight: "700", letterSpacing: 0.5, fontSize: 15 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  label: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: COLORS.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#fff", fontWeight: "800", letterSpacing: 3, fontSize: 14 },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: COLORS.textSecondary, fontSize: 13 },
  linkAccent: { color: COLORS.secondary, fontWeight: "700" },
});
