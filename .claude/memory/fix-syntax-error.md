# 记忆: 修复语法错误

> 记录时间: 2026-03-05
> 问题: 应用无法启动

---

## 问题描述

应用启动时报语法错误：

```
Unexpected token, expected "," (120:4)
```

## 根因分析

`MainPage.tsx` 第 116-118 行有多余的代码块：

```typescript
      setRefreshing(false);
      return;
    }

      setRefreshing(true);  // ← 这行多余
    }                        // ← 这个闭括号多余

    try {
```

## 解决方案

删除多余的代码块，修正为：

```typescript
      setRefreshing(false);
      return;
    }

    setRefreshing(true);

    try {
```

## 附加修复

第 377 行：useEffect 依赖数组格式错误
```typescript
// 错误
}, config)

// 正确
}, [config])
```

## 预防措施

1. 使用 ESLint 检测语法问题
2. 编写代码前先确保结构完整
3. 使用 TypeScript 严格模式

## 相关文件

- [src/components/MainPage.tsx](src/components/MainPage.tsx#L116-L118)
- [src/components/MainPage.tsx](src/components/MainPage.tsx#L377)
