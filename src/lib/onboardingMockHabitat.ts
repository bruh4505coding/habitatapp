/**
 * Static tutorial habitat — no Supabase dependency.
 * Shape matches WorldMapScreen `Habitat`.
 *
 * Boundary sourced from assets/onboarding/demo-habitat.kml
 */
export const ONBOARDING_DEMO_HABITAT_ID = 'onboarding-demo';

export const ONBOARDING_DEMO_HABITAT = {
  id: ONBOARDING_DEMO_HABITAT_ID,
  name: 'Demo Habitat',
  habitat_code: 'DEMO-001',
  habitat_type: 'Coastal meadow',
  region: 'Tutorial',
  color: '#4caf50',
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [-122.5207760388088, 37.59357347058774],
        [-122.5200359283173, 37.59297267800083],
        [-122.5170739188008, 37.59105871593921],
        [-122.5170695167262, 37.58913663342344],
        [-122.5170617898678, 37.58740420212828],
        [-122.5167473960901, 37.58594543585976],
        [-122.5151857717136, 37.58571965779016],
        [-122.5149003738997, 37.58520729389607],
        [-122.515146552207, 37.58459988175812],
        [-122.5145290866202, 37.5850505581359],
        [-122.5106849385069, 37.58557545201458],
        [-122.5077287017501, 37.58500280895674],
        [-122.5046334051773, 37.58593004748412],
        [-122.5038601753658, 37.58834842199823],
        [-122.5036962093104, 37.5892830959747],
        [-122.5020328731298, 37.58980461126825],
        [-122.5037730321117, 37.5926183160125],
        [-122.5067779829063, 37.59292505781221],
        [-122.5096795955774, 37.59017646840212],
        [-122.5117910859947, 37.5901931502337],
        [-122.5109377246475, 37.59154026015688],
        [-122.5111571659956, 37.59285157982718],
        [-122.512159492921, 37.59328642811025],
        [-122.5130838434782, 37.59404062309543],
        [-122.5131083161222, 37.59441731455373],
        [-122.5133755060917, 37.59574182878089],
        [-122.5144937003267, 37.59630259703638],
        [-122.5150292639643, 37.59589864001257],
        [-122.5164258401547, 37.5953140696923],
        [-122.5181591764845, 37.5951366801504],
        [-122.52002258304, 37.59473232224141],
        [-122.5210374258214, 37.59431125089685],
        [-122.5207760388088, 37.59357347058774]
      ],
    ],
  },
};

export const ONBOARDING_DEMO_OVERVIEW = {
  conditionRating: 4,
  managementType: 'park',
  managementCustom: null as string | null,
  featureImageUrl: null as string | null,
  learnLinks: [
    {
      title: 'What is a coastal meadow?',
      url: 'https://www.nps.gov/',
    },
  ],
  events: [
    {
      title: 'Weekend restoration day',
      description: 'Join stewards for a hands-on habitat workday.',
    },
  ],
  characteristicFlora: ['California poppy', 'Coyote brush', 'Native bunchgrass'],
  characteristicFauna: ['Anna’s hummingbird', 'Western fence lizard'],
  stewardGroup: {
    id: 'onboarding-demo-group',
    name: 'Demo Stewards',
  },
  lastSurveyAt: '2026-06-15',
};
