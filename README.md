# KSXD Cookie Tool

一个基于 Electron 的桌面工具，用于打开快手小店登录页并在登录成功后提取 Cookie。

## 开发环境

```bash
npm install
npm start
```

## 本地打包

### Windows 安装版

```bash
npm run build:win
```

### Windows 单文件 EXE

```bash
npm run build:win:portable
```

### macOS 分发包

```bash
npm run build:mac
```

## GitHub Actions 云编译

仓库已经可以用 GitHub Actions 自动构建：

- Windows x64 单文件：`portable exe`
- macOS 分发文件：`dmg` + `zip`

工作流文件：

```text
.github/workflows/build.yml
```

触发方式：

1. 推送到 `main` 或 `master`
2. 打 `v*` 标签
3. 在 GitHub Actions 页面手动点击 `Run workflow`

构建完成后，在对应的 workflow run 页面下载产物：

- `windows-x64-portable`
- `macos-dmg-zip`

## 说明

### 为什么 Windows 用 portable

`portable` 目标会生成单文件 `.exe`，更符合“单文件版”的要求。

### 为什么 macOS 用 dmg + zip

```bash
npm run build:mac
```

`dmg` 是单文件分发包，`zip` 适合直接下载后解压使用。

### macOS 签名

当前 GitHub Actions 配置默认不做苹果签名和公证，所以下载后首次打开时，macOS 可能会提示安全限制。这属于未签名应用的正常表现。
