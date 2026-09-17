import React, { useCallback, useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface VideoSplashProps {
  onDone: () => void;
}

/**
 * Pure fullscreen video splash screen for `kamadhenu-4.mp4`.
 * No overlays, badges, vignettes, or text layers.
 */
export default function VideoSplash({ onDone }: VideoSplashProps) {
  const videoRef = useRef<Video>(null);
  const isFinishedRef = useRef(false);

  const splashOpacity = useSharedValue(1);

  const finish = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    // Safety fallback timeout in case video event doesn't fire
    const fallbackTimer = setTimeout(() => {
      finish();
    }, 12000);

    return () => clearTimeout(fallbackTimer);
  }, [finish]);

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
  }));

  return (
    <Animated.View style={[styles.root, containerAnimatedStyle]}>
      <Pressable style={styles.touchContainer} onPress={finish}>
        <Video
          ref={videoRef}
          source={require('../../assets/kamadhenu-4.mp4')}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          isMuted={false}
          onPlaybackStatusUpdate={handlePlaybackStatus}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  touchContainer: {
    flex: 1,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_W,
    height: SCREEN_H,
  },
});
