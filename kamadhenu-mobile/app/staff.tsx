import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Empty, Field, Heading, Screen, Segmented, Title } from '../src/components/ui';
import { users as usersApi, ApiError } from '../src/api';
import type { UserPublic, UserRole } from '../src/api/types';
import { colors, font, size, space } from '../src/theme';

type StaffRole = Exclude<UserRole, 'farmer'>;

export default function Staff() {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole>('inspector');
  const [list, setList] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', employee_id: '', department: '', jurisdiction: '' });

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await usersApi.listByRole(role));
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function create() {
    if (!f.name.trim()) return setError('Enter the person\u2019s name.');
    if (!f.phone.trim() && !f.email.trim()) return setError('Add a phone number or an email so they can sign in.');
    if (f.password.length < 6) return setError('Set a password of at least 6 characters.');

    setBusy(true);
    setError('');
    try {
      const created = await usersApi.createStaff({
        name: f.name.trim(), role, password: f.password,
        phone: f.phone.trim() || null, email: f.email.trim() || null,
        employee_id: f.employee_id.trim() || null,
        department: f.department.trim() || null,
        jurisdiction: f.jurisdiction.trim() || null,
      });
      setNotice(`${created.name} can now sign in as ${roleName(role).toLowerCase()}.`);
      setF({ name: '', phone: '', email: '', password: '', employee_id: '', department: '', jurisdiction: '' });
      setCreating(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(u: UserPublic) {
    try {
      await usersApi.deactivate(u.id);
      setNotice(`${u.name} can no longer sign in.`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not deactivate that account.');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: space.lg }}>
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>Back</Text>
        </Pressable>

        <Caption>District authority</Caption>
        <Title>Staff accounts</Title>
        <View style={{ height: space.xl }} />

        <Banner message={error} />
        <Banner message={notice} tone="good" />

        <Segmented
          value={role}
          onChange={(r) => { setRole(r); setNotice(''); }}
          options={[
            { value: 'inspector', label: 'Inspectors' },
            { value: 'doctor', label: 'Vets' },
            { value: 'authority', label: 'Authority' },
          ]}
        />

        {creating ? (
          <Card>
            <Heading>New {roleName(role).toLowerCase()}</Heading>
            <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="Dr. Meera Nair" />
            <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" hint="Phone or email — either one works to sign in." />
            <Field label="Employee ID" value={f.employee_id} onChangeText={set('employee_id')} autoCapitalize="characters" />
            <Field label="Department" value={f.department} onChangeText={set('department')} placeholder="Animal Husbandry" />
            <Field label="Jurisdiction" value={f.jurisdiction} onChangeText={set('jurisdiction')} placeholder="Bengaluru Rural" />
            <Field label="Temporary password" value={f.password} onChangeText={set('password')} secureTextEntry hint="Share it with them and ask them to change it after signing in." />
            <Button label="Create account" onPress={create} loading={busy} />
            <Button label="Cancel" onPress={() => setCreating(false)} variant="ghost" />
          </Card>
        ) : (
          <Button label={`Add a ${roleName(role).toLowerCase()}`} onPress={() => { setCreating(true); setNotice(''); }} />
        )}

        {loading ? (
          <ActivityIndicator color={colors.pasture} style={{ marginTop: space.xl }} />
        ) : list.length === 0 ? (
          <Empty title={`No ${roleName(role).toLowerCase()}s yet`} body="Accounts you create here can sign in immediately with the password you set." />
        ) : (
          list.map((u) => (
            <Card key={u.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>{u.name}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
                    {[u.employee_id, u.jurisdiction, u.phone ?? u.email].filter(Boolean).join(' · ') || 'No details on file'}
                  </Text>
                </View>
                {u.is_active ? <Badge label="Active" tone="good" /> : <Badge label="Deactivated" tone="risk" />}
              </View>
              {u.is_active && (
                <View style={{ marginTop: space.md }}>
                  <Button label="Deactivate" onPress={() => deactivate(u)} variant="ghost" />
                </View>
              )}
            </Card>
          ))
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const roleName = (r: string) =>
  ({ inspector: 'Inspector', doctor: 'Veterinary officer', authority: 'Authority' } as any)[r] ?? r;
