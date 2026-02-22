# Feishu Claude App - Skill 配置

本项目可用的 Skill 分类整合。

## 系统内置 Skill

### git-auto-commit
- **用途**: 自动生成 Git 提交信息并提交
- **触发**: 用户请求自动提交代码时
- **命令**: `/git-auto-commit`

### ai-skill-generator
- **用途**: 生成和优化 AI Skills
- **触发**: 创建、更新 Skill 文档时

### claude-developer-platform
- **用途**: Claude API/SDK 开发支持
- **触发**: 构建 Claude/Anthropic 相关应用时

---

## 本项目特定 Skill (待扩展)

### feishu-api-debug
- **用途**: 调试飞书 API 请求
- **场景**: 消息拉取失败、token 过期等

### mcp-connection-test
- **用途**: 测试 MCP 连接状态
- **场景**: Claude 执行失败、连接断开等

---

## Skill 使用最佳实践

1. **明确触发条件**: 避免误触发无关 Skill
2. **优先级**: 项目特定 Skill > 通用 Skill
3. **文档化**: 每个 Skill 应有清晰的 SKILL.md 说明
