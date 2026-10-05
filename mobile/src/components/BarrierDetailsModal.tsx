import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { X, MapPin, Clock, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { BarrierReport } from '../types/pathsense';
import { pathSegments } from '../data/pathSegments';
import { landmarks } from '../data/landmarks';

interface Props {
  visible: boolean;
  onClose: () => void;
  report: BarrierReport | null;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  routeSegmentIds: Set<string>;
}

export default function BarrierDetailsModal({
  visible,
  onClose,
  report,
  onResolve,
  onDelete,
  routeSegmentIds,
}: Props) {
  if (!report) return null;

  const segment = pathSegments.find((s) => s.id === report.segmentId);
  let affectedPath = report.segmentId;
  if (segment) {
    const start = landmarks.find((l) => l.id === segment.startNodeId);
    const end = landmarks.find((l) => l.id === segment.endNodeId);
    if (start && end) {
      affectedPath = `${start.name} → ${end.name}`;
    }
  }

  const barrierName = report.barrierType
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const isResolved = report.status === 'resolved';
  const affectsRoute = routeSegmentIds.size > 0 ? routeSegmentIds.has(report.segmentId) : false;

  const handleResolve = () => {
    Alert.alert('Resolve Barrier', 'Mark this barrier as resolved?\n\It will stop affecting accessibility scores and route calculations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Resolved',
        style: 'default',
        onPress: () => {
          onResolve(report.id);
          onClose();
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Report', 'Delete this report?\n\This permanently removes the local report and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(report.id);
          onClose();
        },
      },
    ]);
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
          <Text style={styles.title}>Barrier Details</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Close barrier details"
          >
            <X color={theme.colors.text} size={24} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusRow}>
            {isResolved ? (
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.success + '20' }]}>
                <CheckCircle color={theme.colors.success} size={16} />
                <Text style={[styles.statusText, { color: theme.colors.success }]}>Resolved</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.warning + '20' }]}>
                <AlertTriangle color={theme.colors.warning} size={16} />
                <Text style={[styles.statusText, { color: theme.colors.warning }]}>Active</Text>
              </View>
            )}

            {!isResolved && (
              <View style={[styles.severityBadge, styles[`severity_${report.severity}` as keyof typeof styles]]}>
                <Text style={[styles.severityText, styles[`severityText_${report.severity}` as keyof typeof styles]]}>
                  {report.severity.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{barrierName}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Affected path</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>{affectedPath}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Segment ID</Text>
              <Text style={styles.detailValueText}>{report.segmentId}</Text>
            </View>

            {routeSegmentIds.size > 0 && !isResolved && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current route impact</Text>
                  <Text style={[styles.detailValue, affectsRoute && { color: theme.colors.error }]}>
                    {affectsRoute ? 'Affects current route' : 'Not on current route'}
                  </Text>
                </View>
              </>
            )}
            {routeSegmentIds.size === 0 && !isResolved && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current route impact</Text>
                  <Text style={styles.detailValueText}>No active route selected</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reported</Text>
              <Text style={styles.detailValueText}>
                {new Date(report.createdAt).toLocaleString()}
              </Text>
            </View>
            {isResolved && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Resolved</Text>
                <Text style={styles.detailValueText}>
                  {new Date(report.updatedAt || report.createdAt).toLocaleString()}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValueText}>
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Source</Text>
              <Text style={styles.detailValueText}>
                {report.source === 'manual' ? 'Manual Report' : 'AI Assisted'}
              </Text>
            </View>
          </View>

          {report.description && (
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Note</Text>
              <Text style={[styles.detailValue, { marginTop: 8 }]}>{report.description}</Text>
            </View>
          )}

          {report.imageUri && (
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Photo</Text>
              <Image
                source={{ uri: report.imageUri }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {!isResolved && (
            <Pressable
              style={styles.resolveButton}
              onPress={handleResolve}
              accessibilityLabel="Mark barrier as resolved"
            >
              <CheckCircle color="#FFFFFF" size={20} />
              <Text style={styles.resolveButtonText}>Mark Resolved</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            accessibilityLabel="Delete barrier report"
          >
            <Trash2 color={theme.colors.error} size={20} />
            <Text style={styles.deleteButtonText}>Delete Report</Text>
          </Pressable>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 12,
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
  detailCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    ...theme.shadows.card,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  detailValueText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  resolveButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resolveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.error + '10',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.error + '30',
  },
  deleteButtonText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
