import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, font, size } from '../theme';

const AG = Animated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * Opening sequence: the calf walks in from the left, tucks its head under the
 * mother's udder and suckles; she lowers her head to lick it; the name settles in.
 * One orchestrated moment, then the app takes over.
 */
export default function CowSplash({ onDone }: { onDone: () => void }) {
  const [reduced, setReduced] = useState(false);

  const scene = useSharedValue(0);      // whole-scene fade
  const momY = useSharedValue(14);      // mother settles onto the ground
  const calfX = useSharedValue(-170);   // calf walks in
  const calfBob = useSharedValue(0);    // walking bounce
  const calfHead = useSharedValue(26);  // 26° = nose down (walking), 0° = at the udder
  const sip = useSharedValue(0);        // suckling pulse
  const tail = useSharedValue(0);       // tail swish
  const momHead = useSharedValue(0);    // mother lowers her head to lick
  const drop = useSharedValue(0);       // milk droplet
  const title = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (cancelled) return;
      setReduced(on);

      if (on) {
        scene.value = 1; momY.value = 0; calfX.value = 0;
        calfHead.value = 0; title.value = 1;
        setTimeout(onDone, 1100);
        return;
      }

      scene.value = withTiming(1, { duration: 420 });
      momY.value = withSpring(0, { damping: 13, stiffness: 90 });

      calfX.value = withDelay(430, withTiming(0, { duration: 1150, easing: Easing.out(Easing.quad) }));
      calfBob.value = withDelay(430, withSequence(
        withRepeat(withTiming(-5, { duration: 185, easing: Easing.inOut(Easing.quad) }), 6, true),
        withTiming(0, { duration: 150 }),
      ));

      calfHead.value = withDelay(1560, withSpring(0, { damping: 12, stiffness: 110 }));

      sip.value = withDelay(1950, withRepeat(
        withTiming(1, { duration: 330, easing: Easing.inOut(Easing.sin) }), -1, true));
      drop.value = withDelay(2150, withRepeat(
        withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }), -1, false));
      tail.value = withDelay(1700, withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
      momHead.value = withDelay(2150, withSpring(1, { damping: 15, stiffness: 70 }));
      title.value = withDelay(2650, withTiming(1, { duration: 650 }));

      setTimeout(() => { if (!cancelled) onDone(); }, 4300);
    });
    return () => { cancelled = true; };
  }, []);

  const sceneStyle = useAnimatedStyle(() => ({ opacity: scene.value }));

  const momProps = useAnimatedProps(() => ({ y: momY.value }));
  const calfProps = useAnimatedProps(() => ({ x: calfX.value, y: calfBob.value }));
  const calfHeadProps = useAnimatedProps(() => ({
    rotation: calfHead.value,
    // a small forward nudge on each sip
    x: sip.value * 1.6,
    y: sip.value * -1.4,
  }));
  const tailProps = useAnimatedProps(() => ({ rotation: -9 + tail.value * 18 }));
  const momHeadProps = useAnimatedProps(() => ({ rotation: momHead.value * 13 }));
  const dropProps = useAnimatedProps(() => ({
    cy: 170 + drop.value * 20,
    opacity: drop.value < 0.15 ? drop.value / 0.15 : 1 - drop.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 14 }],
  }));

  return (
    <Pressable style={styles.root} onPress={onDone} accessibilityRole="button" accessibilityLabel="Skip intro">
      <Animated.View style={sceneStyle}>
        <Svg width="100%" height={260} viewBox="0 0 340 230">
          <Defs>
            <LinearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.dusk} stopOpacity="0.55" />
              <Stop offset="1" stopColor={colors.sky} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* Morning sky and the field line */}
          <Circle cx="60" cy="52" r="150" fill="url(#dawn)" opacity={0.5} />
          <Circle cx="272" cy="44" r="21" fill={colors.marigold} opacity={0.35} />
          <Path d="M0 198 H340" stroke={colors.pasture} strokeOpacity={0.25} strokeWidth={2} />
          <Rect x="0" y="198" width="340" height="32" fill={colors.pastureSoft} />
          <Path d="M22 198 q5 -13 10 0 M300 198 q6 -16 12 0 M318 198 q4 -10 8 0"
            stroke={colors.pasture} strokeOpacity={0.35} strokeWidth={2} fill="none" />

          {/* ── Mother ─────────────────────────────────────────────── */}
          <AG animatedProps={momProps}>
            <Ellipse cx="152" cy="201" rx="94" ry="7" fill={colors.ink} opacity={0.08} />

            {/* far legs */}
            <Rect x="88" y="140" width="13" height="58" rx="6" fill="#DED6C6" />
            <Rect x="192" y="140" width="13" height="58" rx="6" fill="#DED6C6" />

            {/* tail */}
            <AG animatedProps={tailProps} origin="80, 92">
              <Path d="M80 92 q-13 32 -5 62" stroke="#435144" strokeWidth={5} fill="none" strokeLinecap="round" />
              <Ellipse cx="76" cy="158" rx="6" ry="9" fill="#435144" />
            </AG>

            {/* body */}
            <Ellipse cx="150" cy="112" rx="75" ry="45" fill={colors.milk} />
            <Ellipse cx="118" cy="96" rx="24" ry="17" fill="#3F5245" />
            <Ellipse cx="176" cy="126" rx="19" ry="13" fill="#3F5245" />
            <Ellipse cx="92" cy="132" rx="11" ry="8" fill="#3F5245" opacity={0.85} />

            {/* udder */}
            <Ellipse cx="127" cy="151" rx="22" ry="14" fill="#F2D2CA" />
            <Rect x="118" y="160" width="6" height="11" rx="3" fill="#E5BBB1" />
            <Rect x="131" y="160" width="6" height="11" rx="3" fill="#E5BBB1" />

            {/* near legs */}
            <Rect x="104" y="138" width="15" height="60" rx="7" fill={colors.milk} />
            <Rect x="104" y="186" width="15" height="12" rx="5" fill="#3F5245" />
            <Rect x="206" y="138" width="15" height="60" rx="7" fill={colors.milk} />
            <Rect x="206" y="186" width="15" height="12" rx="5" fill="#3F5245" />

            {/* head + neck, pivoting at the shoulder */}
            <AG animatedProps={momHeadProps} origin="209, 90">
              <Path d="M200 96 L214 66 q6 -12 20 -8 l12 4 l-6 38 z" fill={colors.milk} />
              <Ellipse cx="246" cy="66" rx="27" ry="21" fill={colors.milk} />
              <Ellipse cx="238" cy="58" rx="13" ry="10" fill="#3F5245" />
              <Ellipse cx="268" cy="78" rx="15" ry="12" fill="#F2D2CA" />
              <Circle cx="264" cy="76" r="2.2" fill="#B99287" />
              <Circle cx="273" cy="80" r="2.2" fill="#B99287" />
              <Circle cx="252" cy="68" r="3.4" fill={colors.ink} />
              <Ellipse cx="228" cy="72" rx="9" ry="6" fill="#DED6C6" />
              <Path d="M236 46 q-2 -12 -12 -14 M256 46 q3 -12 13 -13"
                stroke="#C9A24A" strokeWidth={5} strokeLinecap="round" fill="none" />
            </AG>
          </AG>

          {/* ── Calf ───────────────────────────────────────────────── */}
          <AG animatedProps={calfProps}>
            <Ellipse cx="88" cy="199" rx="42" ry="5" fill={colors.ink} opacity={0.09} />

            <Rect x="66" y="180" width="9" height="18" rx="4" fill="#DED6C6" />
            <Rect x="98" y="180" width="9" height="18" rx="4" fill="#DED6C6" />

            <Ellipse cx="86" cy="169" rx="32" ry="20" fill={colors.milk} />
            <Ellipse cx="74" cy="163" rx="12" ry="9" fill="#3F5245" />
            <Path d="M56 156 q-10 14 -3 26" stroke="#435144" strokeWidth={3.5} fill="none" strokeLinecap="round" />

            <Rect x="76" y="182" width="10" height="16" rx="5" fill={colors.milk} />
            <Rect x="76" y="192" width="10" height="6" rx="3" fill="#3F5245" />
            <Rect x="106" y="182" width="10" height="16" rx="5" fill={colors.milk} />
            <Rect x="106" y="192" width="10" height="6" rx="3" fill="#3F5245" />

            {/* head: rotates up from the walking pose into the udder */}
            <AG animatedProps={calfHeadProps} origin="104, 172">
              <Path d="M100 178 L110 158 q4 -8 12 -5 l8 4 l-4 24 z" fill={colors.milk} />
              <Ellipse cx="121" cy="161" rx="15" ry="13" fill={colors.milk} />
              <Ellipse cx="112" cy="155" rx="7" ry="6" fill="#3F5245" />
              <Ellipse cx="132" cy="154" rx="9" ry="7" fill="#F2D2CA" />
              <Circle cx="125" cy="160" r="2.6" fill={colors.ink} />
              <Ellipse cx="110" cy="166" rx="6" ry="4" fill="#DED6C6" />
            </AG>
          </AG>

          {/* a drop of milk at the teat */}
          <ACircle animatedProps={dropProps} cx="134" r="3.2" fill={colors.milk} />
          <Circle cx="142" cy="150" r="2" fill={colors.milk} opacity={0.8} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.title, titleStyle]}>
        <Text style={styles.wordmark}>Kamadhenu</Text>
        <Text style={styles.tagline}>Catch mastitis before the milk does</Text>
      </Animated.View>

      {!reduced && <Text style={styles.skip}>Tap to skip</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { alignItems: 'center', marginTop: 28 },
  wordmark: { fontFamily: font.display, fontSize: 40, color: colors.ink, letterSpacing: 0.3 },
  tagline: { fontFamily: font.body, fontSize: size.base, color: colors.bark, marginTop: 2 },
  skip: { position: 'absolute', bottom: 34, fontFamily: font.body, fontSize: size.sm, color: colors.muted },
});
