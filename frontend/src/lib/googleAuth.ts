import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/lib/api";

const AUTH_BASE = "https://auth.emergentagent.com/";
const SESSION_DATA_URL =
  "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data";

/**
 * Trigger Emergent Google OAuth.
 * Returns { token, user } on success or null on cancel/fail.
 * The Web flow is asymmetric: on web we navigate away — the AuthProvider
 * will detect the session_id fragment on mount.
 */
export async function signInWithGoogle(): Promise<{
  token: string;
  user: any;
} | null> {
  if (Platform.OS === "web") {
    const redirectUrl = window.location.origin + "/";
    const url = `${AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = url;
    return null; // page navigates; resolution happens on mount
  }

  const redirectUrl = Linking.createURL("auth");
  const url = `${AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
  if (result.type !== "success" || !result.url) return null;
  const sessionId = parseSessionId(result.url);
  if (!sessionId) return null;
  return await exchangeSessionId(sessionId);
}

export function parseSessionId(rawUrl: string): string | null {
  try {
    // hash fragment first
    const hashIdx = rawUrl.indexOf("#");
    if (hashIdx >= 0) {
      const frag = rawUrl.slice(hashIdx + 1);
      const m = /(?:^|&)session_id=([^&]+)/.exec(frag);
      if (m) return decodeURIComponent(m[1]);
    }
    const qIdx = rawUrl.indexOf("?");
    if (qIdx >= 0) {
      const q = rawUrl.slice(qIdx + 1);
      const m = /(?:^|&)session_id=([^&#]+)/.exec(q);
      if (m) return decodeURIComponent(m[1]);
    }
  } catch {}
  return null;
}

export async function exchangeSessionId(sessionId: string) {
  // Get session info from Emergent (also yields fresh session_token)
  try {
    const res = await fetch(SESSION_DATA_URL, {
      headers: { "X-Session-ID": sessionId },
    });
    if (!res.ok) return null;
    // Then hand off to our backend to mint our app JWT
    const r = await api.googleSession(sessionId);
    await storage.secureSet("bq_token", r.token);
    return r;
  } catch {
    return null;
  }
}
