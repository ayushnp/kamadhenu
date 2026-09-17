import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, font, size } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface VideoSplashProps {
  onDone: () => void;
}

/**
 * Premium video splash intro component using `cowvid.mp4`.
 * Features subtle branding overlays, graceful entry/exit animations,
 * vignette gradients, and skip capabilities.
 */
export default function VideoSplash({ onDone }: VideoSplashProps) {
  const videoRef = useRef<Video>(null);
  const isFinishedRef = useRef(false);

  // Animations
  const splashOpacity = useSharedValue(1);
  const splashScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(20);
  const skipPulse = useSharedValue(0.7);

  const finish = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    // Smooth outward scale & fade transition on exit
    splashOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
    splashScale.value = withTiming(1.05, { duration: 600, easing: Easing.out(Easing.quad) });

    setTimeout(onDone, 620);
  }, [onDone, splashOpacity, splashScale]);

  useEffect(() => {
    // Fade in text title card shortly after start
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 700 }));
    contentTranslateY.value = withDelay(400, withTiming(0, { duration: 700, easing: Easing.out(Easing.back(1.2)) }));

    // Pulse skip indicator
    skipPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.6, { duration: 1000 })
      ),
      -1,
      true
    );

    // Fallback safety timeout (12s max duration)
    const fallbackTimer = setTimeout(() => {
      finish();
    }, 12000);

    return () => clearTimeout(fallbackTimer);
  }, [contentOpacity, contentTranslateY, skipPulse, finish]);

  const handlePlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        finish();
      }
    },
    [finish]
  );

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
    transform: [{ scale: splashScale.value }],
  }));

  const brandAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const skipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skipPulse.value,
  }));

  return (
    <Animated.View style={[styles.root, containerAnimatedStyle]}>
      <Pressable style={styles.touchContainer} onPress={finish}>
        {/* Fullscreen Video Background */}
        <Video
          ref={videoRef}
          source={require('../../assets/cowvid.mp4')}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          isMuted={false}
          onPlaybackStatusUpdate={handlePlaybackStatus}
        />

        {/* Top Vignette Shadow Overlay */}
        <View style={styles.topVignette} />

        {/* Header Branding Overlay */}
        <Animated.View style={[styles.brandHeader, brandAnimatedStyle]}>
          <View style={styles.pillBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.pillText}>KAMADHENU BOVINE AI</Text>
          </View>
        </Animated.View>

        {/* Bottom Vignette Gradient */}
        <View style={styles.bottomVignette} />

        {/* Bottom Content & Skip Prompt */}
        <Animated.View style={[styles.bottomContainer, brandAnimatedStyle]}>
          <Text style={styles.appName}>Kamadhenu</Text>
          <Text style={styles.tagline}>Smart Early Forecasting for Dairy Health</Text>

          <Animated.View style={[styles.skipPill, skipAnimatedStyle]}>
            <Text style={styles.skipText}>Tap anywhere to skip</Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D140E',
  },
  touchContainer: {
    flex: 1,
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(13, 20, 14, 0.45)',
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
    backgroundColor: 'rgba(13, 20, 14, 0.65)',
  },
  brandHeader: {
    marginTop: 60,
    alignItems: 'center',
    zIndex: 10,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ECA84',
    marginRight: 8,
  },
  pillText: {
    color: '#FFFFFF',
    fontFamily: font.bodySemi,
    fontSize: size.xs,
    letterSpacing: 1.2,
  },
  bottomContainer: {
    alignItems: 'center',
    marginBottom: 50,
    zIndex: 10,
    paddingHorizontal: 24,
  },
  appName: {
    fontFamily: font.display,
    fontSize: 42,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontFamily: font.bodyMid,
    fontSize: size.base,
    color: '#D8E2DA',
    marginTop: 4,
    textAlign: 'center',
  },
  skipPill: {
    marginTop: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipText: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.5,
  },
});
