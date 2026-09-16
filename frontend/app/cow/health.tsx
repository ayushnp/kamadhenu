import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Caption, Field, Screen, Title } from '../../src/components/ui';
import { health as healthApi, ApiError } from '../../src/api';
import { isIsoDate, today } from '../../src/lib/format';
import { colors, font, size, space } from '../../src/theme';

const COMMON = ['Mastitis', 'Foot and mouth disease', 'Milk fever', 'Ketosis', 'Bloat', 'Metritis'];

export default function AddHealth() {
  const { cowId } = useLocalSearchParams<{ cowId: string }>();
  const router = useRouter();
  const [f, setF] = useState({ disease_name: '', diagnosed_date: today(), resolved_date: '', treatment: '', notes: '' });
  const [chronic, setChronic] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.disease_name.trim()) return setError('Name the condition you are recording.');
    if (f.diagnosed_date && !isIsoDate(f.diagnosed_date)) return setError('Write dates as YYYY-MM-DD, for example 2026-09-16.');
    if (f.resolved_date && !isIsoDate(f.resolved_date)) return setError('Write dates as YYYY-MM-DD, for example 2026-09-16.');

    setBusy(true);
    setError('');
    try {
      await healthApi.add(cowId!, {
        disease_name: f.disease_name.trim(),
        diagnosed_date: f.diagnosed_date || null,
        resolved_date: f.resolved_date || null,
        treatment: f.treatment.trim() || null,
        notes: f.notes.trim() || null,
        is_comorbidity: chronic,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: space.lg }}>
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>Back</Text>
        </Pressable>

        <Caption>Health record</Caption>
        <Title>What did you find?</Title>
        <View style={{ height: space.xl }} />

        <Banner message={error} />

        <Field label="Condition" value={f.disease_name} onChangeText={set('disease_name')} placeholder="Mastitis" />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm, marginBottom: space.lg }}>
          {COMMON.map((c) => (
            <Pressable key={c} onPress={() => set('disease_name')(c)} style={{
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
              backgroundColor: colors.milk, borderWidth: 1, borderColor: colors.line,
            }}>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark }}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Diagnosed on" value={f.diagnosed_date} onChangeText={set('diagnosed_date')} placeholder="YYYY-MM-DD" />
        <Field label="Resolved on" value={f.resolved_date} onChangeText={set('resolved_date')} placeholder="Leave blank if still being treated" />
        <Field label="Treatment" value={f.treatment} onChangeText={set('treatment')} multiline placeholder="Intramammary antibiotic, 3 days" style={{ height: 90, paddingTop: 12 }} />
        <Field label="Notes" value={f.notes} onChangeText={set('notes')} multiline placeholder="Right rear quarter, clots in milk, udder warm" style={{ height: 90, paddingTop: 12 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xl }}>
          <View style={{ flex: 1, paddingRight: space.lg }}>
            <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.ink }}>Chronic or co-existing</Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              Turn this on for a long-running condition that raises risk on top of other illness.
            </Text>
          </View>
          <Switch value={chronic} onValueChange={setChronic} trackColor={{ true: colors.pasture, false: colors.line }} />
        </View>

        <Button label="Save record" onPress={submit} loading={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
