import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/theme";

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(7,9,16,0.98)",
          borderTopColor: "rgba(255,255,255,0.10)",
          height: 86,
          paddingTop: 8,
          paddingBottom: 14,
        },
        tabBarActiveTintColor: COLORS.cyan,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "900",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen name="character" options={{ title: "Hero", tabBarIcon: ({ color, size }) => <TabIcon name="person-circle-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: ({ color, size }) => <TabIcon name="scan-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="battle" options={{ title: "Battle", tabBarIcon: ({ color, size }) => <TabIcon name="flame-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="inventory" options={{ title: "Bag", tabBarIcon: ({ color, size }) => <TabIcon name="cube-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="market" options={{ title: "Store", tabBarIcon: ({ color, size }) => <TabIcon name="storefront-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
