import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Button, Field, Screen, Title } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { ApiError } from '../../src/api';
import { colors, font, size, space } from '../../src/theme';

export default function Register() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: '', phone: '', email: '', place: '', animals: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.name.trim()) return setError('Enter your name.');
    if (!f.phone.trim() && !f.email.trim()) return setError('Add a phone number or an email — one of the two is required.');
    if (f.password.length < 6) return setError('Use a password of at least 6 characters.');

    setBusy(true);
    setError('');
    try {
      await signUp({
        name: f.name.trim(),
        password: f.password,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        place: f.place.trim() || null,
        number_of_animals: f.animals ? Number(f.animals) : null,
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
        <View style={{ marginTop: 48, marginBottom: space.xl }}>
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
