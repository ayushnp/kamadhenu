import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Caption, Field, Screen, Segmented, Title } from '../../src/components/ui';
import { cows as cowsApi, ApiError } from '../../src/api';
import { useTranslation } from '../../src/i18n';
import { colors, font, size, space } from '../../src/theme';

const blank = {
  name: '', tag_number: '', pashu_aadhar: '', barcode: '', breed: '',
  age_years: '', calf_number: '', lactation_number: '',
};

export default function CowForm() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [species, setSpecies] = useState<'cattle' | 'buffalo'>('cattle');
  const [f, setF] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const editing = Boolean(editId);
  const set = (k: keyof typeof blank) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!editId) return;
    cowsApi.detail(editId).then((c) => {
      setSpecies(c.species === 'buffalo' ? 'buffalo' : 'cattle');
      setF({
        name: c.name ?? '', tag_number: c.tag_number ?? '', pashu_aadhar: c.pashu_aadhar ?? '',
        barcode: c.barcode ?? '', breed: c.breed ?? '',
        age_years: c.age_years != null ? String(c.age_years) : '',
        calf_number: c.calf_number != null ? String(c.calf_number) : '',
        lactation_number: c.lactation_number != null ? String(c.lactation_number) : '',
      });
    }).catch(() => setError('Could not load this animal for editing.'));
  }, [editId]);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  async function submit() {
    if (!f.name.trim() && !f.tag_number.trim() && !f.pashu_aadhar.trim()) {
      return setError('Give the animal a name, an ear tag or a Pashu Aadhar number so you can find it later.');
    }
    if (f.pashu_aadhar.trim() && !/^\d{12}$/.test(f.pashu_aadhar.trim())) {
      return setError('Pashu Aadhar is a 12-digit number.');
    }

    const payload = {
      name: f.name.trim() || null,
      tag_number: f.tag_number.trim() || null,
      pashu_aadhar: f.pashu_aadhar.trim() || null,
      barcode: f.barcode.trim() || null,
      breed: f.breed.trim() || null,
      species,
      age_years: num(f.age_years),
      calf_number: num(f.calf_number),
      lactation_number: num(f.lactation_number),
    };

    setBusy(true);
    setError('');
    try {
      if (editing) {
        await cowsApi.update(editId!, payload);
      } else {
        const created = await cowsApi.create(payload);
        router.replace(`/cow/${created.id}`);
        return;
      }
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save this animal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: space.lg }}>
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>
            {t('common.back')}
          </Text>
        </Pressable>

        <Caption>{editing ? t('cowForm.editAnimalCaption') : t('cowForm.newAnimalCaption')}</Caption>
        <Title>{editing ? t('cowForm.editAnimalTitle') : t('cowForm.newAnimalTitle')}</Title>
        <View style={{ height: space.xl }} />

        <Banner message={error} />

        <Segmented
          value={species}
          onChange={setSpecies}
          options={[
            { value: 'cattle', label: t('cowForm.speciesCow') },
            { value: 'buffalo', label: t('cowForm.speciesBuffalo') },
          ]}
        />

        <Field
          label={t('cowForm.nameLabel')}
          value={f.name}
          onChangeText={set('name')}
          placeholder={t('cowForm.namePlaceholder')}
        />
        <Field
          label={t('cowForm.earTagLabel')}
          value={f.tag_number}
          onChangeText={set('tag_number')}
          autoCapitalize="characters"
          placeholder={t('cowForm.earTagPlaceholder')}
        />
        <Field
          label={t('cowForm.pashuAadharLabel')}
          value={f.pashu_aadhar}
          onChangeText={set('pashu_aadhar')}
          keyboardType="number-pad"
          maxLength={12}
          placeholder={t('cowForm.pashuAadharPlaceholder')}
          hint={t('cowForm.pashuAadharHint')}
        />
        <Field
          label={t('cowForm.barcodeLabel')}
          value={f.barcode}
          onChangeText={set('barcode')}
          autoCapitalize="characters"
          placeholder={t('cowForm.barcodePlaceholder')}
        />
        <Field
          label={t('cowForm.breedLabel')}
          value={f.breed}
          onChangeText={set('breed')}
          placeholder={t('cowForm.breedPlaceholder')}
        />
        <Field
          label={t('cowForm.ageLabel')}
          value={f.age_years}
          onChangeText={set('age_years')}
          keyboardType="decimal-pad"
          placeholder="4.5"
        />
        <Field
          label={t('cowForm.calfNumberLabel')}
          value={f.calf_number}
          onChangeText={set('calf_number')}
          keyboardType="number-pad"
          placeholder="2"
        />
        <Field
          label={t('cowForm.lactationLabel')}
          value={f.lactation_number}
          onChangeText={set('lactation_number')}
          keyboardType="number-pad"
          placeholder="2"
          hint={t('cowForm.lactationHint')}
        />

        <Button
          label={editing ? t('cowForm.submitSave') : t('cowForm.submitAdd')}
          onPress={submit}
          loading={busy}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
