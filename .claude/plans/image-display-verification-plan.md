# 飞书图片显示功能验证计划

> 创建时间: 2026-03-09
> 验证团队: image-display-verification

---

## 验证目标

验证飞书图片显示功能的完整性和正确性，确保符合软件开发工作流规范。

---

## 验证范围

### 1. 代码实现完整性

| 组件 | 验证项 | 预期结果 |
|------|--------|----------|
| Message 类型 | `imageKey` 字段 | 类型定义正确 |
| MessageItem 组件 | 图片/文本消息渲染 | 组件正确实现 |
| MainPage | 集成 MessageItem | 状态传递正确 |
| 后端 API | `get_feishu_image` command | 正确注册和实现 |

### 2. 编译检查

| 检查项 | 命令 | 预期结果 |
|--------|------|----------|
| TypeScript 编译 | `npx tsc --noEmit` | 无错误 |
| Rust 编译 | `cargo check` | 无错误 |

### 3. E2E 测试

| 测试用例 | 文件 | 验证点 |
|----------|------|--------|
| 最近消息区域 | image-display.test.ts | 消息列表可见 |
| 消息类型标签 | image-display.test.ts | 图片/文本标签正确 |
| 组件导入 | image-display.test.ts | 无导入错误 |
| 加载图片按钮 | image-display.test.ts | 按钮存在 |
| 后端 command | image-display.test.ts | command 已注册 |
| 页面布局 | image-display.test.ts | 布局正常 |

---

## 验证步骤

### 步骤 1: 代码审查

1. 检查 `src/types/index.ts` 中 Message 类型
2. 检查 `src/components/MessageItem.tsx` 实现
3. 检查 `src/components/MainPage.tsx` 集成
4. 检查 `src-tauri/src/lib.rs` 后端实现

### 步骤 2: 编译验证

```bash
# TypeScript 检查
npx tsc --noEmit

# Rust 检查
cargo check --manifest-path src-tauri/Cargo.toml
```

### 步骤 3: E2E 测试

```bash
# 1. 启动 tauri-driver
tauri-driver --native-driver <path-to-msedgedriver>

# 2. 运行测试
npx wdio run wdio.conf.ts --spec tests/image-display.test.ts
```

### 步骤 4: 生成报告

- 记录验证结果
- 更新任务状态
- 生成验证报告

---

## 验收标准

- [ ] TypeScript 编译无错误
- [ ] Rust 编译无错误
- [ ] 所有 E2E 测试通过
- [ ] 验证报告已完成
