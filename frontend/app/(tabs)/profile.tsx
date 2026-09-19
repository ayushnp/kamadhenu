import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Field, Screen, Title } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { useTranslation, SUPPORTED_LANGUAGES } from '../../src/i18n';
import { users as usersApi, ApiError, API_URL } from '../../src/api';
import { colors, font, radius, size, space } from '../../src/theme';

export default function Profile() {
  const { user, signOut, refresh } = useAuth();
  const { t, locale, setLocale } = useTranslation();
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
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmBody'), [
      { text: t('profile.staySignedIn'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <View style={{ marginTop: 48, marginBottom: space.xl }}>
        <Caption>{t('profile.yourAccount')}</Caption>
        <Title>{user.name}</Title>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Badge label={roleName(user.role)} tone="good" />
          {!user.is_active && <Badge label="Deactivated" tone="risk" />}
        </View>
      </View>

      <Banner message={error} />

      {editing ? (
        <Card>
          <Field label={t('auth.nameLabel')} value={f.name} onChangeText={set('name')} />
          <Field label={t('profile.phone')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label={t('profile.village')} value={f.place} onChangeText={set('place')} />
          {user.role === 'farmer' && (
            <Field label={t('profile.animalsDeclared')} value={f.animals} onChangeText={set('animals')} keyboardType="number-pad" />
          )}
          <Button label={t('common.saveChanges')} onPress={save} loading={busy} />
          <Button label={t('common.cancel')} onPress={() => setEditing(false)} variant="ghost" />
        </Card>
      ) : (
        <Card>
          <Line label={t('profile.phone')} value={user.phone ?? '—'} />
          <Line label={t('profile.email')} value={user.email ?? '—'} />
          {user.role === 'farmer' ? (
            <>
              <Line label={t('profile.village')} value={user.place ?? '—'} />
              <Line label={t('profile.animalsDeclared')} value={user.number_of_animals != null ? String(user.number_of_animals) : '—'} />
            </>
          ) : (
            <>
              <Line label="Employee ID" value={user.employee_id ?? '—'} />
              <Line label="Department" value={user.department ?? '—'} />
              <Line label="Jurisdiction" value={user.jurisdiction ?? '—'} />
            </>
          )}
          <Button label={t('profile.editProfile')} onPress={() => setEditing(true)} variant="secondary" />
        </Card>
      )}

      {/* Language Preferences Card */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
          <Feather name="globe" size={18} color={colors.pasture} style={{ marginRight: space.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>
              {t('profile.languageSettingTitle')}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
              {t('profile.languageSettingSub')}
            </Text>
          </View>
        </View>

        <View style={{ gap: space.xs, marginTop: space.xs }}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = locale === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => setLocale(lang.code)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.pasture : colors.line,
                  backgroundColor: isSelected ? colors.pastureSoft : colors.milk,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontFamily: isSelected ? font.bodySemi : font.body,
                      fontSize: size.base,
                      color: isSelected ? colors.pasture : colors.ink,
                    }}
                  >
                    {lang.label} {lang.code !== 'en' ? `(${lang.englishLabel})` : ''}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                    {lang.subtext}
                  </Text>
                </View>

                {isSelected ? (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.pasture,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Feather name="check" size={14} color={colors.milk} />
                  </View>
                ) : (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 1.5,
                      borderColor: colors.line,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>

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

      <Button label={t('profile.signOut')} onPress={confirmSignOut} variant="ghost" />
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
