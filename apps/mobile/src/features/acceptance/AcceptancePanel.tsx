import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { ACCEPTANCE_FIXTURES, DELETION_STAGES, isAcceptanceToolsEnabled, type AcceptanceHarness } from './acceptance-harness';
import type { DeleteAllDataStage } from '../../core/privacy/delete-all-data';

const stageNames = {
  'record-intent': '删除意图已持久化', 'clear-gate': '成人声明已删除', quiesce: '写入已静止、连接已关闭',
  'delete-key': '数据库密钥已删除', 'remove-files': '数据库及 WAL/SHM 已删除',
  'delete-account-profiles': '合成档案已删除', 'delete-token': '合成令牌已删除',
  'delete-auth-session': '合成会话已删除', 'clear-intent': '删除意图已清除',
  'migration-v12-before-commit': 'v12 版本已写入、事务尚未提交',
} as const;
const errorNames: Record<string, string> = {
  STORE_NOT_EMPTY: '合成存储不为空。先明确删除合成数据，再创建夹具。',
  FIXTURE_REQUIRED: '请先创建合成历史夹具。',
  DELETION_PENDING: '存在待完成删除，请重启应用或点击恢复检查。',
  SQLCIPHER_UNAVAILABLE: '此原生构建未提供 SQLCipher。请使用验收开发构建。',
  MIGRATION_FAULT_INJECTED: '已注入迁移故障。检查版本应仍为 11，再重试升级。',
  MIGRATION_STAGE_NOT_REACHED: '未到达 v12 迁移暂停点；夹具可能已升级。请删除合成数据并重新创建历史夹具。',
  OPERATION_FAILED: '操作失败，已隐藏底层错误内容。保留当前数据，可重试或明确删除合成数据。',
};

export function AcceptancePanel({ onClose }: { onClose?: (() => void) | undefined }) {
  if (!isAcceptanceToolsEnabled(__DEV__, Constants.expoConfig?.extra)) return null;
  return <EnabledAcceptancePanel onClose={onClose} />;
}

function EnabledAcceptancePanel({ onClose }: { onClose?: (() => void) | undefined }) {
  const [harness] = useState<AcceptanceHarness | null>(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native code must not load before the explicit acceptance gate.
    const { getNativeAcceptanceHarness } = require('./native-acceptance') as typeof import('./native-acceptance');
    return getNativeAcceptanceHarness();
  });
  if (!harness) return null;
  return <AcceptanceControls harness={harness} onClose={onClose} />;
}

function AcceptanceControls({ harness, onClose }: { harness: AcceptanceHarness; onClose?: (() => void) | undefined }) {
  const state = useSyncExternalStore(harness.subscribe, harness.getSnapshot, harness.getSnapshot);
  const [pauseAfter, setPauseAfter] = useState<DeleteAllDataStage | undefined>();
  useEffect(() => { void harness.startup(); }, [harness]);
  function button(title: string, action: () => void, disabled = state.busy) {
    return <Pressable key={title} accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ disabled }} disabled={disabled} onPress={action}
      style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
  }
  return <ScrollView contentContainerStyle={styles.content} testID="acceptance-panel">
    <Text style={styles.title}>P0 原生存储验收</Text>
    <Text style={styles.copy}>仅验收开发构建可用。所有操作限定在 cave-acceptance.db、cave.acceptance.* 密钥与合成档案文件。</Text>
    <Text style={styles.copy}>先创建夹具，再升级并检查。SQLCipher 三种连接探测须在真机运行；界面显示的结果仅属于本次运行。</Text>
    <View accessibilityLiveRegion="polite" style={styles.result}>
      <Text style={styles.copy}>状态：{state.status} · 操作：{state.operation ?? '等待选择'}</Text>
      {state.stage && <Text style={styles.copy}>阶段：{stageNames[state.stage]}</Text>}
      {state.status === 'paused' && <Text style={styles.notice}>现在可从系统强制结束应用，然后重新启动。不要点“继续”来代替强制结束。删除会按持久化意图恢复；迁移应回滚未提交事务，再手动升级。</Text>}
      {state.error && <Text style={styles.notice}>{errorNames[state.error] ?? '检查未通过；请保留结果并重试。'} ({state.error})</Text>}
      {state.metadata && <Text selectable style={styles.metadata}>{JSON.stringify(state.metadata, null, 2)}</Text>}
      {state.checks && <Text selectable style={styles.metadata}>{JSON.stringify(state.checks, null, 2)}</Text>}
    </View>
    {state.status === 'paused' && button('继续当前运行', () => harness.resumePaused(), false)}
    {button('恢复检查（只在意图存在时续删）', () => { void harness.startup(); })}
    {ACCEPTANCE_FIXTURES.map((id) => button(`创建 ${id}`, () => { void harness.createFixture(id); }))}
    {button('升级历史夹具', () => { void harness.upgrade(); })}
    {button('迁移到 v12 提交前暂停', () => { void harness.upgrade('pause'); })}
    {button('迁移到 v12 提交前注入故障', () => { void harness.upgrade('fault'); })}
    {button('检查元数据（不升级）', () => { void harness.inspect(); })}
    {button('SQLCipher 无密钥 / 错密钥 / 正确密钥探测', () => { void harness.probeCipher(); })}
    {button('钥匙串瞬时读取失败与重试', () => { void harness.keychainDiagnostic(); })}
    <Text style={styles.heading}>删除暂停点</Text>
    <Text style={styles.copy}>暂停发生在该步骤完成之后。最后一步清除意图后重启不会续删，也不会重建密钥。</Text>
    {button(`${pauseAfter === undefined ? '● ' : ''}不暂停`, () => setPauseAfter(undefined))}
    {DELETION_STAGES.map((stage) => button(`${pauseAfter === stage ? '● ' : ''}${stageNames[stage]}`, () => setPauseAfter(stage)))}
    {button('删除全部合成验收数据', () => { void harness.deleteSyntheticData(pauseAfter); })}
    {onClose && button('关闭验收面板', onClose)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 48, paddingBottom: 60, gap: 10, backgroundColor: '#f4f0e8' },
  title: { color: '#252c25', fontSize: 23, fontWeight: '700' },
  heading: { color: '#252c25', fontSize: 18, fontWeight: '600', marginTop: 12 },
  copy: { color: '#303b32', fontSize: 14, lineHeight: 21 },
  notice: { color: '#802800', fontSize: 15, lineHeight: 23 },
  result: { padding: 12, backgroundColor: '#ffffff', borderRadius: 8, gap: 8 },
  metadata: { color: '#29342d', fontSize: 12, lineHeight: 18 },
  button: { padding: 13, backgroundColor: '#355744', borderRadius: 8 },
  buttonText: { color: '#ffffff', fontSize: 14 }, disabled: { opacity: 0.4 },
});
