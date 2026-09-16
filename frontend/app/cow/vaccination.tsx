import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Caption, Field, Screen, Title } from '../../src/components/ui';
import { vaccinations as vaxApi, ApiError } from '../../src/api';
import { isIsoDate, today } from '../../src/lib/format';
import { colors, font, size, space } from '../../src/theme';

export default function AddVaccination() {
  const { cowId } = useLocalSearchParams<{ cowId: string }>();
  const router = useRouter();
  const [f, setF] = useState({
    vaccine_name: '', disease_covered: '', date_administered: today(),
    next_due_date: '', batch_number: '', administered_by: '', notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.vaccine_name.trim()) return setError('Name the vaccine that was given.');
    if (!isIsoDate(f.date_administered)) return setError('Write the date given as YYYY-MM-DD.');
    if (f.next_due_date && !isIsoDate(f.next_due_date)) return setError('Write the next due date as YYYY-MM-DD.');

    setBusy(true);
    setError('');
    try {
      await vaxApi.add(cowId!, {
        vaccine_name: f.vaccine_name.trim(),
        disease_covered: f.disease_covered.trim() || null,
        date_administered: f.date_administered,
        next_due_date: f.next_due_date || null,
        batch_number: f.batch_number.trim() || null,
        administered_by: f.administered_by.trim() || null,
        notes: f.notes.trim() || null,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save this vaccination.');
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

        <Caption>Vaccination</Caption>
        <Title>Record a dose</Title>
        <View style={{ height: space.xl }} />

        <Banner message={error} />

        <Field label="Vaccine" value={f.vaccine_name} onChangeText={set('vaccine_name')} placeholder="FMD Raksha" />
        <Field label="Covers" value={f.disease_covered} onChangeText={set('disease_covered')} placeholder="Foot and mouth disease" />
        <Field label="Date given" value={f.date_administered} onChangeText={set('date_administered')} placeholder="YYYY-MM-DD" />
        <Field label="Next dose due" value={f.next_due_date} onChangeText={set('next_due_date')} placeholder="YYYY-MM-DD" hint="The app shows a due-soon flag on the animal once this is within a month." />
        <Field label="Batch number" value={f.batch_number} onChangeText={set('batch_number')} autoCapitalize="characters" placeholder="Printed on the vial" />
        <Field label="Given by" value={f.administered_by} onChangeText={set('administered_by')} placeholder="Dr. Meera Nair" />
        <Field label="Notes" value={f.notes} onChangeText={set('notes')} multiline placeholder="Anything worth remembering next time" style={{ height: 90, paddingTop: 12 }} />

        <Button label="Save vaccination" onPress={submit} loading={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
