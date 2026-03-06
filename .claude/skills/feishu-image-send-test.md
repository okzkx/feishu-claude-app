# 飞书图片发送测试技能

> 版本: 1.0
> 最后更新: 2026-03-06

## 概述

本技能用于实现飞书图片发送功能的完整 E2E 自动化测试，使用 tauri-driver + WebdriverIO 实现。

## 关键技术点

### 1. multipart/form-data 上传

Python 脚本和 TypeScript 实现的差异：

**Python (requests)**
```python
files = {
    "image": (filename, f),
    "image_type": (None, "message")
}
response = requests.post(UPLOAD_URL, headers=headers, files=files)
```

**TypeScript (Tauri)**
```typescript
// 生成符合 RFC 2046 规范的 boundary
const boundary = `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16)}`;

// 使用数组构建请求行
const headerLines = [
  `--${boundary}`,
  `Content-Disposition: form-data; name="image"; filename="image.png"`,
  `Content-Type: ${imageType}`,
  '',
];
```

### 2. Boundary 生成规则

- Python: 自动生成随机 boundary
- TypeScript: `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16)}`
- 确保每个部分以 `\r\n` 结尾
- 请求体以 `\r\n` 结束

### 3. 图片二进制数据处理

```typescript
// 合并 header + image + footer
const totalLength = headerBytes.length + imageBuffer.length + footerBytes.length;
const finalBody = new Uint8Array(totalLength);
finalBody.set(headerBytes, 0);
finalBody.set(imageBuffer, headerBytes.length);
finalBody.set(footerBytes, headerBytes.length + imageBuffer.length);
```

## 测试配置

### tauri-driver 配置

```typescript
// wdio.conf.ts
capabilities: [{
  browserName: 'wry',
  'tauri:options': {
    application: 'F:\\okzkx\\feishu-claude-app\\src-tauri\\target\\debug\\feishu-claude-app.exe'
  }
}]
```

### 测试准备

```bash
# 1. 下载 Edge WebDriver
# 2. 启动 tauri-driver
tauri-driver --native-driver "C:\path\to\msedgedriver.exe"

# 3. 运行测试
npx wdio run wdio.conf.ts --spec tests/image-send.test.ts
```

## 测试用例结构

### 核心测试步骤

1. **页面加载验证**
   - 检查"测试发送图片到飞书"按钮存在
   - 验证页面基本元素

2. **图片发送流程**
   - 点击测试按钮
   - 验证加载状态
   - 等待发送完成（30秒）
   - 验证成功消息

3. **错误验证**
   - 检查控制台无严重错误
   - 验证按钮状态恢复

## 坑点记录

### 1. multipart/form-data 格式
- **问题**: 手动构建的 multipart 可能格式不正确
- **解决**: 使用数组构建请求行，确保每个部分正确结束

### 2. 二进制数据合并
- **问题**: Uint8Array 合并时偏移量错误
- **解决**: 仔细计算 header 和 footer 的位置

### 3. Window 路径问题
- **问题**: tauri-driver 路径格式
- **解决**: 使用 `\\` 作为路径分隔符

### 4. 代码换行
- **问题**: 使用 `\n` 会导致 Mermaid 渲染失败
- **解决**: 使用 `<br/>` 作为换行符

## 最佳实践

1. **边界测试**: 使用 1x1 像素的透明 PNG 进行测试
2. **超时设置**: 设置合理的超时时间（30秒）
3. **截图保存**: 每个测试步骤保存截图
4. **错误检查**: 检查浏览器控制台错误日志

## 使用示例

```typescript
// 测试图片发送
const testImageButton = await browser.$("button*=测试发送图片到飞书");
await testImageButton.click();
await browser.pause(30000); // 等待发送完成
```

## 相关文件

- `src/utils/feishuApi.ts` - 图片上传实现
- `tests/image-send.test.ts` - 测试用例
- `MainPage.tsx` - 测试按钮实现