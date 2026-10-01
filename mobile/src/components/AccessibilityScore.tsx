import { View, Text, StyleSheet } from 'react-native';
import {
  AccessibilityLevel,
  ProfileId,
} from '@/src/types/pathsense';
import {
  getAccessibilityLevel,
  getColorForLevel,
  profileLabelMap,
} from '@/src/utils/accessibility';
import { theme } from '@/src/constants/theme';

interface Props {
  profile: ProfileId;
  score: number;
}

export default function AccessibilityScore({ profile, score }: Props) {
  const level: AccessibilityLevel = getAccessibilityLevel(score);
  const color = getColorForLevel(level);
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`${profileLabelMap[profile]} score ${clampedScore} out of 100, ${level}`}
    >
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label}>{profileLabelMap[profile]}</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${clampedScore}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
        <Text style={styles.score}>{clampedScore}</Text>
        <View style={[styles.tag, { backgroundColor: color }]}>
          <Text style={styles.tagText}>{level}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  left: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  right: {
    flex: 1.9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  score: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    minWidth: 26,
    textAlign: 'right',
  },
  tag: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
