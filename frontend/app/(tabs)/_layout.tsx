import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { View, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/lib/theme";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
      }}
    >
      <Tabs.Screen name="character" options={{
        title: "HERO",
        tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        tabBarButtonTestID: "tab-character",
      }} />
      <Tabs.Screen name="scan" options={{
        title: "SCAN",
        tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" color={color} size={size} />,
        tabBarButtonTestID: "tab-scan",
      }} />
      <Tabs.Screen name="battle" options={{
        title: "BATTLE",
        tabBarIcon: ({ color, size }) => <Ionicons name="flame-outline" color={color} size={size} />,
        tabBarButtonTestID: "tab-battle",
      }} />
      <Tabs.Screen name="inventory" options={{
        title: "BAG",
        tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />,
        tabBarButtonTestID: "tab-inventory",
      }} />
      <Tabs.Screen name="market" options={{
        title: "MARKET",
        tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" color={color} size={size} />,
        tabBarButtonTestID: "tab-market",
      }} />
    </Tabs>
  );
}
