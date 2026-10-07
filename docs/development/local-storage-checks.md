# 本地存储检查

本检查用于 SQLCipher 探测失败判定、迁移中断及删除恢复。仅使用合成数据；所有测试和报告留在本地。

## 自动检查

在仓库根目录使用 `.nvmrc` 指定的 Node 22.23.2 和已有工作区依赖：

```powershell
node scripts/check-native-storage.mjs
```

入口运行 9 组相关 Jest 测试，结果写入 `outputs/local-storage-checks/checks.json`。报告只记录计数、退出码、时间、源码基准和验证范围；不保存原始 SQL、密钥或业务正文。任何失败、缺少测试结果或跳过用例都会让命令非零退出。

新增 SQLCipher 探测负例涵盖无/错密钥仍可读取、正确密钥读取失败或缺行、各连接缺少能力、关闭失败及恢复后重试。它们使用能力替身，验证失败判定和连接生命周期，不证明磁盘加密。

新增进程恢复测试使用真实 SQLite 文件。父进程等到实际验收 harness 显示暂停后，强制终止子进程，再启动独立新进程：

- 迁移提交前中断：确认回滚到 v11，原计数和结构保留，再升级到当前 v13。
- 全部 9 个删除暂停点：确认自动续删，数据库、WAL/SHM、合成密钥/档案/令牌/会话/成人声明/删除意图均不存在，恢复期间没有打开或重建数据库。

持久化 SecureStore 替身仅在测试创建的临时目录中存放合成值；测试结束检查目录边界后清理。它不等于 iOS Keychain，也不验证断电或硬件故障。

## 手机原生检查

已有 Development Build 可先加载本地 `acceptance-staging` Metro。电脑启动参数为：

```powershell
node scripts/start-mobile.mjs acceptance-staging --host lan --port 8084
```

沿用当前热点 `REACT_NATIVE_PACKAGER_HOSTNAME`；保持 `EXPO_OFFLINE=1`、`CI=false`。从 Development Build 启动器重新打开同一 8084 项目，确认“P0 验收工具”出现。

原生检查只作用于 `cave-acceptance.db`、`cave.acceptance.*` 和合成档案。

1. 空合成存储中点“创建 v11”，然后点“SQLCipher 无密钥 / 错密钥 / 正确密钥探测”。四个布尔结果都应为 true。`noKey`/`wrongKey` 为 true 表示读取被拒绝。
2. SQLCIPHER_UNAVAILABLE 或任意 error 必须记为失败；不要清空真实数据库或卸载应用掩盖问题。
3. 迁移暂停按钮目前名为“迁移到 v12 提交前暂停”。暂停后在系统多任务界面结束应用，重开并检查元数据应为 v11；手动升级后应为 v13。
4. 删除中断仅点击面板内“删除全部合成验收数据”。逐个选取 9 个暂停点，等待 paused，再从系统结束应用。重开后所有 Present 和 deletionPending 应为 false。先检查结果，再创建下一份夹具。
5. 不用“继续当前运行”代替系统结束。手机结果须由实际操作记录；本机 Node 的 SIGKILL 不能替代 iOS 强制结束验收。

创建夹具时若报 STORE_NOT_EMPTY，说明已有合成存储；先查看元数据并保留需诊断的结果，再明确清理合成数据。工具不自动覆盖已有夹具。

账号隔离本轮由用户确认完成。原生 SQLCipher、Keychain 和 iOS 强制结束恢复仍须按手机实际结果单独记录；测试脚本不会把它们自动标为通过。
