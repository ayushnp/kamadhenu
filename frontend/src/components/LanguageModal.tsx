import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation, SUPPORTED_LANGUAGES, SupportedLocale } from '../i18n';
import { colors, font, radius, size, space } from '../theme';

interface Props {
  visible: boolean;
  onDismiss?: () => void;
}

export default function LanguageModal({ visible, onDismiss }: Props) {
  const { locale, setLocale, t } = useTranslation();
  const [selected, setSelected] = useState<SupportedLocale>(locale);

  // Sync internal selection with context if locale changes externally
  React.useEffect(() => {
    setSelected(locale);
  }, [locale]);

  const handleConfirm = async () => {
    await setLocale(selected);
    if (onDismiss) onDismiss();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header decorative badge */}
          <View style={styles.badgeRow}>
            <Text style={styles.cowEmoji}>🐄</Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>KAMADHENU · ಕಾಮಧೇನು · कामधेनु</Text>
            </View>
          </View>

          <Text style={styles.title}>Choose Your Language</Text>
          <Text style={styles.subtitleKannada}>ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ</Text>
          <Text style={styles.subtitleHindi}>अपनी पसंदीदा भाषा चुनें</Text>

          {/* Options */}
          <View style={styles.optionsList}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = selected === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => setSelected(lang.code)}
                  style={[
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                  ]}
                >
                  <View style={styles.langTextContainer}>
                    <View style={styles.langTitleRow}>
                      <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
                        {lang.label}
                      </Text>
                      {lang.code !== 'en' && (
                        <Text style={styles.langEnglishTag}>({lang.englishLabel})</Text>
                      )}
                    </View>
                    <Text style={styles.langSubtext}>{lang.subtext}</Text>
                  </View>

                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <Feather name="check" size={15} color={colors.milk} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Continue button */}
          <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>
              {selected === 'kn'
                ? 'ಕನ್ನಡದಲ್ಲಿ ಮುಂದುವರಿಯಿರಿ'
                : selected === 'hi'
                ? 'हिंदी में आगे बढ़ें'
                : 'Continue in English'}
            </Text>
            <Feather name="arrow-right" size={18} color={colors.milk} style={{ marginLeft: 8 }} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 43, 33, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.sm,
  },
  cowEmoji: {
    fontSize: 20,
  },
  tag: {
    backgroundColor: colors.pastureSoft,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagText: {
    fontFamily: font.bodySemi,
    fontSize: size.xs,
    color: colors.pasture,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: font.display,
    fontSize: size.xl,
    color: colors.ink,
    marginTop: 4,
  },
  subtitleKannada: {
    fontFamily: font.bodySemi,
    fontSize: size.sm,
    color: colors.pasture,
    marginTop: 2,
  },
  subtitleHindi: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.muted,
    marginTop: 1,
    marginBottom: space.md,
  },
  optionsList: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.milk,
  },
  langCardSelected: {
    borderColor: colors.pasture,
    backgroundColor: colors.pastureSoft,
  },
  langTextContainer: {
    flex: 1,
  },
  langTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  langLabel: {
    fontFamily: font.bodySemi,
    fontSize: size.md,
    color: colors.ink,
  },
  langLabelSelected: {
    color: colors.pasture,
    fontFamily: font.displayMid,
  },
  langEnglishTag: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.muted,
  },
  langSubtext: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.bark,
    marginTop: 2,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: space.sm,
  },
  radioCircleSelected: {
    borderColor: colors.pasture,
    backgroundColor: colors.pasture,
  },
  confirmBtn: {
    backgroundColor: colors.pasture,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  confirmBtnText: {
    fontFamily: font.bodySemi,
    fontSize: size.base,
    color: colors.milk,
  },
});
