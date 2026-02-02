import "@/global.css";
import {Stack} from "expo-router";
import {HeroUINativeProvider, useThemeColor} from "heroui-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {KeyboardProvider} from "react-native-keyboard-controller";

import {AppThemeProvider} from "@/contexts/app-theme-context";
import {SessionProvider, useSession} from "@/contexts/auth";
import {SplashScreenController} from "@/components/splash-controller";
import QueryProvider from "@/contexts/query-provider";

export const unstable_settings = {
  initialRouteName: "(app)",
};

function RootNavigator() {
  const backgroundColor = useThemeColor("background");
  const {session} = useSession();
  const isAuthenticated = !!session;

  return (
    <Stack screenOptions={{
      headerShown: false, contentStyle: {
        backgroundColor: backgroundColor,
      }
    }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Screen name="modal" options={{title: "Modal", presentation: "modal"}} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <KeyboardProvider>
        <AppThemeProvider>
          <HeroUINativeProvider>
            <SessionProvider>
              <QueryProvider>
                <SplashScreenController />
                <RootNavigator />
              </QueryProvider>
            </SessionProvider>
          </HeroUINativeProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
