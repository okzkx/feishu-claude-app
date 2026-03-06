# 飞书图片发送测试指南

> 最后更新: 2026-03-06

## 测试前准备

### 1. 下载 Edge WebDriver

下载与 Edge 浏览器版本匹配的 msedgedriver.exe：
- https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/

下载后放到：
```
C:\Users\71411\AppData\Local\webdriver\msedgedriver.exe
```

### 2. 验证文件

确保以下文件存在：
- `src-tauri/target/debug/feishu-claude-app.exe`
- `C:\Users\71411\AppData\Local\webdriver\msedgedriver.exe`

### 3. 配置飞书 API

启动应用并配置：
- 飞书 App ID: `cli_a9103054e5f81ccd`
- 飞书 App Secret: `KxmSbUxLZUJ9ow31mXD1ehxE520jlFo2`
- 群聊 Chat ID: `oc_96920e7731db2fb82767ddb81f22d5f1`

## 运行测试

### 方法 1: 单独运行测试

```bash
# 1. 启动 tauri-driver
tauri-driver --native-driver "C:\Users\71411\AppData\Local\webdriver\msedgedriver.exe"

# 2. 在新终端运行测试
cd f:/okzkx/feishu-claude-app
npx wdio run wdio.conf.ts --spec tests/image-send.test.ts
```

### 方法 2: 运行所有测试

```bash
npx wdio run wdio.conf.ts
```

## 测试流程

### 自动化测试步骤

1. **启动应用**
   - tauri-driver 启动应用
   - 等待页面加载（3秒）

2. **页面验证**
   - 检查"测试发送图片到飞书"按钮存在
   - 验证本地测试区域显示正常

3. **发送测试图片**
   - 点击"测试发送图片到飞书"按钮
   - 验证按钮显示加载状态
   - 等待发送完成（30秒）

4. **结果验证**
   - 检查成功消息显示
   - 验证按钮状态恢复
   - 检查控制台无严重错误

## 验证结果

### 飞书群聊验证

1. 打开目标群聊
2. 查看是否收到图片消息
3. 验证图片可正常显示

### 测试结果文件

测试完成后查看：
- `test-results/image-send/` - 测试截图
- `test-results/` - 控制台输出

## 常见问题

### 问题 1: ECONNREFUSED

```
Error: Unable to connect to "http://localhost:4444/"
```

**原因**: tauri-driver 未启动

**解决**: 先启动 tauri-driver

### 问题 2: 应用进程被占用

```
error: failed to remove file `...feishu-claude-app.exe`
```

**原因**: 应用正在运行

**解决**:
```bash
taskkill /F /IM feishu-claude-app.exe
```

### 问题 3: 图片上传失败

```
上传图片失败: (code: 400)
```

**原因**: API 配置错误或格式问题

**解决**:
1. 检查飞书 API 凭证
2. 查看控制台错误日志
3. 验证 multipart 格式

## 测试用例

### Test 1: 应该成功发送图片到飞书
- 点击测试按钮
- 等待 30 秒
- 验证发送完成

### Test 2: 应该正确显示加载状态
- 点击测试按钮
- 验证按钮显示加载动画
- 验证发送完成后按钮恢复

### Test 3: 应该没有控制台严重错误
- 检查浏览器日志
- 过滤 SEVERE 级别
- 验证无 API 错误

### Test 4: 应该有本地测试区域和测试按钮
- 检查本地测试卡片存在
- 检查测试输入框存在
- 检查测试发送图片按钮存在
