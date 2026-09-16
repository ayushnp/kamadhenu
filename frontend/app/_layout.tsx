import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CowSplash from '../src/components/CowSplash';
import { TransitionOverlay } from '../src/components/CowLoader';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';

/** Sends people to the right half of the app once we know who they are. */
function Gate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [transitioning, setTransitioning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, ready, segments]);

  // Show the cow transition whenever the route changes
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setTransitioning(true);
      // Clear any existing timer
      if (timer.current) clearTimeout(timer.current);
      // Hide after a short moment so the animation is visible
      timer.current = setTimeout(() => setTransitioning(false), 850);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="cow/[id]" options={{ presentation: 'card' }} />
      </Stack>
      <TransitionOverlay visible={transitioning} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Baloo2_600SemiBold, Baloo2_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });
  const [introDone, setIntroDone] = useState(false);

  if (!fontsLoaded) return null;
  if (!introDone) return <CowSplash onDone={() => setIntroDone(true)} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
