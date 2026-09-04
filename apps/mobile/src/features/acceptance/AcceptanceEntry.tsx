import { useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { isAcceptanceToolsEnabled } from './acceptance-harness';
import { AcceptancePanel } from './AcceptancePanel';
import { getNativeAcceptanceHarness, startNativeAcceptanceTools } from './native-acceptance';

export function AcceptanceEntry({ children }: PropsWithChildren) {
  if (!isAcceptanceToolsEnabled(__DEV__, Constants.expoConfig?.extra)) return <>{children}</>;
  return <EnabledAcceptanceEntry>{children}</EnabledAcceptanceEntry>;
}

function EnabledAcceptanceEntry({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  useEffect(() => { void startNativeAcceptanceTools(); }, []);
  const close = () => {
    if (!getNativeAcceptanceHarness()?.getSnapshot().busy) setVisible(false);
  };
  return <View style={styles.container}>
    {children}
    <Pressable accessibilityRole="button" accessibilityLabel="P0 验收工具"
      style={[styles.entry, { bottom: insets.bottom + 76, right: insets.right + 12 }]}
      onPress={() => setVisible(true)}><Text style={styles.entryText}>P0 验收工具</Text></Pressable>
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom', 'left', 'right']}>
          {visible && <AcceptancePanel onClose={close} />}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  entry: { position: 'absolute', backgroundColor: '#355744', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, zIndex: 100 },
  entryText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#f4f0e8' },
});
