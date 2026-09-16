import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
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

/**
 * A cow-head loading spinner.
 * The cow head continuously rocks side-to-side (like chewing cud)
 * while the whole thing gently bobs up and down. A pulsing label sits below.
 *
 * Drop-in replacement for <ActivityIndicator> anywhere in the app,
 * and used as the navigation-transition overlay via <TransitionOverlay>.
 */
export default function CowLoader({ label = 'Loading…' }: { label?: string }) {
  // --- rocking rotation ---
  const rock = useSharedValue(0);
  // --- vertical bob ---
  const bob = useSharedValue(0);
  // --- label pulse ---
  const pulse = useSharedValue(0.45);
  // --- tail swish ---
  const tail = useSharedValue(0);

  useEffect(() => {
    // rock: -12° → 12° → -12° …
    rock.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(12, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    // bob: gentle up/down
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(6, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    // tail swish
    tail.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    // text opacity pulse
    pulse.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(1, { duration: 800 })),
        withTiming(0.45, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);

  const cowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { rotate: `${rock.value}deg` },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.cowWrap, cowStyle]}>
        <Svg width={90} height={90} viewBox="0 0 120 120">
          {/* shadow on the ground */}
          <Ellipse cx="60" cy="112" rx="32" ry="6" fill={colors.ink} opacity={0.08} />

          {/* body glimpse */}
          <Ellipse cx="60" cy="78" rx="34" ry="22" fill={colors.milk} />
          {/* black spot on body */}
          <Path
            d="M44 68 q14 -6 20 4 q4 8 -6 13 q-12 5 -16 -3 q-4 -8 2 -14 Z"
            fill="#232323"
          />
          <Ellipse cx="74" cy="82" rx="8" ry="6" fill="#232323" opacity={0.85} />

          {/* near legs (just stubs) */}
          <Rect x="42" y="92" width="10" height="16" rx="5" fill={colors.milk} />
          <Rect x="42" y="102" width="10" height="8" rx="4" fill="#2A2A2A" />
          <Rect x="68" y="92" width="10" height="16" rx="5" fill={colors.milk} />
          <Rect x="68" y="102" width="10" height="8" rx="4" fill="#2A2A2A" />

          {/* tail */}
          <Path
            d="M28 68 q-8 16 -2 32"
            stroke="#EFEBDF"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx="27" cy="102" rx="5" ry="8" fill="#232323" />

          {/* neck */}
          <Path d="M68 74 L78 52 q4 -8 14 -5 l8 3 l-4 26 z" fill={colors.milk} />

          {/* head */}
          <Ellipse cx="90" cy="50" rx="22" ry="18" fill={colors.milk} />
          {/* head spot */}
          <Path
            d="M78 40 q12 -5 18 3 q3 6 -5 10 q-9 3 -14 -3 q-3 -6 1 -10 Z"
            fill="#232323"
          />
          {/* muzzle */}
          <Ellipse cx="106" cy="56" rx="12" ry="9" fill="#F2CFC6" />
          {/* nostrils */}
          <Circle cx="102" cy="54" r="1.8" fill="#B98E80" />
          <Circle cx="108" cy="56" r="1.8" fill="#B98E80" />
          {/* eye */}
          <Circle cx="92" cy="48" r="2.8" fill={colors.ink} />
          {/* white of the eye highlight */}
          <Circle cx="91" cy="47" r="0.9" fill="#FFF" />

          {/* horns */}
          <Path
            d="M82 34 q-2 -10 -10 -12 M98 34 q2 -10 10 -11"
            stroke="#C9A24A"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          {/* ears */}
          <Ellipse
            cx="76"
            cy="40"
            rx="5"
            ry="9"
            fill="#F2CFC6"
            transform="rotate(-20 76 40)"
          />
          <Ellipse
            cx="104"
            cy="38"
            rx="5"
            ry="9"
            fill="#F2CFC6"
            transform="rotate(20 104 38)"
          />
        </Svg>
      </Animated.View>

      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
    </View>
  );
}

/**
 * Full-screen overlay version used during route transitions.
 * Covers the whole screen with a semi-transparent surface background.
 */
export function TransitionOverlay({ visible, label }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <CowLoader label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  cowWrap: {
    width: 90,
    height: 90,
  },
  label: {
    marginTop: 12,
    fontFamily: font.bodyMid,
    fontSize: size.sm,
    color: colors.bark,
    letterSpacing: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface + 'EE', // slightly transparent
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
