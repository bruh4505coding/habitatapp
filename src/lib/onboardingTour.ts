export type TourStep =
  | 'welcome'
  | 'settings'
  | 'tapHabitat'
  | 'overview'
  | 'surveys'
  | 'stewards'
  | 'propose'
  | 'bell'
  | 'wrapUp'
  | 'done';

export type TourCopy = {
  title: string;
  body: string;
  /** When false, hide Next (e.g. wait for map tap). Default true. */
  showNext?: boolean;
  nextLabel?: string;
};

const STEP_ORDER: TourStep[] = [
  'welcome',
  'settings',
  'tapHabitat',
  'overview',
  'surveys',
  'stewards',
  'propose',
  'bell',
  'wrapUp',
  'done',
];

export const TOUR_COPY: Record<Exclude<TourStep, 'done'>, TourCopy> = {
  welcome: {
    title: 'Welcome to myHabitat',
    body: 'Explore real habitats, meet steward groups, and propose new places for the community to care for.',
    nextLabel: 'Start tour',
  },
  settings: {
    title: 'Settings',
    body: 'Open Settings anytime for your profile, map location preferences, and account options.',
  },
  tapHabitat: {
    title: 'Tap a habitat',
    body: 'Each colored shape is a habitat boundary. Tap the green Demo Habitat to open it — you’ll see Overview (what’s there), Surveys (field checks), and Stewards (who cares for it).',
    showNext: false,
  },
  overview: {
    title: 'Overview',
    body: 'Start here: condition, management, characteristic species, learn links, and events for this place.',
  },
  surveys: {
    title: 'Surveys',
    body: 'Surveys are field checks that track habitat condition over time — upcoming visits and past notes.',
  },
  stewards: {
    title: 'Stewards',
    body: 'Steward groups care for the habitat: team, projects, and field work. On real habitats, this opens the full group page.',
  },
  propose: {
    title: 'Propose a habitat',
    body: 'This isn’t for everyone — if you officially manage or work to restore habitats, you can submit a boundary for review. Approved proposals become habitats on the live map.',
  },
  bell: {
    title: 'Notifications',
    body: 'The bell shows updates when your habitat proposals are approved or rejected.',
  },
  wrapUp: {
    title: 'That’s it!',
    body: 'You’re ready to explore. The live map with real habitats is next — replay this intro anytime from Settings.',
    nextLabel: 'Explore the map',
  },
};

type Listener = (step: TourStep | null) => void;

let currentStep: TourStep | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(currentStep));
}

export function getTourStep(): TourStep | null {
  return currentStep;
}

export function subscribeTourStep(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startTour(): void {
  currentStep = 'welcome';
  notify();
}

export function setTourStep(step: TourStep | null): void {
  currentStep = step;
  notify();
}

export function advanceTour(): void {
  if (!currentStep || currentStep === 'done') {
    currentStep = 'done';
    notify();
    return;
  }
  const idx = STEP_ORDER.indexOf(currentStep);
  const next = STEP_ORDER[idx + 1] ?? 'done';
  currentStep = next;
  notify();
}

/** Move one step earlier. No-op on welcome / done / null. */
export function retreatTour(): void {
  if (!currentStep || currentStep === 'done' || currentStep === 'welcome') {
    return;
  }
  const idx = STEP_ORDER.indexOf(currentStep);
  if (idx <= 0) return;
  currentStep = STEP_ORDER[idx - 1];
  notify();
}

export function canRetreatTour(step: TourStep | null = currentStep): boolean {
  if (!step || step === 'done' || step === 'welcome') return false;
  return STEP_ORDER.indexOf(step) > 0;
}

export function skipTour(): void {
  currentStep = 'done';
  notify();
}

export function isDetailTourStep(step: TourStep | null): boolean {
  return step === 'overview' || step === 'surveys' || step === 'stewards';
}

export function isMapChromeTourStep(step: TourStep | null): boolean {
  return (
    step === 'welcome'
    || step === 'settings'
    || step === 'tapHabitat'
    || step === 'propose'
    || step === 'bell'
    || step === 'wrapUp'
  );
}
