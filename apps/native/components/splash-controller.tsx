"use client";

import { SplashScreen } from "expo-router";
import { useSession } from "@/contexts/auth";

SplashScreen.preventAutoHideAsync();

export function SplashScreenController() {
  const { isLoading } = useSession();

  if (!isLoading) {
    SplashScreen.hide();
  }

  return null;
}
