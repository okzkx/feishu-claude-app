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
*无*

### 遇到的坑点
*开发中记录...*
