import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { X, AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { BarrierReport } from '../types/pathsense';
import { pathSegments } from '../data/pathSegments';
import { landmarks } from '../data/landmarks';

interface Props {
  visible: boolean;
  onClose: () => void;
  reports: BarrierReport[];
  onSelectBarrier: (report: BarrierReport) => void;
}

export default function ActiveBarriersModal({
  visible,
  onClose,
  reports,
  onSelectBarrier,
}: Props) {
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');

  const activeReports = useMemo(() => {
    return reports
      .filter((r) => r.status === 'active')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports]);

  const resolvedReports = useMemo(() => {
    return reports
      .filter((r) => r.status === 'resolved')
      .sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [reports]);

  const displayedReports = activeTab === 'active' ? activeReports : resolvedReports;

  const renderItem = ({ item }: { item: BarrierReport }) => {
    // Find path segment name
    const segment = pathSegments.find((s) => s.id === item.segmentId);
    let affectedPath = item.segmentId;
    if (segment) {
      const start = landmarks.find((l) => l.id === segment.startNodeId);
      const end = landmarks.find((l) => l.id === segment.endNodeId);
      if (start && end) {
        affectedPath = `${start.name} → ${end.name}`;
      }
    }

    const barrierName = item.barrierType
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const isResolved = item.status === 'resolved';

    return (
      <Pressable
        style={styles.card}
        onPress={() => onSelectBarrier(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            {isResolved ? (
              <CheckCircle color={theme.colors.success} size={16} />
            ) : (
              <AlertTriangle color={theme.colors.warning} size={16} />
            )}
            <Text style={styles.cardTitle}>{barrierName}</Text>
          </View>
          {!isResolved && (
            <View style={[styles.severityBadge, styles[`severity_${item.severity}` as keyof typeof styles]]}>
              <Text style={[styles.severityText, styles[`severityText_${item.severity}` as keyof typeof styles]]}>
                {item.severity.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.pathName}>{affectedPath}</Text>
        <Text style={styles.segmentIdText}>{item.segmentId}</Text>

        <View style={styles.timeRow}>
          <Clock color={theme.colors.textMuted} size={12} />
          <Text style={styles.timeText}>
            {isResolved ? 'Resolved ' : 'Reported '}
            {new Date(isResolved ? (item.updatedAt || item.createdAt) : item.createdAt).toLocaleString()}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Active Barriers</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close active barriers"
            >
              <X color={theme.colors.text} size={24} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Reported accessibility conditions currently affecting PathSense routes.
          </Text>

          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, activeTab === 'active' && styles.tabActive]}
              onPress={() => setActiveTab('active')}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                Active ({activeReports.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'resolved' && styles.tabActive]}
              onPress={() => setActiveTab('resolved')}
            >
              <Text style={[styles.tabText, activeTab === 'resolved' && styles.tabTextActive]}>
                History
              </Text>
            </Pressable>
          </View>
        </View>

        {displayedReports.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertTriangle color={theme.colors.textMuted} size={48} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No active barriers' : 'No resolved barriers'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'active'
                ? 'Reported barriers that are still affecting accessibility scores will appear here.'
                : 'Resolved barriers will appear here.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayedReports}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.border,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  severity_low: { backgroundColor: '#F3F4F6' },
  severityText_low: { color: '#4B5563' },
  severity_moderate: { backgroundColor: '#FEF3C7' },
  severityText_moderate: { color: '#D97706' },
  severity_high: { backgroundColor: '#FEE2E2' },
  severityText_high: { color: '#DC2626' },
  severity_critical: { backgroundColor: '#991B1B' },
  severityText_critical: { color: '#FFFFFF' },
  pathName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  segmentIdText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
