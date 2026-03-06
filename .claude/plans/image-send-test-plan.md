# 图片发送测试功能开发计划

> 项目: 飞书 Claude 应用
> 团队: image-send-test-team
> 日期: 2026-03-06

---

## 1. 准备工作

### 1.1 团队组建
- [x] 创建团队 `image-send-test-team`
- [x] 添加 Tester Agent
- [x] 添加 API Expert Agent
- [x] 创建项目记忆文档

### 1.2 文档准备
- [x] 创建项目记忆 (`memory/image-send-test.md`)
- [x] 创建开发计划 (`plans/image-send-test-plan.md`)
- [ ] 创建任务拆分 (`tasks/image-send-test.md`)

---

## 2. 技术分析

### 2.1 API 差异分析
- [ ] API Expert 分析 Python vs TypeScript 实现
- [ ] 确认 multipart/form-data 格式差异
- [ ] 检查请求头和参数一致性

### 2.2 测试框架分析
- [ ] Tester 分析现有测试文件
- [ ] 确认 tauri-driver 配置正确
- [ ] 验证测试用例完整性

---

## 3. 开发任务

### 3.1 API 修复（如需要）
- [ ] 修复 `feishuApi.ts` 中的 multipart/form-data 构建逻辑
- [ ] 确保 boundary 格式正确
- [ ] 测试图片上传功能

### 3.2 测试用例开发
- [ ] 完善 `image-send.test.ts`
  - [ ] 测试图片上传
  - [ ] 测试图片消息发送
  - [ ] 测试成功消息显示
  - [ ] 测试错误处理
- [ ] 更新 `image-message.test.ts`（如需要）

### 3.3 自动化测试
- [ ] 使用 tauri-driver 完整测试流程
  - [ ] 启动应用
  - [ ] 配置飞书 API
  - [ ] 点击"测试发送图片到飞书"按钮
  - [ ] 等待发送完成
  - [ ] 验证结果
- [ ] 确保无需人工干预

---

## 4. 测试执行

### 4.1 准备
- [ ] 编译 debug 版本应用
- [ ] 启动 tauri-driver
- [ ] 准备测试环境

### 4.2 执行
- [ ] 运行 `image-send.test.ts`
- [ ] 记录测试结果
- [ ] 保存截图

### 4.3 验证
- [ ] 验证图片在飞书群聊中显示
- [ ] 验证无控制台错误
- [ ] 验证加载状态正确显示

---

## 5. 文档整理

### 5.1 技术文档
- [ ] 编写图片发送 API 文档
- [ ] 编写测试指南
- [ ] 记录遇到的问题和解决方案

### 5.2 工作报告
- [ ] 撰写项目总结
- [ ] 记录坑点和难点
- [ ] 更新项目记忆

### 5.3 技能沉淀
- [ ] 提取图片发送测试 Skill
- [ ] 整合到项目级或用户级

---

## 6. 提交和清理

- [ ] 提交 Git
- [ ] 压缩上下文
- [ ] 保持团队不解散
