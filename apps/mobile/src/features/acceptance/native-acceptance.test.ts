import Constants from 'expo-constants';
import { getNativeAcceptanceHarness, startNativeAcceptanceTools } from './native-acceptance';

const mockCreateAdapters = jest.fn(() => { throw new Error('must not load native adapters'); });
jest.mock('../journey/infrastructure/expo-journey-adapters', () => ({ createExpoJourneyAdapters: mockCreateAdapters }));
const initialExtra = Constants.expoConfig?.extra;
const initialDev = __DEV__;
afterEach(() => {
  Object.assign(globalThis, { __DEV__: initialDev });
  if (Constants.expoConfig) {
    if (initialExtra === undefined) delete Constants.expoConfig.extra;
    else Constants.expoConfig.extra = initialExtra;
  }
  jest.clearAllMocks();
});
test.each([
  [false, true, 'acceptance'], [true, false, 'acceptance'], [true, true, 'production'],
])('native entry is gated before adapter construction (%s, %s, %s)', async (dev, acceptanceTools, environment) => {
  Object.assign(globalThis, { __DEV__: dev });
  if (!Constants.expoConfig) throw new Error('test configuration unavailable');
  Constants.expoConfig.extra = { acceptanceTools, environment };
  expect(getNativeAcceptanceHarness()).toBeNull();
  await startNativeAcceptanceTools();
  expect(mockCreateAdapters).not.toHaveBeenCalled();
});
