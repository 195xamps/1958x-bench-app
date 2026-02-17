/** Max plate dissipation in watts, used by the bias calculator */
export const TUBE_MAX_DISSIPATION: Record<string, number> = {
  '6V6': 14,
  '6L6GC': 30,
  'EL34': 25,
  'EL84': 12,
  '6550': 35,
  'KT66': 25,
  'KT88': 42,
  '6CA7': 25,
  '5881': 23,
};

export const TUBE_TYPES = Object.keys(TUBE_MAX_DISSIPATION);
