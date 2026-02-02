import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function TabLayout() {
  const backgroundColor = useThemeColor("background");
  const foregroundColor = useThemeColor("foreground");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor,
          borderTopColor: useThemeColor("border"),
        },
        tabBarActiveTintColor: useThemeColor("accent"),
        tabBarInactiveTintColor: foregroundColor,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
