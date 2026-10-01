import { useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  Accessibility,
  Move,
  CircleUser,
  Baby,
  Footprints,
  ChevronDown,
  Check,
  X,
} from 'lucide-react-native';
import { ProfileId } from '@/src/types/pathsense';
import { mobilityProfiles } from '@/src/data/mobilityProfiles';
import { profileLabelMap } from '@/src/utils/accessibility';
import { theme } from '@/src/constants/theme';

interface Props {
  activeProfile: ProfileId;
  onSelect: (profile: ProfileId) => void;
}

const profileIcons: Record<
  ProfileId,
  typeof Accessibility
> = {
  wheelchair: Accessibility,
  crutches: Move,
  elderly: CircleUser,
  stroller: Baby,
  general: Footprints,
};

export default function ProfileSelector({ activeProfile, onSelect }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const ActiveIcon = profileIcons[activeProfile];

  const handleSelect = (id: ProfileId) => {
    onSelect(id);
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.floatingBtn,
          pressed && styles.floatingBtnPressed,
        ]}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Mobility profile: ${profileLabelMap[activeProfile]}. Tap to change.`}
        accessibilityHint="Opens the mobility profile selector"
      >
        <View style={styles.floatingBtnLeft}>
          <View style={styles.iconBadge}>
            <ActiveIcon color="#FFFFFF" size={16} strokeWidth={2.5} />
          </View>
          <View style={styles.floatingBtnText}>
            <Text style={styles.floatingBtnCaption}>Mobility Profile</Text>
            <Text style={styles.floatingBtnValue} numberOfLines={1}>
              {profileLabelMap[activeProfile]}
            </Text>
          </View>
        </View>
        <ChevronDown
          color={theme.colors.textSecondary}
          size={18}
          strokeWidth={2.5}
        />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Mobility Profile</Text>
                <Text style={styles.sheetSubtitle}>
                  Accessibility presets — not medical diagnoses
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close profile selector"
              >
                <X color={theme.colors.textSecondary} size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {mobilityProfiles.map((profile) => {
                const Icon = profileIcons[profile.id];
                const isSelected = profile.id === activeProfile;
                return (
                  <Pressable
                    key={profile.id}
                    style={({ pressed }) => [
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                      pressed && styles.optionRowPressed,
                    ]}
                    onPress={() => handleSelect(profile.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${profile.label}. ${profile.description}`}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        isSelected && styles.optionIconSelected,
                      ]}
                    >
                      <Icon
                        color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                        size={20}
                        strokeWidth={2.5}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{profile.label}</Text>
                      <Text style={styles.optionDesc}>{profile.description}</Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.checkBadge}>
                        <Check color="#FFFFFF" size={16} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingBtn: {
    position: 'absolute',
    top: 72,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...theme.shadows.elevated,
  },
  floatingBtnPressed: {
    backgroundColor: 'rgba(240,242,246,0.98)',
  },
  floatingBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBtnText: {
    flex: 1,
  },
  floatingBtnCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  floatingBtnValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '70%',
    paddingBottom: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.background,
  },
  optionRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(11, 95, 255, 0.06)',
  },
  optionRowPressed: {
    backgroundColor: theme.colors.border,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  optionIconSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  optionDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
