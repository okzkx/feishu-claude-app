# Team Memory - feishu-image-display

> 创建时间: 2026-03-09
> 团队类型: 项目级永久团队（请勿删除）

---

## 团队信息

**团队名称**: feishu-image-display
**团队目的**: 实现飞书消息图片显示功能
**团队类型**: 持久化团队 - DO NOT DELETE
**项目**: feishu-claude-app

---

## 团队成员

| 角色 | 姓名 | 职责 |
|------|------|------|
| Team Lead | team-lead | 总体协调、技术决策 |
| Frontend Specialist | frontend-dev | React 组件开发、UI 优化 |
| API Integration Expert | api-dev | 飞书 API 集成、图片获取 |

---

## 需求描述

**目标**: 在飞书消息列表中显示图片内容，而不是显示 `image_key`

**现状**:
- 最近消息只显示 `msgType === 'text'` 的消息
- 图片消息被过滤掉不显示

**期望**:
1. 图片消息也显示在最近消息列表中
2. 显示图片预览而非 `image_key`
3. 图片点击可查看大图

---

## 技术分析

### 飞书图片消息结构
```json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx-xxx\"}"
}
```

### 飞书图片下载 API
```
GET https://open.feishu.cn/open-apis/im/v1/images/{image_key}
Authorization: Bearer {tenant_access_token}
```

---

## 开发计划

详见 `.claude/plans/image-display-plan.md`

---

## 任务列表

详见 `.claude/tasks/`

---

## 技术积累

### 已解决

#### 2026-03-09: 图片消息显示功能

**需求**: 在消息列表中显示图片而非 image_key

**解决方案**:
1. 扩展 Message 类型添加 `imageKey` 字段
2. 修改 `parseContent` 方法提取 `image_key`
3. 创建 `MessageItem` 组件支持图片显示
4. 添加后端 `get_feishu_image` 代理认证请求
5. 使用 Blob URL 显示图片避免跨域问题

**技术要点**:
- 飞书图片 URL 需要 Authorization 认证，必须后端代理
- Blob URL 可将二进制数据转换为可显示的 URL
- 按需加载避免性能问题

**提交**: 2dbc114

**产出文档**:
- `.claude/memory/image-display-feature.md` - 功能实现文档
- `.claude/plans/image-display-plan.md` - 开发计划
- `src/components/MessageItem.tsx` - 图片显示组件

### 遇到的坑点
*开发中记录...*
