import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Field, Screen, Title } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { ApiError } from '../../src/api';
import { getAutoLocation, Coordinates } from '../../src/lib/location';
import { colors, font, radius, size, space } from '../../src/theme';

export default function Register() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: '', phone: '', email: '', place: '', animals: '', password: '' });
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const loc = await getAutoLocation();
        if (isMounted && loc) {
          setCoords(loc);
          if (loc.placeName) {
            setF((prev) => (prev.place ? prev : { ...prev, place: loc.placeName || '' }));
          }
        }
      } finally {
        if (isMounted) setLocating(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  async function submit() {
    if (!f.name.trim()) return setError('Enter your name.');
    if (!f.phone.trim() && !f.email.trim()) return setError('Add a phone number or an email — one of the two is required.');
    if (f.password.length < 6) return setError('Use a password of at least 6 characters.');

    setBusy(true);
    setError('');
    try {
      // If still locating, give a brief 1.5s window to capture coordinates
      let finalCoords = coords;
      if (!finalCoords && locating) {
        finalCoords = await getAutoLocation(1500);
      }

      await signUp({
        name: f.name.trim(),
        password: f.password,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        place: f.place.trim() || null,
        number_of_animals: f.animals ? Number(f.animals) : null,
        latitude: finalCoords?.latitude ?? null,
        longitude: finalCoords?.longitude ?? null,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/landing')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 40,
            marginBottom: space.sm,
            opacity: pressed ? 0.7 : 1,
            alignSelf: 'flex-start',
          })}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>
            Back
          </Text>
        </Pressable>

        <View style={{ marginTop: space.md, marginBottom: space.xl }}>
          <Title>Register your farm</Title>
          <Text style={{ fontFamily: font.body, fontSize: size.md, color: colors.bark, marginTop: 6 }}>
            Takes a minute. You can add your animals right after.
          </Text>
        </View>

        <Banner message={error} />

        <Field label="Your name" value={f.name} onChangeText={set('name')} placeholder="Lakshmi Devi" />
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="9876543210" />
        <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="optional" hint="Give a phone number or an email — either one works to sign in." />
        <Field label="Village or town" value={f.place} onChangeText={set('place')} placeholder="Hoskote, Karnataka" />
        <Field label="How many animals" value={f.animals} onChangeText={set('animals')} keyboardType="number-pad" placeholder="12" />
        <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry placeholder="At least 6 characters" />

        {/* Automatic Farm GPS Tagging */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: coords ? '#f0fdf4' : '#f8fafc',
            borderColor: coords ? '#bbf7d0' : colors.line,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: space.sm,
            paddingHorizontal: space.md,
            marginTop: space.xs,
            marginBottom: space.lg,
          }}
        >
          {locating ? (
            <>
              <ActivityIndicator size="small" color={colors.pasture} style={{ marginRight: 8 }} />
              <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted, flex: 1 }}>
                Detecting farm GPS coordinates automatically...
              </Text>
            </>
          ) : coords ? (
            <>
              <Feather name="map-pin" size={15} color={colors.pasture} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.pasture }}>
                  Farm GPS locked ({coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}°)
                </Text>
                <Text style={{ fontFamily: font.body, fontSize: 11, color: colors.muted, marginTop: 1 }}>
                  Coordinates automatically attached to your farm profile.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Feather name="map-pin" size={15} color={colors.muted} style={{ marginRight: 8 }} />
              <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, flex: 1 }}>
                GPS permission optional · Farm can also be located via village/town
              </Text>
            </>
          )}
        </View>

        <Button label="Create account" onPress={submit} loading={busy} />
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.pasture, textAlign: 'center' }}>
            I already have an account
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
