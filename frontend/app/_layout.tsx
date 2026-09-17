import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import VideoSplash from '../src/components/VideoSplash';
import { TransitionOverlay } from '../src/components/CowLoader';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';

/** Sends people to the right half of the app once we know who they are. */
function Gate({ splashActive }: { splashActive?: boolean }) {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const isFirstMount = useRef(true);
  const [transitioning, setTransitioning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, ready, segments]);

  // Show the cow transition only on in-app route changes (not during splash or initial launch)
  useEffect(() => {
    if (splashActive || isFirstMount.current) {
      isFirstMount.current = false;
      prevPath.current = pathname;
      return;
    }

    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setTransitioning(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTransitioning(false), 450);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, splashActive]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="cow/[id]" options={{ presentation: 'card' }} />
      </Stack>
      <TransitionOverlay visible={!splashActive && transitioning} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Baloo2_600SemiBold, Baloo2_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });
  const [introDone, setIntroDone] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      {/* Background: Auth & Navigation preload immediately while video plays */}
      <AuthProvider>
        {fontsLoaded ? <Gate splashActive={!introDone} /> : null}
      </AuthProvider>

      {/* Foreground: Video splash screen plays on top with highest z-index */}
      {!introDone && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 99999, elevation: 99999 }]}>
          <VideoSplash onDone={() => setIntroDone(true)} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
