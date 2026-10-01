import { useMemo } from 'react';
import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from 'react-native';
import {
  X,
  Check,
  AlertTriangle,
  Minus,
} from 'lucide-react-native';
import {
  PathSegment,
  ProfileId,
  AccessibilityResult,
  Penalty,
} from '@/src/types/pathsense';
import {
  getColorForLevel,
  profileLabelMap,
} from '@/src/utils/accessibility';
import {
  calculateAccessibilityScore,
} from '@/src/services/accessibilityScoring';
import { theme } from '@/src/constants/theme';
import AccessibilityScore from '@/src/components/AccessibilityScore';

interface Props {
  segment: PathSegment | null;
  visible: boolean;
  onClose: () => void;
  activeProfile: ProfileId;
  barrierReports?: import('../types/pathsense').BarrierReport[];
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ALL_PROFILES: ProfileId[] = [
  'wheelchair',
  'crutches',
  'elderly',
  'stroller',
  'general',
];

export default function PathDetailsModal({
  segment,
  visible,
  onClose,
  activeProfile,
  barrierReports = [],
}: Props) {
  const activeResult = useMemo<AccessibilityResult | null>(() => {
    if (!segment) return null;
    return calculateAccessibilityScore(segment, activeProfile, barrierReports);
  }, [segment, activeProfile, barrierReports]);

  const otherProfileScores = useMemo(() => {
    if (!segment) return [];
    return ALL_PROFILES.filter((p) => p !== activeProfile).map((p) => ({
      profile: p,
      result: calculateAccessibilityScore(segment, p, barrierReports),
    }));
  }, [segment, activeProfile, barrierReports]);

  if (!segment || !activeResult) return null;

  const headerColor = getColorForLevel(activeResult.level);
  const topPenalties = activeResult.penalties.slice(0, 5);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.segmentId}>{segment.id}</Text>
              <View style={[styles.levelPill, { backgroundColor: headerColor }]}>
                <Text style={styles.levelPillText}>{activeResult.level}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close path details"
              accessibilityHint="Closes the path detail panel"
            >
              <X color={theme.colors.textSecondary} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.scoreHeaderCard}>
              <Text style={styles.scoreHeaderLabel}>
                Accessibility for {profileLabelMap[activeProfile]}
              </Text>
              <View style={styles.scoreHeaderRow}>
                <Text style={[styles.scoreHeaderNumber, { color: headerColor }]}>
                  {activeResult.score}
                </Text>
                <Text style={styles.scoreHeaderMax}>/ 100</Text>
                <View style={[styles.scoreHeaderPill, { backgroundColor: headerColor }]}>
                  <Text style={styles.scoreHeaderPillText}>
                    {activeResult.level}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>WHY THIS SCORE?</Text>

              {activeResult.positives.length > 0 && (
                <View style={styles.factorGroup}>
                  {activeResult.positives.map((pos) => (
                    <View key={pos} style={styles.positiveRow}>
                      <View style={styles.positiveIcon}>
                        <Check color={theme.colors.success} size={14} strokeWidth={3} />
                      </View>
                      <Text style={styles.positiveText}>{pos}</Text>
                    </View>
                  ))}
                </View>
              )}

              {topPenalties.length > 0 ? (
                <View style={styles.factorGroup}>
                  {topPenalties.map((penalty, idx) => (
                    <PenaltyRow key={`${penalty.factor}-${idx}`} penalty={penalty} />
                  ))}
                </View>
              ) : (
                <Text style={styles.noPenaltiesText}>
                  No significant accessibility penalties for this profile.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PATH DETAILS</Text>
              <DetailRow label="Distance" value={`${segment.distanceMeters} m`} />
              <DetailRow label="Surface" value={titleCase(segment.surface)} />
              <DetailRow label="Surface Condition" value={titleCase(segment.surfaceCondition)} />
              <DetailRow label="Clear Width" value={`${segment.clearWidthM.toFixed(1)} m`} />
              <DetailRow label="Gradient" value={`${segment.gradientPercent.toFixed(1)}%`} />
              <DetailRow label="Stairs" value={yesNo(segment.stairs)} />
              <DetailRow label="Ramp" value={yesNo(segment.rampAvailable)} />
              <DetailRow label="Obstruction" value={titleCase(segment.obstruction)} />
              <DetailRow label="Lighting" value={titleCase(segment.lighting)} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>OTHER MOBILITY PROFILES</Text>
              {otherProfileScores.map(({ profile, result }) => (
                <AccessibilityScore
                  key={profile}
                  profile={profile}
                  score={result.score}
                />
              ))}
            </View>

            {segment.notes ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>NOTES</Text>
                <Text style={styles.notesText}>{segment.notes}</Text>
              </View>
            ) : null}

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                Demo accessibility data — not field verified.
              </Text>
              <Text style={styles.disclaimerSubtext}>
                Scores are calculated from mock observations.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PenaltyRow({ penalty }: { penalty: Penalty }) {
  return (
    <View style={styles.penaltyRow}>
      <View style={styles.penaltyIconWrap}>
        <AlertTriangle color={theme.colors.warning} size={14} strokeWidth={2.5} />
      </View>
      <View style={styles.penaltyTextWrap}>
        <Text style={styles.penaltyFactor}>{penalty.reason}</Text>
      </View>
      <View style={styles.penaltyDeduction}>
        <Minus color={theme.colors.error} size={12} strokeWidth={3} />
        <Text style={styles.penaltyDeductionText}>{penalty.deduction}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '86%',
    paddingBottom: 18,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.borderStrong,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentId: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  levelPill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  levelPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: theme.colors.border,
  },
  scroll: {
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  scoreHeaderCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  scoreHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  scoreHeaderNumber: {
    fontSize: 34,
    fontWeight: '900',
  },
  scoreHeaderMax: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  scoreHeaderPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 'auto',
  },
  scoreHeaderPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  factorGroup: {
    gap: 6,
  },
  positiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  positiveIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(27, 158, 91, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positiveText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.success,
  },
  penaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  penaltyIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(224, 138, 30, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  penaltyTextWrap: {
    flex: 1,
  },
  penaltyFactor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  penaltyDeduction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  penaltyDeductionText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.error,
  },
  noPenaltiesText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  notesText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  disclaimerBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(224, 138, 30, 0.10)',
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.warning,
  },
  disclaimerSubtext: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
});
