import {Stack} from "expo-router";
import {useThemeColor} from "heroui-native";

export default function OnboardingLayout() {
  const primaryColor = useThemeColor('background');
  const primaryForegroundColor = useThemeColor('foreground');
  return (
    <Stack screenOptions={{
      headerShown: true, headerTitleStyle: {
        fontSize: 24,
      },
      headerStyle: {
        backgroundColor: primaryColor,
      },
      headerTintColor: primaryForegroundColor,
      headerTitleAlign: "center",
      contentStyle: {
        backgroundColor: primaryColor,
      },
      headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Screen name="interests" options={{
        headerTitle: "Select interests",
      }} />
      <Stack.Screen
        name="auth"
        options={{
          headerTitle: "Sign in",
        }}
      />
    </Stack>
  );
}
