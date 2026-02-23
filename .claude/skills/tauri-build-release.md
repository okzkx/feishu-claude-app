# Skill: Tauri 应用打包发布

## 概述
为 Tauri 应用生成 Release 版本和安装包。

## 核心步骤

### 1. 配置 tauri.conf.json

```json
{
  "bundle": {
    "active": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "targets": ["msi", "nsis"],
    "windows": {
      "digestAlgorithm": "sha256"
    }
  }
}
```

### 2. 准备图标文件

在 `src-tauri/icons/` 目录下需要以下文件：
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.ico` (Windows)
- `icon.icns` (macOS)

### 3. 构建命令

```bash
# 仅生成 exe
npm run tauri build

# 生成 NSIS 安装包
npm run tauri build -- --bundles nsis

# 生成 MSI 安装包
npm run tauri build -- --bundles msi

# 生成所有格式
npm run tauri build -- --bundles all
```

### 4. 输出位置

```
src-tauri/target/release/
├── feishu-claude-app.exe          # 可执行文件 (~16MB)
└── bundle/
    ├── nsis/
    │   └── *_setup.exe            # NSIS 安装包 (~4MB)
    └── msi/
        └── *.msi                  # MSI 安装包
```

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| Couldn't find a .ico icon | 确保 icons/ 目录有所有图标文件 |
| 构建失败 | 检查 tauri.conf.json 语法 |
| 图标显示不正确 | 使用正确的尺寸和格式 |

## 注意事项

1. **identifier 不要以 .app 结尾** - 与 macOS 应用包冲突
2. **图标尺寸** - 建议至少 128x128，推荐 256x256
3. **代码签名** - 生产环境需要配置证书

## 相关文件
- `src-tauri/tauri.conf.json` - 配置文件
- `src-tauri/icons/` - 图标目录
- `src-tauri/target/release/` - 输出目录
