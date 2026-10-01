import { View, Text, StyleSheet } from 'react-native';
import {
  COLOR_ACCESSIBLE,
  COLOR_MODERATE,
  COLOR_DIFFICULT,
  compactProfileLabelMap,
} from '@/src/utils/accessibility';
import { theme } from '@/src/constants/theme';
import { ProfileId } from '@/src/types/pathsense';

interface Props {
  activeProfile: ProfileId;
}

export default function AccessibilityLegend({ activeProfile }: Props) {
  const items: { label: string; range: string; color: string }[] = [
    { label: 'Accessible', range: '80–100', color: COLOR_ACCESSIBLE },
    { label: 'Moderate', range: '50–79', color: COLOR_MODERATE },
    { label: 'Difficult', range: '0–49', color: COLOR_DIFFICULT },
  ];

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel="Accessibility legend"
    >
      <Text style={styles.title}>Accessibility</Text>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.range}>{item.range}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.profileRow}>
        <Text style={styles.profileLabel}>Profile</Text>
        <View style={styles.profilePill}>
          <Text style={styles.profileValue} numberOfLines={1}>
            {compactProfileLabelMap[activeProfile]}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...theme.shadows.card,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  swatch: {
    width: 12,
    height: 5,
    borderRadius: 2.5,
    marginRight: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
  range: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginLeft: 'auto',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  profileLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  profilePill: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  profileValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
