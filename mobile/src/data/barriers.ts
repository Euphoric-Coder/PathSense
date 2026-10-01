import { Barrier } from '@/src/types/pathsense';

export const barriers: Barrier[] = [
  {
    id: 'GH-B001',
    segmentId: 'GH-S007',
    type: 'uneven-surface',
    severity: 'moderate',
    description:
      'Pavers near East Lane are uneven and loose across a ~8 m stretch.',
    aiConfidence: 0.72,
    verificationCount: 0,
    status: 'reported',
    isMock: true,
  },
  {
    id: 'GH-B002',
    segmentId: 'GH-S016',
    type: 'stairs',
    severity: 'high',
    description:
      'Six steps at the pharmacy junction with no ramp — blocks wheelchair access.',
    aiConfidence: 0.94,
    verificationCount: 0,
    status: 'reported',
    isMock: true,
  },
  {
    id: 'GH-B003',
    segmentId: 'GH-S021',
    type: 'construction',
    severity: 'high',
    description:
      'Active utility works narrowing the footpath to ~0.5 m and leaving debris.',
    aiConfidence: 0.81,
    verificationCount: 0,
    status: 'reported',
    isMock: true,
  },
  {
    id: 'GH-B004',
    segmentId: 'GH-S013',
    type: 'drain-cover-gap',
    severity: 'moderate',
    description:
      'A drainage cover has a ~4 cm gap that can catch crutch tips and small wheels.',
    aiConfidence: 0.68,
    verificationCount: 0,
    status: 'reported',
    isMock: true,
  },
  {
    id: 'GH-B005',
    segmentId: 'GH-S008',
    type: 'encroachment',
    severity: 'moderate',
    description:
      'Temporary vendor stall extends into the path, reducing clear width to ~0.7 m.',
    aiConfidence: 0.59,
    verificationCount: 0,
    status: 'reported',
    isMock: true,
  },
];
