import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Banner, Button, Field, Screen, Title } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { ApiError } from '../../src/api';
import { colors, font, size, space } from '../../src/theme';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!identifier.trim() || !password) {
      setError('Enter your phone or email and your password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(identifier, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign in failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        {/* Back to role selection */}
        <Pressable
          onPress={() => router.replace('/(auth)/landing')}
          style={styles.backBtn}
          accessibilityLabel="Back to role selection"
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>All roles</Text>
        </Pressable>

        <View style={{ marginTop: 24, marginBottom: space.xl }}>
          <Text style={styles.roleTag}>🐄 Farmer portal</Text>
          <Title>Welcome back</Title>
          <Text style={{ fontFamily: font.body, fontSize: size.md, color: colors.bark, marginTop: 6 }}>
            Sign in with the phone number or email on your account.
          </Text>
        </View>

        <Banner message={error} />

        <Field
          label="Phone or email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          placeholder="9876543210"
          returnKeyType="next"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <Button label="Sign in" onPress={submit} loading={busy} />

        <Link href="/(auth)/register" asChild>
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.pasture, textAlign: 'center', marginTop: space.sm }}>
            New farmer? Create an account
          </Text>
        </Link>

        <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, textAlign: 'center', marginTop: space.xl, lineHeight: 18 }}>
          Inspector, veterinary and authority logins are issued by your district authority.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 52,
    alignSelf: 'flex-start',
    gap: 4,
  },
  backArrow: {
    fontSize: 22,
    color: colors.pasture,
    fontFamily: font.body,
    lineHeight: 24,
  },
  backLabel: {
    fontFamily: font.bodyMid,
    fontSize: size.base,
    color: colors.pasture,
  },
  roleTag: {
    fontFamily: font.bodyMid,
    fontSize: size.sm,
    color: colors.pasture,
    marginBottom: 6,
  },
});
