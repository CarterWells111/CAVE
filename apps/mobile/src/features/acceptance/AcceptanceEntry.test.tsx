import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';
import Constants from 'expo-constants';
import { AcceptanceEntry } from './AcceptanceEntry';

const mockStartup = jest.fn(async () => {});
jest.mock('./native-acceptance', () => ({
  startNativeAcceptanceTools: () => mockStartup(),
  getNativeAcceptanceHarness: () => ({ getSnapshot: () => ({ busy: false }) }),
}));
jest.mock('./AcceptancePanel', () => ({ AcceptancePanel: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, SafeAreaProvider: View, SafeAreaInsetsContext: React.createContext(null) };
});
const initialExtra = Constants.expoConfig?.extra;
afterEach(() => {
  if (Constants.expoConfig) {
    if (initialExtra === undefined) delete Constants.expoConfig.extra;
    else Constants.expoConfig.extra = initialExtra;
  }
  jest.clearAllMocks();
});
test('disabled entry preserves children and never starts native acceptance', () => {
  if (!Constants.expoConfig) throw new Error('test config unavailable');
  Constants.expoConfig.extra = { acceptanceTools: true, environment: 'production' };
  const screen = render(<AcceptanceEntry><Text>应用内容</Text></AcceptanceEntry>);
  expect(screen.getByText('应用内容')).toBeTruthy();
  expect(screen.queryByText('P0 验收工具')).toBeNull();
  expect(mockStartup).not.toHaveBeenCalled();
});
test('acceptance entry resumes on mount and opens the panel only on user request', async () => {
  if (!Constants.expoConfig) throw new Error('test config unavailable');
  Constants.expoConfig.extra = { acceptanceTools: true, environment: 'acceptance' };
  const screen = render(<AcceptanceEntry><Text>应用内容</Text></AcceptanceEntry>);
  await waitFor(() => expect(mockStartup).toHaveBeenCalledTimes(1));
  expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
  fireEvent.press(screen.getByText('P0 验收工具'));
  expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true);
});
