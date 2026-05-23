import { Tabs } from "expo-router";
import { Image, View } from "react-native";
import { COLORS } from "@/src/lib/theme";

const TAB_ICON: Record<string, any> = {
  character: require("../../assets/images/nav/status.png"),
  world: require("../../assets/images/nav/world.png"),
  phone: require("../../assets/images/nav/phone.png"),
  inventory: require("../../assets/images/nav/bag.png"),
  realm: require("../../assets/images/nav/realm.png"),
};

function TabIcon({ route, focused }: { route: string; focused: boolean; color: string; size: number }) {
  const iconSize = focused ? 36 : 31;
  return (
    <View
      style={{
        width: 58,
        height: 46,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? "rgba(12, 35, 52, 0.92)" : "rgba(13,17,28,0.78)",
        borderWidth: focused ? 1 : 1,
        borderColor: focused ? "rgba(34,211,238,0.72)" : "rgba(255,255,255,0.10)",
        shadowColor: focused ? COLORS.cyan : "transparent",
        shadowOpacity: focused ? 0.18 : 0,
        shadowRadius: 8,
        marginBottom: 0,
      }}
    >
      <Image
        source={TAB_ICON[route]}
        style={{ width: iconSize, height: iconSize, resizeMode: "contain", opacity: focused ? 1 : 0.74 }}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(5,8,16,0.98)",
          borderTopColor: "rgba(56,189,248,0.16)",
          height: 112,
          paddingTop: 10,
          paddingBottom: 20,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarActiveTintColor: COLORS.cyan,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 13,
          fontWeight: "900",
          letterSpacing: 0.9,
          textTransform: "uppercase",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="character" options={{ title: "Status", tabBarIcon: ({ color, size, focused }) => <TabIcon route="character" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="world" options={{ title: "World", tabBarIcon: ({ color, size, focused }) => <TabIcon route="world" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="phone" options={{ title: "Phone", tabBarIcon: ({ color, size, focused }) => <TabIcon route="phone" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="inventory" options={{ title: "Bag", tabBarIcon: ({ color, size, focused }) => <TabIcon route="inventory" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="realm" options={{ title: "Realm", tabBarIcon: ({ color, size, focused }) => <TabIcon route="realm" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="battle" options={{ href: null }} />
      <Tabs.Screen name="market" options={{ href: null }} />
    </Tabs>
  );
}
