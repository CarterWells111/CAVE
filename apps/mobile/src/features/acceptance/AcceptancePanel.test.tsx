import { fireEvent, render } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { AcceptancePanel } from './AcceptancePanel';
import { getNativeAcceptanceHarness } from './native-acceptance';

jest.mock('./native-acceptance', () => ({ getNativeAcceptanceHarness: jest.fn() }));
const getHarness = getNativeAcceptanceHarness as jest.Mock;
const initialExtra = Constants.expoConfig?.extra;
afterEach(() => {
  if (Constants.expoConfig) {
    if (initialExtra === undefined) delete Constants.expoConfig.extra;
    else Constants.expoConfig.extra = initialExtra;
  }
  jest.clearAllMocks();
});

test('panel is absent and does not acquire native dependencies without explicit acceptance config', () => {
  if (Constants.expoConfig) Constants.expoConfig.extra = { acceptanceTools: true, environment: 'production' };
  const screen = render(<AcceptancePanel />);
  expect(screen.toJSON()).toBeNull(); expect(getHarness).not.toHaveBeenCalled();
});
test('shows kill instructions at a pause and disables fixture writes until resumed', () => {
  if (!Constants.expoConfig) throw new Error('test config unavailable');
  Constants.expoConfig.extra = { acceptanceTools: true, environment: 'acceptance' };
  const resumePaused = jest.fn();
  const snapshot = { status: 'paused', busy: true, stage: 'delete-key' };
  getHarness.mockReturnValue({
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    startup: jest.fn(async () => {}), resumePaused,
  });
  const screen = render(<AcceptancePanel />);
  expect(screen.getByText(/现在可从系统强制结束/)).toBeTruthy();
  expect(screen.getByLabelText('创建 v11').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByText('继续当前运行'));
  expect(resumePaused).toHaveBeenCalledTimes(1);
});
