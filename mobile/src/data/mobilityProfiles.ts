import { MobilityProfile, ProfileId } from '@/src/types/pathsense';

export const mobilityProfiles: MobilityProfile[] = [
  {
    id: 'wheelchair',
    label: 'Wheelchair',
    description: 'Prioritizes step-free, sufficiently wide and smooth paths.',
  },
  {
    id: 'crutches',
    label: 'Crutches / Temporary Injury',
    description:
      'Avoids difficult surfaces, stairs and steep gradients.',
  },
  {
    id: 'elderly',
    label: 'Reduced Mobility',
    description:
      'Prioritizes stable surfaces, low gradients and reduced physical effort.',
  },
  {
    id: 'stroller',
    label: 'Stroller',
    description: 'Prioritizes step-free paths, width and smooth surfaces.',
  },
  {
    id: 'general',
    label: 'General Mobility',
    description:
      'Primarily balances normal walkability with fewer accessibility penalties.',
  },
];

export const DEFAULT_PROFILE: ProfileId = 'wheelchair';
