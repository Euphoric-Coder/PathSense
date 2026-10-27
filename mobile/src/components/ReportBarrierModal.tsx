import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { 
  Camera, 
  Image as ImageIcon, 
  MapPin, 
  AlertTriangle, 
  X, 
  Check, 
  ChevronRight, 
  Info,
  Navigation,
  Sparkles,
  Edit3,
  RefreshCw,
  CheckCircle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';

import { BarrierReport, BarrierSeverity, BarrierType, PathSegment } from '@/src/types/pathsense';
import { landmarks } from '@/src/data/landmarks';
import { pathSegments } from '@/src/data/pathSegments';
import { findNearestSegment } from '@/src/services/segmentMatching';
import { theme } from '@/src/constants/theme';
import { analyzeBarrierImage } from '@/src/services/ai/barrierAnalysis';
import type { 
  AIBarrierAnalysis, 
  AIAnalysisMetadata, 
  SurfaceCondition, 
  EstimatedPassability 
} from '@/src/services/ai/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: BarrierReport) => void;
  routeSegmentIds?: Set<string>;
}

const BARRIER_TYPES: { type: BarrierType; label: string }[] = [
  { type: 'stairs', label: 'Stairs' },
  { type: 'missing_ramp', label: 'Missing Ramp' },
  { type: 'broken_surface', label: 'Broken Surface' },
  { type: 'construction', label: 'Construction' },
  { type: 'obstruction', label: 'Obstruction' },
  { type: 'narrow_path', label: 'Narrow Path' },
  { type: 'drain_issue', label: 'Drain Issue' },
  { type: 'waterlogging', label: 'Waterlogging' },
  { type: 'steep_gradient', label: 'Steep Gradient' },
  { type: 'other', label: 'Other' },
];

const SEVERITIES: { value: BarrierSeverity; label: string; desc: string; color: string; bgColor: string }[] = [
  { value: 'low', label: 'Low Impact', desc: 'Minor inconvenience, passable with care.', color: theme.colors.success, bgColor: theme.colors.success + '15' },
  { value: 'moderate', label: 'Moderate', desc: 'Noticeable accessibility impact.', color: '#F59E0B', bgColor: '#F59E0B15' }, // Amber
  { value: 'high', label: 'High Severity', desc: 'Major difficulty, very hard to pass.', color: theme.colors.warning, bgColor: theme.colors.warning + '15' },
  { value: 'critical', label: 'Critical / Blocked', desc: 'Route is completely unusable.', color: theme.colors.error, bgColor: theme.colors.error + '15' },
];

const SAMPLE_FIXTURES: { id: string; label: string; type: BarrierType; uri: string }[] = [
  { id: 'case-a-construction', label: '🚧 Construction (GH-S012)', type: 'construction', uri: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?w=600&auto=format&fit=crop&q=80' },
  { id: 'case-b-stairs', label: '🪜 Stairs No Ramp', type: 'stairs', uri: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80' },
  { id: 'case-c-broken-surface', label: '🧱 Broken Pavement', type: 'broken_surface', uri: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop&q=80' },
  { id: 'case-d-obstruction', label: '🛵 Parked Vehicle', type: 'obstruction', uri: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80' },
  { id: 'case-e-narrow-path', label: '📏 Narrow Path', type: 'narrow_path', uri: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80' },
  { id: 'case-f-ambiguous', label: '🚶 Clear Sidewalk', type: 'other', uri: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80' },
];

const SURFACE_CONDITIONS: { value: SurfaceCondition; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'uneven', label: 'Uneven' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'wet', label: 'Wet' },
  { value: 'unknown', label: 'Unknown' },
];

const PASSABILITY_OPTIONS: { value: EstimatedPassability; label: string }[] = [
  { value: 'passable', label: 'Passable' },
  { value: 'difficult', label: 'Difficult' },
  { value: 'likely_impassable', label: 'Likely Impassable' },
  { value: 'unknown', label: 'Unknown' },
];

export default function ReportBarrierModal({ visible, onClose, onSubmit, routeSegmentIds = new Set() }: Props) {
  const [step, setStep] = useState(1);
  const [showOtherPaths, setShowOtherPaths] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [suggestedSegment, setSuggestedSegment] = useState<PathSegment | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);
  const [barrierType, setBarrierType] = useState<BarrierType | null>(null);
  const [severity, setSeverity] = useState<BarrierSeverity | null>(null);
  const [description, setDescription] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // V0.5 AI Assistant State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIBarrierAnalysis | null>(null);
  const [aiMetadata, setAiMetadata] = useState<AIAnalysisMetadata | null>(null);
  const [originalSuggestion, setOriginalSuggestion] = useState<AIBarrierAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [editSurfaceCondition, setEditSurfaceCondition] = useState<SurfaceCondition>('unknown');
  const [editPassability, setEditPassability] = useState<EstimatedPassability>('unknown');

  useEffect(() => {
    if (visible) {
      setStep(1);
      setImageUri(null);
      setLocation(null);
      setSegmentId(null);
      setSuggestedSegment(null);
      setDistanceText(null);
      setBarrierType(null);
      setSeverity(null);
      setDescription('');
      setIsGettingLocation(false);
      setShowOtherPaths(false);
      setIsAnalyzing(false);
      setAiAnalysis(null);
      setAiMetadata(null);
      setOriginalSuggestion(null);
      setAiError(null);
      setIsEditingAi(false);
      setSelectedFixtureId(null);
      setEditSurfaceCondition('unknown');
      setEditPassability('unknown');
    }
  }, [visible]);

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      alert('Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setSelectedFixtureId(null);
      setAiAnalysis(null);
      setOriginalSuggestion(null);
      setAiError(null);
    }
  };

  const handleChooseGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setSelectedFixtureId(null);
      setAiAnalysis(null);
      setOriginalSuggestion(null);
      setAiError(null);
    }
  };

  const handleSelectSampleFixture = (fixture: typeof SAMPLE_FIXTURES[0]) => {
    setImageUri(fixture.uri);
    setSelectedFixtureId(fixture.id);
    setAiAnalysis(null);
    setOriginalSuggestion(null);
    setAiError(null);
  };

  const handleAnalyzeWithAI = async () => {
    if (!imageUri && !selectedFixtureId) return;
    setIsAnalyzing(true);
    setAiError(null);

    try {
      const result = await analyzeBarrierImage(imageUri || 'mock_uri', {
        latitude: location?.latitude,
        longitude: location?.longitude,
        fixtureId: selectedFixtureId || undefined,
      });

      setAiAnalysis(result.analysis);
      setOriginalSuggestion(result.analysis);
      setAiMetadata(result.metadata);
      setEditSurfaceCondition(result.analysis.surfaceCondition);
      setEditPassability(result.analysis.estimatedPassability);
      setIsAnalyzing(false);
    } catch (err: any) {
      setAiError(err.message || 'AI analysis could not be completed.');
      setIsAnalyzing(false);
    }
  };

  const handleUseSuggestion = () => {
    if (!aiAnalysis) return;
    setBarrierType(aiAnalysis.barrierType);
    setSeverity(aiAnalysis.severity);
    if (!description && aiAnalysis.reasoningSummary) {
      setDescription(aiAnalysis.reasoningSummary);
    }
    setStep(2);
  };

  const handleStartEditAnalysis = () => {
    if (aiAnalysis) {
      setBarrierType(aiAnalysis.barrierType);
      setSeverity(aiAnalysis.severity);
      setEditSurfaceCondition(aiAnalysis.surfaceCondition);
      setEditPassability(aiAnalysis.estimatedPassability);
    }
    setIsEditingAi(true);
  };

  const handleSaveEditedAnalysis = () => {
    if (aiAnalysis && barrierType && severity) {
      setAiAnalysis({
        ...aiAnalysis,
        barrierType,
        severity,
        surfaceCondition: editSurfaceCondition,
        estimatedPassability: editPassability,
      });
      if (!description && aiAnalysis.reasoningSummary) {
        setDescription(aiAnalysis.reasoningSummary);
      }
    }
    setIsEditingAi(false);
    setStep(2);
  };

  const handleGetLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied. Please select path manually.');
        setStep(3);
        setIsGettingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      
      const match = findNearestSegment(loc.coords.latitude, loc.coords.longitude, pathSegments, landmarks);
      if (match.nearestSegment) {
        setSuggestedSegment(match.nearestSegment);
        
        // If nearest segment belongs to current route, preselect it.
        if (routeSegmentIds.has(match.nearestSegment.id)) {
          setSegmentId(match.nearestSegment.id);
        }
        
        setDistanceText(Math.round(match.distanceMeters) + ' m');
      }
    } catch (e) {
      console.log(e);
      alert('Could not get location. Please select path manually.');
    }
    setIsGettingLocation(false);
    setStep(3);
  };

  const getSegmentName = (id: string) => {
    const seg = pathSegments.find(s => s.id === id);
    if (!seg) return 'Unknown Segment';
    const start = landmarks.find(l => l.id === seg.startNodeId);
    const end = landmarks.find(l => l.id === seg.endNodeId);
    if (!start || !end) return id;
    return `${start.name} → ${end.name}`;
  };

  const handleSubmit = () => {
    if (!segmentId || !barrierType || !severity) return;
    const id = 'BR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const isAiAssisted = originalSuggestion !== null;
    const userModified = isAiAssisted && (
      barrierType !== originalSuggestion.barrierType ||
      severity !== originalSuggestion.severity
    );

    onSubmit({
      id,
      segmentId,
      latitude: location?.latitude || 0,
      longitude: location?.longitude || 0,
      barrierType,
      severity,
      description: description.trim() || undefined,
      imageUri: imageUri || undefined,
      source: isAiAssisted ? 'ai_assisted' : 'manual',
      status: 'active',
      createdAt: new Date().toISOString(),
      isMock: false,
      aiAnalysis: isAiAssisted ? {
        originalSuggestion,
        userModified,
        confidence: originalSuggestion.confidence,
        metadata: aiMetadata || undefined,
      } : undefined,
    });
  };

  const renderStepIndicator = () => {
    return (
      <View style={styles.stepIndicatorContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={[styles.stepDot, s === step && styles.stepDotActive, s < step && styles.stepDotCompleted]} />
        ))}
      </View>
    );
  };

  const renderStep1 = () => {
    const isImageAvailable = Boolean(imageUri);
    const confidencePct = aiAnalysis ? Math.round(aiAnalysis.confidence * 100) : 0;
    const isLowConfidence = aiAnalysis ? aiAnalysis.confidence < 0.65 : false;

    const confidenceLabel = aiAnalysis
      ? aiAnalysis.confidence >= 0.85
        ? `High confidence — ${confidencePct}%`
        : aiAnalysis.confidence >= 0.65
        ? `Moderate confidence — ${confidencePct}%`
        : `Low confidence — ${confidencePct}%`
      : '';

    return (
      <View style={styles.stepContainer}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={styles.stepTitle}>Add Photo (Optional)</Text>
          <Text style={styles.stepSubtitle}>
            A picture helps visually verify the accessibility barrier with AI assistance.
          </Text>

          {isImageAvailable ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri! }} style={styles.imagePreview} resizeMode="cover" />
              <Pressable
                style={styles.removeImageBtn}
                onPress={() => {
                  setImageUri(null);
                  setSelectedFixtureId(null);
                  setAiAnalysis(null);
                  setOriginalSuggestion(null);
                  setAiError(null);
                  setIsEditingAi(false);
                }}
              >
                <X color="#FFF" size={20} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.photoActions}>
                <Pressable style={styles.photoCardBtn} onPress={handleTakePhoto}>
                  <View style={[styles.photoIconWrap, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Camera color={theme.colors.primary} size={28} />
                  </View>
                  <View style={styles.photoCardTextWrap}>
                    <Text style={styles.photoCardTitle}>Take Photo</Text>
                    <Text style={styles.photoCardDesc}>Use your camera to capture the barrier</Text>
                  </View>
                  <ChevronRight color={theme.colors.borderStrong} size={20} />
                </Pressable>

                <Pressable style={styles.photoCardBtn} onPress={handleChooseGallery}>
                  <View style={[styles.photoIconWrap, { backgroundColor: '#8B5CF620' }]}>
                    <ImageIcon color="#8B5CF6" size={28} />
                  </View>
                  <View style={styles.photoCardTextWrap}>
                    <Text style={styles.photoCardTitle}>Upload from Gallery</Text>
                    <Text style={styles.photoCardDesc}>Select an existing photo from your device</Text>
                  </View>
                  <ChevronRight color={theme.colors.borderStrong} size={20} />
                </Pressable>
              </View>

              <View style={styles.sampleFixturesSection}>
                <Text style={styles.sampleFixturesTitle}>Or test with a sample barrier:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sampleScroll}>
                  {SAMPLE_FIXTURES.map(fixture => (
                    <Pressable
                      key={fixture.id}
                      style={[
                        styles.sampleChip,
                        selectedFixtureId === fixture.id && styles.sampleChipActive,
                      ]}
                      onPress={() => handleSelectSampleFixture(fixture)}
                    >
                      <Text
                        style={[
                          styles.sampleChipText,
                          selectedFixtureId === fixture.id && styles.sampleChipTextActive,
                        ]}
                      >
                        {fixture.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          {/* AI Loading State */}
          {isAnalyzing && (
            <View style={styles.aiLoadingCard}>
              <ActivityIndicator size="large" color="#6366F1" style={{ marginBottom: 12 }} />
              <Text style={styles.aiLoadingTitle}>Analyzing accessibility barrier...</Text>
              <Text style={styles.aiLoadingSubtitle}>
                Looking for stairs, surface damage, obstructions and other mobility barriers.
              </Text>
            </View>
          )}

          {/* AI Error State */}
          {aiError && !isAnalyzing && (
            <View style={styles.aiErrorCard}>
              <View style={styles.aiErrorHeader}>
                <AlertTriangle color={theme.colors.error} size={20} />
                <Text style={styles.aiErrorTitle}>AI analysis could not be completed.</Text>
              </View>
              <Text style={styles.aiErrorText}>{aiError}</Text>
              <Text style={styles.aiErrorSubtext}>You can continue the report manually.</Text>
              <View style={styles.aiErrorActions}>
                <Pressable
                  style={styles.aiRetryBtn}
                  onPress={handleAnalyzeWithAI}
                  disabled={isAnalyzing}
                >
                  <RefreshCw color="#4F46E5" size={16} />
                  <Text style={styles.aiRetryBtnText}>Retry Analysis</Text>
                </Pressable>
                <Pressable style={styles.aiContinueManualBtn} onPress={() => setStep(2)}>
                  <Text style={styles.aiContinueManualBtnText}>Continue Manually</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* AI Suggestion Card */}
          {aiAnalysis && !isAnalyzing && !isEditingAi && (
            <View style={styles.aiCard}>
              <View style={styles.aiCardHeader}>
                <View style={styles.aiHeaderTitleWrap}>
                  <Sparkles color="#6366F1" size={18} />
                  <Text style={styles.aiCardTitle}>AI ANALYSIS</Text>
                </View>
                <View
                  style={[
                    styles.aiConfidenceBadge,
                    aiAnalysis.confidence >= 0.85
                      ? styles.confidenceHigh
                      : aiAnalysis.confidence >= 0.65
                      ? styles.confidenceMed
                      : styles.confidenceLow,
                  ]}
                >
                  <Text
                    style={[
                      styles.aiConfidenceText,
                      aiAnalysis.confidence >= 0.85
                        ? styles.confidenceTextHigh
                        : aiAnalysis.confidence >= 0.65
                        ? styles.confidenceTextMed
                        : styles.confidenceTextLow,
                    ]}
                  >
                    {confidenceLabel}
                  </Text>
                </View>
              </View>

              {isLowConfidence && (
                <View style={styles.lowConfidenceAlert}>
                  <AlertTriangle color="#D97706" size={16} />
                  <Text style={styles.lowConfidenceText}>
                    AI confidence is low. Please review this result carefully.
                  </Text>
                </View>
              )}

              <View style={styles.aiGrid}>
                <View style={styles.aiGridItem}>
                  <Text style={styles.aiGridLabel}>Barrier</Text>
                  <Text style={styles.aiGridValue}>
                    {BARRIER_TYPES.find(b => b.type === aiAnalysis.barrierType)?.label || aiAnalysis.barrierType}
                  </Text>
                </View>

                <View style={styles.aiGridItem}>
                  <Text style={styles.aiGridLabel}>Severity</Text>
                  <View
                    style={[
                      styles.severityMiniPill,
                      { backgroundColor: SEVERITIES.find(s => s.value === aiAnalysis.severity)?.color },
                    ]}
                  >
                    <Text style={styles.severityMiniPillText}>
                      {SEVERITIES.find(s => s.value === aiAnalysis.severity)?.label || aiAnalysis.severity}
                    </Text>
                  </View>
                </View>

                <View style={styles.aiGridItem}>
                  <Text style={styles.aiGridLabel}>Surface</Text>
                  <Text style={styles.aiGridValue}>
                    {aiAnalysis.surfaceCondition.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.aiGridItem}>
                  <Text style={styles.aiGridLabel}>Passability</Text>
                  <Text style={styles.aiGridValue}>
                    {aiAnalysis.estimatedPassability.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.aiDetectionsRow}>
                <Text style={styles.detectionItem}>
                  {aiAnalysis.obstructionDetected ? '✓ Obstruction' : 'No obstruction'}
                </Text>
                <Text style={styles.detectionDot}>•</Text>
                <Text style={styles.detectionItem}>
                  {aiAnalysis.stairsDetected === true
                    ? '✓ Stairs detected'
                    : aiAnalysis.stairsDetected === false
                    ? 'No stairs detected'
                    : 'Stairs: Unknown'}
                </Text>
                <Text style={styles.detectionDot}>•</Text>
                <Text style={styles.detectionItem}>
                  {aiAnalysis.rampDetected === true
                    ? '✓ Ramp detected'
                    : aiAnalysis.rampDetected === false
                    ? 'No ramp visible'
                    : 'Ramp: Unknown'}
                </Text>
              </View>

              <View style={styles.aiNoteBox}>
                <Text style={styles.aiNoteLabel}>AI note:</Text>
                <Text style={styles.aiNoteText}>"{aiAnalysis.reasoningSummary}"</Text>
              </View>

              <View style={styles.aiActionsRow}>
                <Pressable
                  style={styles.editAnalysisBtn}
                  onPress={handleStartEditAnalysis}
                >
                  <Edit3 color={theme.colors.text} size={16} />
                  <Text style={styles.editAnalysisBtnText}>Edit Analysis</Text>
                </Pressable>

                <Pressable style={styles.useSuggestionBtn} onPress={handleUseSuggestion}>
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.btnGradient}>
                    <Text style={styles.useSuggestionBtnText}>Use Suggestion</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}

          {/* Edit AI Analysis Form */}
          {isEditingAi && (
            <View style={styles.editAiCard}>
              <Text style={styles.editAiTitle}>Edit AI Suggestion</Text>
              <Text style={styles.editAiSubtitle}>
                Adjust the barrier details before continuing to the report form.
              </Text>

              <Text style={styles.label}>Barrier Type</Text>
              <View style={styles.pillContainer}>
                {BARRIER_TYPES.map(bt => {
                  const isSelected = barrierType === bt.type;
                  return (
                    <Pressable
                      key={bt.type}
                      onPress={() => setBarrierType(bt.type)}
                      style={{ overflow: 'hidden', borderRadius: 20 }}
                    >
                      <View style={[styles.pill, isSelected && styles.pillActive]}>
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {bt.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Severity Level</Text>
              <View style={styles.severityGrid}>
                {SEVERITIES.map(sev => {
                  const isSelected = severity === sev.value;
                  return (
                    <Pressable
                      key={sev.value}
                      style={[
                        styles.severityCard,
                        isSelected && { borderColor: sev.color, backgroundColor: sev.bgColor },
                      ]}
                      onPress={() => setSeverity(sev.value)}
                    >
                      <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                      <View style={styles.severityTextWrap}>
                        <Text style={[styles.severityLabel, isSelected && { color: sev.color }]}>
                          {sev.label}
                        </Text>
                        <Text style={styles.severityDesc}>{sev.desc}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Surface Condition</Text>
              <View style={styles.pillContainer}>
                {SURFACE_CONDITIONS.map(sc => {
                  const isSelected = editSurfaceCondition === sc.value;
                  return (
                    <Pressable
                      key={sc.value}
                      onPress={() => setEditSurfaceCondition(sc.value)}
                      style={{ overflow: 'hidden', borderRadius: 20 }}
                    >
                      <View style={[styles.pill, isSelected && styles.pillActive]}>
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {sc.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Passability</Text>
              <View style={styles.pillContainer}>
                {PASSABILITY_OPTIONS.map(po => {
                  const isSelected = editPassability === po.value;
                  return (
                    <Pressable
                      key={po.value}
                      onPress={() => setEditPassability(po.value)}
                      style={{ overflow: 'hidden', borderRadius: 20 }}
                    >
                      <View style={[styles.pill, isSelected && styles.pillActive]}>
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {po.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.editAiButtonRow}>
                <Pressable
                  style={styles.cancelEditBtn}
                  onPress={() => setIsEditingAi(false)}
                >
                  <Text style={styles.cancelEditBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.applyEditBtn}
                  onPress={handleSaveEditedAnalysis}
                >
                  <LinearGradient colors={[theme.colors.primary, '#004de6']} style={styles.btnGradient}>
                    <Text style={styles.primaryBtnText}>Confirm Edits & Continue</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}

          {/* Action Row if not analyzing and not currently editing */}
          {!isEditingAi && (
            <View style={styles.step1Actions}>
              {isImageAvailable && !aiAnalysis && (
                <Pressable
                  style={[styles.aiAnalyzeBtn, isAnalyzing && styles.disabledBtn]}
                  onPress={handleAnalyzeWithAI}
                  disabled={isAnalyzing}
                >
                  <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.btnGradient}>
                    <View style={styles.btnWithIcon}>
                      <Sparkles color="#FFFFFF" size={20} />
                      <Text style={styles.primaryBtnText}>Analyze with AI</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              )}

              <Pressable
                style={[styles.manualContinueBtn, !isImageAvailable && styles.primaryBtn]}
                onPress={() => setStep(2)}
              >
                {!isImageAvailable ? (
                  <LinearGradient colors={[theme.colors.primary, '#004de6']} style={styles.btnGradient}>
                    <Text style={styles.primaryBtnText}>Skip Photo / Continue</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.manualContinueBtnText}>
                    {aiAnalysis ? 'Continue Manually Without AI' : 'Continue Manually'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Locate Barrier</Text>
      <Text style={styles.stepSubtitle}>We need the GPS coordinates to accurately place this barrier on the accessibility map.</Text>

      <View style={styles.locationCard}>
        <View style={styles.locationCardIcon}>
          <MapPin color={theme.colors.primary} size={32} />
        </View>
        <Text style={styles.locationCardTitle}>Use GPS Location</Text>
        <Text style={styles.locationCardDesc}>Recommended for accurate routing penalties.</Text>
        
        <Pressable style={styles.locationBtn} onPress={handleGetLocation} disabled={isGettingLocation}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.btnGradient}>
            {isGettingLocation ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Get Current Location</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable style={styles.manualBtn} onPress={() => setStep(3)}>
        <Text style={styles.manualBtnText}>Skip / Select Manually on next step</Text>
      </Pressable>

      <View style={styles.navRow}>
        <Pressable style={styles.backBtn} onPress={() => setStep(1)}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        style={styles.stepScrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Barrier Details</Text>
        <Text style={styles.stepSubtitle}>Provide details about the accessibility issue.</Text>

        {originalSuggestion && (
          <View style={styles.aiAssistedBanner}>
            <Sparkles color="#6366F1" size={16} />
            <Text style={styles.aiAssistedBannerText}>
              AI-assisted values pre-filled ({Math.round(originalSuggestion.confidence * 100)}% confidence). You can review or edit any field below.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Select Affected Path *</Text>
          {suggestedSegment && (
            <View style={styles.gpsBadge}>
              <Navigation color={theme.colors.success} size={10} />
              <Text style={styles.gpsBadgeText}>GPS Match</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.segmentList} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
          {(() => {
            const currentRouteSegs = pathSegments.filter(s => routeSegmentIds.has(s.id));
            const otherSegs = pathSegments.filter(s => !routeSegmentIds.has(s.id));
            
            const renderSeg = (seg: PathSegment, isCurrentRoute: boolean) => {
              const isSelected = segmentId === seg.id;
              return (
                <Pressable
                  key={seg.id}
                  style={[
                    styles.segmentItem, 
                    isSelected && styles.segmentItemActive,
                    isCurrentRoute && styles.segmentItemLarge
                  ]}
                  onPress={() => setSegmentId(seg.id)}
                >
                  <View style={styles.segmentItemContent}>
                    {isCurrentRoute && (
                      <View style={styles.currentRouteBadge}>
                        <Text style={styles.currentRouteBadgeText}>CURRENT ROUTE</Text>
                      </View>
                    )}
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>
                      {getSegmentName(seg.id)}
                    </Text>
                    <Text style={styles.segmentIdText}>{seg.id}</Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            };

            return (
              <>
                {currentRouteSegs.length > 0 && (
                  <View style={styles.segmentSection}>
                    <Text style={styles.segmentSectionTitle}>AFFECTED PATH ON CURRENT ROUTE</Text>
                    {currentRouteSegs.map(seg => renderSeg(seg, true))}
                  </View>
                )}
                {otherSegs.length > 0 && (
                  <View style={styles.segmentSection}>
                    <Pressable 
                      style={styles.expandOtherBtn}
                      onPress={() => setShowOtherPaths(!showOtherPaths)}
                    >
                      <Text style={styles.segmentSectionTitle}>OTHER NEARBY PATHS</Text>
                      <Text style={styles.expandIconText}>{showOtherPaths ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                    {showOtherPaths && otherSegs.map(seg => renderSeg(seg, false))}
                  </View>
                )}
              </>
            );
          })()}
        </ScrollView>

        <Text style={styles.label}>Barrier Type *</Text>
        <View style={styles.pillContainer}>
          {BARRIER_TYPES.map(bt => {
            const isSelected = barrierType === bt.type;
            return (
              <Pressable
                key={bt.type}
                onPress={() => setBarrierType(bt.type)}
                style={{ overflow: 'hidden', borderRadius: 24 }}
              >
                <View style={[styles.pill, isSelected && styles.pillActive]}>
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{bt.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Severity Level *</Text>
        <View style={styles.severityGrid}>
          {SEVERITIES.map(sev => {
            const isSelected = severity === sev.value;
            return (
              <Pressable
                key={sev.value}
                style={[
                  styles.severityCard, 
                  isSelected && { borderColor: sev.color, backgroundColor: sev.bgColor }
                ]}
                onPress={() => setSeverity(sev.value)}
              >
                <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                <View style={styles.severityTextWrap}>
                  <Text style={[styles.severityLabel, isSelected && { color: sev.color }]}>{sev.label}</Text>
                  <Text style={styles.severityDesc}>{sev.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Additional Details (Optional)</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={3}
          maxLength={500}
          value={description}
          onChangeText={setDescription}
          placeholder="E.g., Construction blocking the entire sidewalk..."
          placeholderTextColor={theme.colors.textMuted}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>

      </ScrollView>

      <View style={styles.navRow}>
        <Pressable style={styles.backBtn} onPress={() => setStep(2)}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Pressable 
          style={[styles.primaryBtn, (!segmentId || !barrierType || !severity) && styles.disabledBtn]} 
          onPress={() => setStep(4)}
          disabled={!segmentId || !barrierType || !severity}
        >
          <LinearGradient colors={[theme.colors.primary, '#004de6']} style={styles.btnGradient}>
            <Text style={styles.primaryBtnText}>Review</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review & Submit</Text>
      <Text style={styles.stepSubtitle}>Please review the details before submitting to the live accessibility map.</Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.reviewCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.reviewImage} />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <ImageIcon color={theme.colors.borderStrong} size={32} />
              <Text style={styles.noImageText}>No Photo Provided</Text>
            </View>
          )}

          <View style={styles.reviewDataBox}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Path Segment</Text>
              <Text style={styles.reviewValue}>{getSegmentName(segmentId!)}</Text>
            </View>
            <View style={styles.reviewDivider} />
            
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Affects Current Route</Text>
              <Text style={[styles.reviewValue, routeSegmentIds.has(segmentId!) ? { color: theme.colors.success } : { color: theme.colors.textMuted }]}>
                {routeSegmentIds.has(segmentId!) ? 'Yes' : 'No'}
              </Text>
            </View>
            
            {!routeSegmentIds.has(segmentId!) && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>This barrier is not on your currently selected route, so your current route may not change.</Text>
              </View>
            )}
            <View style={styles.reviewDivider} />
            
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Barrier Type</Text>
              <Text style={styles.reviewValue}>{BARRIER_TYPES.find(b => b.type === barrierType)?.label}</Text>
            </View>
            <View style={styles.reviewDivider} />

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Severity</Text>
              <View style={[styles.severityPill, { backgroundColor: SEVERITIES.find(s => s.value === severity)?.color }]}>
                <Text style={styles.severityPillText}>{SEVERITIES.find(s => s.value === severity)?.label}</Text>
              </View>
            </View>

            {originalSuggestion && (
              <>
                <View style={styles.reviewDivider} />
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Report Source</Text>
                  <View style={styles.aiReviewBadge}>
                    <Sparkles color="#6366F1" size={12} />
                    <Text style={styles.aiReviewBadgeText}>
                      AI-Assisted ({Math.round(originalSuggestion.confidence * 100)}%)
                    </Text>
                  </View>
                </View>

                <View style={styles.reviewDivider} />
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>AI Suggested</Text>
                  <Text style={styles.reviewValue}>
                    {BARRIER_TYPES.find(b => b.type === originalSuggestion.barrierType)?.label} · {SEVERITIES.find(s => s.value === originalSuggestion.severity)?.label}
                  </Text>
                </View>

                <View style={styles.reviewDivider} />
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Modified by user</Text>
                  <Text style={[
                    styles.reviewValue,
                    (barrierType !== originalSuggestion.barrierType || severity !== originalSuggestion.severity)
                      ? { color: '#D97706', fontWeight: '800' }
                      : { color: theme.colors.success, fontWeight: '800' }
                  ]}>
                    {(barrierType !== originalSuggestion.barrierType || severity !== originalSuggestion.severity) ? 'Yes' : 'No'}
                  </Text>
                </View>
              </>
            )}

            {description ? (
              <>
                <View style={styles.reviewDivider} />
                <View style={styles.reviewRowCol}>
                  <Text style={styles.reviewLabel}>Notes</Text>
                  <Text style={styles.reviewValueNotes}>{description}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.warningBox}>
          <View style={styles.warningIconBox}>
            <Info color={theme.colors.primary} size={20} />
          </View>
          <Text style={styles.warningText}>
            Submitting this report will instantly recalculate route accessibility scores for affected mobility profiles in this area.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.navRow}>
        <Pressable style={styles.backBtn} onPress={() => setStep(3)}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.btnGradient}>
            <Text style={styles.primaryBtnText}>Submit Report</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report Barrier</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X color={theme.colors.text} size={24} />
          </Pressable>
        </View>
        {renderStepIndicator()}
        <View style={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Slightly off-white for better card contrast
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  stepDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary,
    width: 40,
  },
  stepDotCompleted: {
    backgroundColor: theme.colors.primary + '80', // semi-transparent primary
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  stepContainer: {
    flex: 1,
  },
  stepScrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  photoActions: {
    gap: 16,
    marginTop: 10,
  },
  photoCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
    shadowOpacity: 0.05,
  },
  photoIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  photoCardTextWrap: {
    flex: 1,
  },
  photoCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  photoCardDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadows.card,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 10,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
    shadowOpacity: 0.05,
    marginBottom: 20,
  },
  locationCardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  locationCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  locationCardDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  locationBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  manualBtn: {
    padding: 16,
    alignItems: 'center',
  },
  manualBtnText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success + '1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  gpsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.success,
  },
  segmentList: {
    maxHeight: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    ...theme.shadows.card,
    shadowOpacity: 0.03,
  },
  segmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  segmentItemActive: {
    backgroundColor: theme.colors.primary + '0A',
  },
  segmentItemContent: {
    flex: 1,
    paddingRight: 16,
  },
  segmentText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  segmentTextActive: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  segmentIdText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  segmentItemLarge: {
    paddingVertical: 20,
    backgroundColor: theme.colors.primary + '05',
  },
  currentRouteBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary + '1A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  currentRouteBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  expandOtherBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  expandIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  segmentSection: {
    marginBottom: 8,
  },
  segmentSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 24,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  severityGrid: {
    gap: 10,
  },
  severityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    ...theme.shadows.card,
    shadowOpacity: 0.03,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  severityTextWrap: {
    flex: 1,
  },
  severityLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  severityDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    color: theme.colors.text,
    ...theme.shadows.card,
    shadowOpacity: 0.02,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: 6,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
    shadowOpacity: 0.06,
  },
  reviewImage: {
    width: '100%',
    height: 180,
  },
  noImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  noImageText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  reviewDataBox: {
    padding: 20,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewRowCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  reviewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  reviewLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  reviewValueNotes: {
    fontSize: 15,
    color: theme.colors.text,
    marginTop: 6,
    lineHeight: 22,
  },
  severityPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  severityPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF', // light indigo
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  warningIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    ...theme.shadows.elevated,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    fontWeight: '600',
    lineHeight: 18,
  },
  navRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 20,
    backgroundColor: '#F9FAFB', // Match container
    marginTop: 'auto',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    ...theme.shadows.elevated,
  },
  btnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  backBtn: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  sampleFixturesSection: {
    marginTop: 20,
    marginBottom: 8,
  },
  sampleFixturesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sampleScroll: {
    flexDirection: 'row',
  },
  sampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  sampleChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  sampleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sampleChipTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  aiLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    ...theme.shadows.card,
  },
  aiLoadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 6,
    textAlign: 'center',
  },
  aiLoadingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  aiErrorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  aiErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiErrorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  aiErrorText: {
    fontSize: 13,
    color: '#B91C1C',
    marginBottom: 4,
  },
  aiErrorSubtext: {
    fontSize: 12,
    color: '#7F1D1D',
    marginBottom: 14,
  },
  aiErrorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  aiRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  aiRetryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  aiContinueManualBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiContinueManualBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  aiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    ...theme.shadows.card,
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  aiHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4338CA',
    letterSpacing: 0.8,
  },
  aiConfidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceHigh: {
    backgroundColor: '#DCFCE7',
  },
  confidenceMed: {
    backgroundColor: '#FEF3C7',
  },
  confidenceLow: {
    backgroundColor: '#FEE2E2',
  },
  aiConfidenceText: {
    fontSize: 12,
    fontWeight: '800',
  },
  confidenceTextHigh: {
    color: '#166534',
  },
  confidenceTextMed: {
    color: '#92400E',
  },
  confidenceTextLow: {
    color: '#991B1B',
  },
  lowConfidenceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lowConfidenceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  aiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  aiGridItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  aiGridLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  aiGridValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  severityMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  severityMiniPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  aiDetectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  detectionItem: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  detectionDot: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  aiNoteBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    marginBottom: 16,
  },
  aiNoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  aiNoteText: {
    fontSize: 13,
    color: '#1E293B',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  aiActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editAnalysisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editAnalysisBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  useSuggestionBtn: {
    flex: 1.4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  useSuggestionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  step1Actions: {
    gap: 12,
    marginTop: 20,
  },
  aiAnalyzeBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    ...theme.shadows.elevated,
  },
  btnWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manualContinueBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualContinueBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  editAiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...theme.shadows.card,
  },
  editAiTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  editAiSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  editAiButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelEditBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEditBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  applyEditBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  aiAssistedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  aiAssistedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
    lineHeight: 16,
  },
  aiReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiReviewBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4338CA',
  },
});
