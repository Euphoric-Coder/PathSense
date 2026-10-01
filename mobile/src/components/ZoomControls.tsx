import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { theme } from '@/src/constants/theme';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  bottomInset: number;
}

export default function ZoomControls({ onZoomIn, onZoomOut, bottomInset }: Props) {
  return (
    <View
      style={[styles.container, { bottom: bottomInset + 110 }]}
      pointerEvents="box-none"
    >
      <View style={styles.stack}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onZoomIn}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          accessibilityHint="Increases the map zoom level"
        >
          <Plus color={theme.colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onZoomOut}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          accessibilityHint="Decreases the map zoom level"
        >
          <Minus color={theme.colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
  },
  stack: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    ...theme.shadows.elevated,
  },
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  buttonPressed: {
    backgroundColor: theme.colors.border,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    width: '100%',
  },
});
