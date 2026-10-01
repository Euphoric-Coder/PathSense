import { BarrierReport, BarrierSeverity, BarrierType, ProfileId } from '../types/pathsense';

const SEVERITY_BASE_PENALTY: Record<BarrierSeverity, number> = {
  low: 5,
  moderate: 15,
  high: 30,
  critical: 50,
};

// Modifiers based on profile and barrier type
const PROFILE_TYPE_MODIFIERS: Record<BarrierType, Partial<Record<ProfileId, number>>> = {
  stairs: { wheelchair: 1.5, stroller: 1.4, crutches: 1.2, elderly: 1.2 },
  missing_ramp: { wheelchair: 1.5, stroller: 1.4, crutches: 1.2 },
  broken_surface: { wheelchair: 1.3, stroller: 1.3, crutches: 1.4, elderly: 1.3 },
  construction: { wheelchair: 1.2, stroller: 1.2, crutches: 1.2, elderly: 1.2, general: 1.1 },
  obstruction: { wheelchair: 1.3, stroller: 1.3 },
  narrow_path: { wheelchair: 1.4, stroller: 1.3 },
  drain_issue: { wheelchair: 1.4, crutches: 1.5 },
  waterlogging: { wheelchair: 1.3, crutches: 1.3, elderly: 1.2 },
  steep_gradient: { wheelchair: 1.4, elderly: 1.3, crutches: 1.3, stroller: 1.2 },
  other: {},
  'uneven-surface': { wheelchair: 1.3, stroller: 1.3, crutches: 1.4, elderly: 1.3 },
  'drain-cover-gap': { wheelchair: 1.4, crutches: 1.5 },
  encroachment: { wheelchair: 1.3, stroller: 1.3 },
};

export const calculateBarrierPenalty = (
  report: BarrierReport,
  profile: ProfileId
): { penalty: number; reason: string } => {
  if (report.status !== 'active' && report.status !== 'open' && report.status !== 'reported') {
    return { penalty: 0, reason: '' };
  }

  const basePenalty = SEVERITY_BASE_PENALTY[report.severity] || 0;
  const modifiers = PROFILE_TYPE_MODIFIERS[report.barrierType] || {};
  const profileModifier = modifiers[profile] || 1.0;

  const totalPenalty = Math.round(basePenalty * profileModifier);

  const barrierName = report.barrierType
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    penalty: totalPenalty,
    reason: `Reported Barrier: ${barrierName} (${report.severity})`,
  };
};

export const calculateCombinedBarrierPenalty = (
  reports: BarrierReport[],
  profile: ProfileId
): { penalty: number; details: { reason: string; deduction: number }[] } => {
  let totalPenalty = 0;
  const details: { reason: string; deduction: number }[] = [];

  const activeReports = reports.filter(
    (r) => r.status === 'active' || r.status === 'open' || r.status === 'reported'
  );

  activeReports.forEach((report) => {
    const { penalty, reason } = calculateBarrierPenalty(report, profile);
    if (penalty > 0) {
      totalPenalty += penalty;
      details.push({ reason, deduction: penalty });
    }
  });

  // Cap dynamic total penalty at 80
  if (totalPenalty > 80) {
    totalPenalty = 80;
  }

  return { penalty: totalPenalty, details };
};
