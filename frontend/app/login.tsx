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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Link } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS, IMAGES } from "@/src/lib/theme";
import { signInWithGoogle } from "@/src/lib/googleAuth";

export default function Login() {
  const { login, setAuthFromGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Missing", "Enter email and password");
      return;
    }
    try {
      setBusy(true);
      await login(email.trim(), password);
      router.replace("/character");
    } catch (e: any) {
      Alert.alert("Login failed", e.message ?? "Try again");
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
      // on web: navigation has already happened; AuthProvider handles it on return
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
        style={styles.kav}
      >
        <View style={styles.content}>
          <Text style={styles.title} testID="login-title">BARCODIA</Text>
          <Text style={styles.tagline}>Scan reality. Forge legend.</Text>

          <View style={styles.card}>
            <TouchableOpacity
              testID="login-google"
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

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email"
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
              testID="login-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <TouchableOpacity
              testID="login-submit"
              style={styles.button}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>ENTER REALM</Text>
              )}
            </TouchableOpacity>
            <Link href="/register" asChild>
              <TouchableOpacity testID="goto-register" style={styles.linkBtn}>
                <Text style={styles.linkText}>
                  New adventurer?  <Text style={styles.linkAccent}>Create account →</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  overlay: { ...StyleSheet.absoluteFillObject },
  kav: { flex: 1 },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  title: {
    fontSize: 52,
    fontWeight: "900",
    color: COLORS.accent,
    letterSpacing: 8,
    textAlign: "center",
    textShadowColor: "rgba(255,215,0,0.4)",
    textShadowRadius: 20,
  },
  tagline: {
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontSize: 11,
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
