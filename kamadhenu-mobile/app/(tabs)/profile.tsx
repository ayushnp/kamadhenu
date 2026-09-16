import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Field, Screen, Title } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { users as usersApi, ApiError, API_URL } from '../../src/api';
import { colors, font, size, space } from '../../src/theme';

export default function Profile() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    place: user?.place ?? '',
    animals: user?.number_of_animals != null ? String(user.number_of_animals) : '',
  });

  if (!user) return null;
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true);
    setError('');
    try {
      await usersApi.updateMe({
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        place: f.place.trim() || null,
        number_of_animals: f.animals ? Number(f.animals) : null,
      } as any);
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your changes.');
    } finally {
      setBusy(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <View style={{ marginTop: 48, marginBottom: space.xl }}>
        <Caption>Your account</Caption>
        <Title>{user.name}</Title>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Badge label={roleName(user.role)} tone="good" />
          {!user.is_active && <Badge label="Deactivated" tone="risk" />}
        </View>
      </View>

      <Banner message={error} />

      {editing ? (
        <Card>
          <Field label="Name" value={f.name} onChangeText={set('name')} />
          <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label="Village or town" value={f.place} onChangeText={set('place')} />
          {user.role === 'farmer' && (
            <Field label="How many animals" value={f.animals} onChangeText={set('animals')} keyboardType="number-pad" />
          )}
          <Button label="Save changes" onPress={save} loading={busy} />
          <Button label="Cancel" onPress={() => setEditing(false)} variant="ghost" />
        </Card>
      ) : (
        <Card>
          <Line label="Phone" value={user.phone ?? '—'} />
          <Line label="Email" value={user.email ?? '—'} />
          {user.role === 'farmer' ? (
            <>
              <Line label="Village or town" value={user.place ?? '—'} />
              <Line label="Animals declared" value={user.number_of_animals != null ? String(user.number_of_animals) : '—'} />
            </>
          ) : (
            <>
              <Line label="Employee ID" value={user.employee_id ?? '—'} />
              <Line label="Department" value={user.department ?? '—'} />
              <Line label="Jurisdiction" value={user.jurisdiction ?? '—'} />
            </>
          )}
          <Button label="Edit details" onPress={() => setEditing(true)} variant="secondary" />
        </Card>
      )}

      {user.role === 'authority' && (
        <Pressable onPress={() => router.push('/staff')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="users" size={19} color={colors.pasture} style={{ marginRight: space.md }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>Staff accounts</Text>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted }}>
                Create and review inspector, vet and authority logins
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.muted} />
          </Card>
        </Pressable>
      )}

      <Button label="Sign out" onPress={confirmSignOut} variant="ghost" />
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, textAlign: 'center' }}>
        Connected to {API_URL}
      </Text>
    </Screen>
  );
}

const roleName = (r: string) =>
  ({ farmer: 'Farmer', inspector: 'Inspector', doctor: 'Veterinary officer', authority: 'Authority' } as any)[r] ?? r;

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.ink }}>{value}</Text>
    </View>
  );
}
