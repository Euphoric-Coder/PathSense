import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from 'react-native';
import { X, Check, MapPin } from 'lucide-react-native';
import { Landmark } from '@/src/types/pathsense';
import { theme } from '@/src/constants/theme';

interface Props {
  visible: boolean;
  title: string;
  landmarks: Landmark[];
  selectedId: string | null;
  excludeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LandmarkPicker({
  visible,
  title,
  landmarks,
  selectedId,
  excludeId,
  onSelect,
  onClose,
}: Props) {
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
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close landmark picker"
            >
              <X color={theme.colors.textSecondary} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {landmarks.map((lm) => {
              const isSelected = lm.id === selectedId;
              const isExcluded = lm.id === excludeId;
              return (
                <Pressable
                  key={lm.id}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    isExcluded && styles.optionRowDisabled,
                    pressed && !isExcluded && styles.optionRowPressed,
                  ]}
                  onPress={() => {
                    if (!isExcluded) onSelect(lm.id);
                  }}
                  disabled={isExcluded}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: isExcluded }}
                  accessibilityLabel={`${lm.name}, ${lm.type}${isExcluded ? ', already selected as the other endpoint' : ''}`}
                >
                  <View style={styles.optionIcon}>
                    <MapPin
                      color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                      size={18}
                      strokeWidth={2.5}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text
                      style={[
                        styles.optionName,
                        isExcluded && styles.optionNameDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {lm.name}
                    </Text>
                    <Text style={styles.optionType}>{titleCase(lm.type)}</Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Check color="#FFFFFF" size={15} strokeWidth={3} />
                    </View>
                  ) : isExcluded ? (
                    <Text style={styles.excludedLabel}>In use</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    maxHeight: '75%',
    paddingBottom: 18,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.borderStrong,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
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
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 5,
    backgroundColor: theme.colors.background,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(11, 95, 255, 0.08)',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  optionRowPressed: {
    backgroundColor: theme.colors.border,
  },
  optionRowDisabled: {
    opacity: 0.4,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  optionNameDisabled: {
    color: theme.colors.textMuted,
  },
  optionType: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  excludedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
});
