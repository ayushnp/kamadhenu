import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Caption, Card, Field, Screen, Segmented, Title } from '../../src/components/ui';
import { cows as cowsApi, ApiError } from '../../src/api';
import type { CowWithHistory } from '../../src/api/types';
import { cowLabel, cowSubtitle, openConditions } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

type Mode = 'tag_number' | 'pashu_aadhar' | 'barcode';

const MODES = [
  { value: 'tag_number' as Mode, label: 'Ear tag' },
  { value: 'pashu_aadhar' as Mode, label: 'Pashu Aadhar' },
  { value: 'barcode' as Mode, label: 'Barcode' },
];

export default function Lookup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('tag_number');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CowWithHistory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  async function search(raw?: string) {
    const q = (raw ?? value).trim();
    if (!q) return setError('Enter a number to search for.');
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await cowsApi.lookup({ [mode]: q } as any));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404
        ? 'No animal is registered under that number.'
        : e instanceof ApiError ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return setError('Camera access is off. Turn it on in settings to scan tags.');
    }
    setMode('barcode');
    setScanning(true);
  }

  return (
    <Screen>
      <View style={{ marginTop: 48, marginBottom: space.xl }}>
        <Caption>Any registered animal</Caption>
        <Title>Find an animal</Title>
      </View>

      <Banner message={error} />
      <Segmented options={MODES} value={mode} onChange={(m) => { setMode(m); setResult(null); }} />

      <Field
        label={MODES.find((m) => m.value === mode)!.label}
        value={value}
        onChangeText={setValue}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType={mode === 'pashu_aadhar' ? 'number-pad' : 'default'}
        placeholder={mode === 'pashu_aadhar' ? '12-digit number' : 'e.g. KA-114-B'}
        returnKeyType="search"
        onSubmitEditing={() => search()}
      />

      <Button label="Search" onPress={() => search()} loading={busy} />
      <Button label="Scan a barcode" onPress={openScanner} variant="secondary" />

      {result && (
        <Pressable onPress={() => router.push(`/cow/${result.id}`)}>
          <Card style={{ borderColor: colors.pasture, borderWidth: 1.5 }}>
            <Text style={{ fontFamily: font.displayMid, fontSize: size.lg, color: colors.ink }}>{cowLabel(result)}</Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              {cowSubtitle(result) || 'Details not filled in'}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.lg }}>
              <Mini n={openConditions(result.health_records).length} label="open conditions" />
              <Mini n={result.vaccinations.length} label="vaccinations" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.pasture }}>Open full history</Text>
              <Feather name="arrow-right" size={17} color={colors.pasture} style={{ marginLeft: 6 }} />
            </View>
          </Card>
        </Pressable>
      )}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'code39'] }}
            onBarcodeScanned={({ data }) => {
              setScanning(false);
              setValue(data);
              search(data);
            }}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <View style={{ width: 240, height: 160, borderRadius: radius.md, borderWidth: 3, borderColor: colors.milk, opacity: 0.9 }} />
          </View>
          <Pressable
            onPress={() => setScanning(false)}
            style={{ position: 'absolute', bottom: 48, alignSelf: 'center', backgroundColor: colors.milk, paddingHorizontal: 28, paddingVertical: 14, borderRadius: radius.pill }}
          >
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

function Mini({ n, label }: { n: number; label: string }) {
  return (
    <View>
      <Text style={{ fontFamily: font.display, fontSize: size.xl, color: colors.ink }}>{n}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>{label}</Text>
    </View>
  );
}
