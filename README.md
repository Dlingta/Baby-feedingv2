# 🪐 未知漫游者的登陆手帐（Baby Planet Diary）

> 面向新手父母的温暖星际手绘风移动端宝宝记录应用 —— 集**日常喂养与排便记录、拍照识别保姆纸质记录本、WHO 成长曲线观测、全周期疫苗护盾管理、生病病历档案、语音口述日记整理**于一体，支持 **Vercel Web / PWA** 部署及 **Capacitor 打包为原生 iOS App**。

---

## ✨ 核心功能

### 1. 🪐 星际主页（总览看板）
- 展示宝宝昵称、出生天数/月龄与今日关键照护指标（今日总奶量、亲喂时长、大小便次数）。
- 首页直达「下一针疫苗打卡」与各核心模块的快捷入口。
- 支持多家庭成员身份切换（如妈妈、爸爸、外婆、阿姨等记录人）。

### 2. 🍼 能量补给站（喂养、排便与拍照识字导入）
- **多维度日常记录**：支持配方奶（ml）、瓶喂母乳（ml）、亲喂（时长/左右侧）、辅食、小便与大便（性状/备注）记录，按天归档展示时间轴与统计汇总。
- **📸 拍照识别纸质记录本（AI 视觉导入）**：
  - 点击即可直接调起 iPhone 原生相机拍照或选取相册照片。
  - 前端自动通过 Canvas 将图片等比压缩至最长边 ≤ 1280px（JPEG 0.8），避免移动端弱网超时。
  - 后端经 Vercel Serverless Function（`/api/recognize`）调用智谱视觉模型 **`glm-4v-flash`**，自动提取纸面上的日期与多行喂养/大小便记录。
  - 弹出可编辑核对抽屉：支持修改单条类型/时间/数值/备注、**修改记录归属日期（方便次日或跨天补录）**、手动补录及一键批量存入。
- **📝 纯本地文本解析导入**：配合 iOS 原生「实况文本 / 扫描文本」，支持在无网环境下通过本地正则解析器快速导入纸质记录。

### 3. 📏 成长观测站（WHO 生长发育评估）
- 持续记录宝宝的身高（cm）、体重（kg）、头围（cm）变化。
- 内置 **`who-growth-standards`** 世界卫生组织儿童生长标准数据，按宝宝性别（男宝 / 女宝）与月龄自动计算百分位并绘制成长趋势。

### 4. 🛡️ 治愈工坊（全周期疫苗护盾 & 生病病历）
- **疫苗护盾（出生 24h 内至 9 岁）**：
  - 完整对照社区预防接种门诊知情告知表，清晰划分 **免疫规划疫苗（国家免费·必打）** 与 **非免疫规划疫苗（自愿自费·可选）**，支持一键按分类筛选。
  - 完整支持 **二选一 / 多选一 / 免费与自费替代升级** 选型：
    - 1.5 / 2.5 / 3.5 月龄轮状病毒：**五价进口（默沙东·乐儿德）** vs **三价国产（兰生所）**
    - 13 价肺炎：**进口辉瑞·沛儿 13** vs **国产沃森·沃安欣** vs **国产康泰民海·维民菲宝**
    - 脊灰 + 百白破免费方案 vs **进口五联（赛诺菲·潘太欣）** / **国产四联（康泰民海）** / **单苗 Hib**
    - 免费流脑 A / AC 多糖 vs **自费 AC 结合 / ACYW135 多糖 / 四价结合（康希诺·曼海欣）**
    - 免费乙脑/甲肝减毒 vs **自费灭活替代**
    - EV71 手足口、水痘、季节性流感、单价口服轮状及 9 岁女孩 HPV（按宝宝性别自动过滤不适用项）
  - 勾选具体方案后自动填充接种方式（免费/自费）、产地（国产/进口）、具体品牌厂家与参考费用，并内置门诊接种温馨提示。
- **生病记录与病历档案**：
  - 记录发热体温、伴随症状标签、居家用药、就诊医院与医生诊断。
  - 支持最多上传 4 张病历/化验单照片，支持按症状分类和日期快速检索。

### 5. 📖 星际日记（语音口述 + 智能去语气词）
- 记录宝宝每天的成长瞬间，支持配图、日期归档与多记录人标注。
- **🎤 语音写日记 + 自动整理**：
  - 基于浏览器原生 `SpeechRecognition / webkitSpeechRecognition` 实时语音听写（不支持时提供 iPhone 键盘听写友好引导）。
  - 停止录音后自动请求 Vercel `/api/polish`（智谱文本模型 **`glm-4-flash`**），删除“嗯、啊、呃、那个、然后呢”等口语语气词与重复废话、修正同音错别字、补全标点与分段，同时保留父母口述的原汁原味，不做浮夸散文改写。
  - **性别代词自动适配**：自动读取宝贝档案中的性别设置，女宝统一校对为「她」，男宝统一校对为「他」。
  - 支持「✨ 手动整理语气词」与「撤销整理」一键还原原始口述稿。

### 6. ⚙️ 宝贝档案与数据管理
- 宝贝信息设置（昵称、性别、出生日期、家庭记录人管理）。
- 本地优先存储（`localStorage`）+ JSON 数据导出/导入备份。
- 内置 Capacitor iOS 桥接层与 CloudKit 家庭共享原生扩展模板，支持向原生 iOS App 演进。

---

## 🛠️ 技术栈

| 类别 | 技术选型 |
| :--- | :--- |
| **前端框架** | React 19 + TypeScript + Vite 8 |
| **样式与动效** | Tailwind CSS v4 + Motion (`motion/react`) + Lucide React |
| **生长标准** | `who-growth-standards` |
| **移动端与原生能力** | Capacitor 8（`@capacitor/ios`, `haptics`, `share`, `status-bar`）+ `vite-plugin-pwa` |
| **后端中转（Serverless）** | Vercel Serverless Functions（`/api/recognize.ts`, `/api/polish.ts`） |
| **AI 模型能力** | 智谱 AI `glm-4v-flash`（纸质喂养记录识别）、`glm-4-flash`（日记语音稿整理） |

---

## 📂 目录结构

```text
.
├── api/                          # Vercel Serverless Functions（安全中转智谱 AI，不暴露 Key）
│   ├── recognize.ts              # 拍照识别保姆手写纸质喂养记录（glm-4v-flash）
│   └── polish.ts                 # 语音日记去除语气词 & 按宝宝性别统一“他/她”（glm-4-flash）
├── ios-native/                   # iOS 原生 Xcode 配置与 CloudKit 扩展参考
│   ├── IOS_XCODE_GUIDE.md        # iOS 打包与 Xcode 配置说明
│   ├── AppDelegate+CloudKit.swift
│   ├── MyViewController.swift
│   └── Plugins/
├── public/                       # 静态资源、手绘插画与 PWA 图标
├── src/
│   ├── components/               # 通用导航、手绘插画容器、纸质记录扫描抽屉、PWA 安装按钮等
│   ├── data/
│   │   ├── initialData.ts        # 初始状态与日期辅助函数
│   │   └── vaccineCatalog.ts     # 全周期预防接种门诊疫苗目录、可选方案与数据迁移逻辑
│   ├── hooks/                    # 自定义 Hooks
│   ├── modules/growth/           # WHO 成长曲线与百分位计算模块
│   ├── native/iosBridge.ts       # Capacitor / iOS 原生能力桥接（触感反馈、分享、状态栏等）
│   ├── screens/
│   │   ├── HomeScreen.tsx        # 星际主页
│   │   ├── FeedingScreen.tsx     # 能量补给站（喂养/排便/拍照识字）
│   │   ├── GrowthScreen.tsx      # 成长观测站（WHO 曲线）
│   │   ├── HealthScreen.tsx      # 治愈工坊（疫苗护盾 & 生病病历）
│   │   ├── DiaryScreen.tsx       # 星际日记（语音写日记 + 语气词整理）
│   │   └── SettingsScreen.tsx    # 档案、记录人与备份设置
│   ├── types/planet.ts           # 全局 TypeScript 数据结构定义
│   └── utils/
│       ├── feedingPhoto.ts       # Canvas 图片压缩与 /api/recognize 请求封装
│       ├── paperLogParser.ts     # 纯前端本地实况文本正则解析器
│       ├── diaryPolish.ts        # /api/polish 语音稿整理请求封装
│       └── stateMerge.ts         # 状态合并与同步辅助
├── capacitor.config.ts           # Capacitor iOS 应用配置
├── vercel.json                   # Vercel 函数超时配置（30s）
├── vite.config.ts                # Vite 与 PWA 构建配置
└── .env.example                  # 环境变量示例
```

---

## 🚀 快速开始

### 1. 环境准备
- Node.js `>= 18`（推荐 20+）
- 如需构建 iOS 原生 App：macOS + Xcode 15+ + CocoaPods

### 2. 安装依赖与本地启动

```bash
# 安装依赖
npm install

# 启动本地开发服务器（默认监听 http://localhost:3000）
npm run dev
```

> **提示**：单独运行 `npm run dev` 启动的是 Vite 前端服务，日常喂养、成长曲线、疫苗、生病记录、本地文本解析均可正常使用；如需在本地调试 `/api/recognize` 和 `/api/polish` 两个 Serverless 接口，建议使用 [Vercel CLI](https://vercel.com/docs/cli) 运行：
>
> ```bash
> npx vercel dev
> ```

### 3. 环境变量配置

复制 `.env.example` 为 `.env.local`（或在 Vercel 控制台配置）：

```env
# 智谱 AI 开放平台 API Key（仅服务端读取，绝不暴露到前端）
ZHIPU_API_KEY=your_zhipu_api_key_here
```

API Key 获取地址：[智谱 AI 开放平台](https://open.bigmodel.cn/)。

### 4. 类型检查与生产构建

```bash
# TypeScript 类型检查
npm run lint

# 生产构建（输出至 dist/）
npm run build
```

---

## ☁️ 部署到 Vercel（推荐）

本项目已针对 Vercel 做好零配置适配（含 `vercel.json` 30 秒函数超时配置）：

1. 将仓库推送至 GitHub。
2. 在 [Vercel](https://vercel.com/) 导入该 GitHub 仓库（Framework Preset 自动识别为 **Vite**）。
3. 在 **Project Settings → Environment Variables** 中新增环境变量：
   - Name: `ZHIPU_API_KEY`
   - Value: 你的智谱 AI API Key
4. 点击 **Deploy** 完成部署。
5. 在 iPhone Safari 中打开部署后的网址，点击底部「分享 → 添加到主屏幕」，即可作为全屏 **iOS PWA** 使用。

---

## 📱 打包为原生 iOS App（Capacitor）

项目内置 Capacitor 8 配置（`capacitor.config.ts`）以及 `ios-native/` 原生扩展目录：

```bash
# 1. 构建前端产物并同步到 iOS 工程
npm run ios:sync

# 2. 在 Xcode 中打开 iOS 项目
npm run ios:open
```

更多关于 Xcode 签名、相机/麦克风权限（`NSCameraUsageDescription`、`NSMicrophoneUsageDescription`、`NSSpeechRecognitionUsageDescription`）以及 CloudKit 家庭同步的配置步骤，请查看 [`ios-native/IOS_XCODE_GUIDE.md`](./ios-native/IOS_XCODE_GUIDE.md)。

---

## 🔌 Serverless API 说明

所有 AI 请求均通过 Vercel 后端中转，`ZHIPU_API_KEY` 仅保存在服务端环境变量中。

### `POST /api/recognize` — 拍照识别纸质喂养记录
- **模型**：`glm-4v-flash`
- **请求体**：
  ```json
  {
    "image": "data:image/jpeg;base64,..."
  }
  ```
- **响应示例**：
  ```json
  {
    "date": "2026-11-26",
    "records": [
      { "time": "08:30", "type": "formula", "amount": 120, "note": "" },
      { "time": "11:15", "type": "breast_direct", "duration": 15, "note": "" },
      { "time": "14:00", "type": "poop", "count": 1, "note": "金黄色软便" }
    ]
  }
  ```

### `POST /api/polish` — 语音日记整理与性别代词统一
- **模型**：`glm-4-flash`
- **请求体**：
  ```json
  {
    "text": "嗯，今天带宝宝去晒太阳了，那个，他笑得可开心了然后呢睡了两个小时",
    "gender": "girl"
  }
  ```
- **响应示例**：
  ```json
  {
    "polishedText": "今天带宝宝去晒太阳了，她笑得可开心了，睡了两个小时。"
  }
  ```

---

## 🔒 隐私与数据安全

- **本地优先**：宝宝档案、喂养、成长、疫苗、生病及日记数据默认存储在设备本地，支持随时导出 JSON 备份。
- **密钥零泄露**：所有外部 AI 模型调用均经由 `/api/*` Serverless 路由中转，前端打包产物中不包含任何 API 密钥。
- **最小化图片传输**：拍照识别前在客户端本地压缩图片尺寸与体积，仅发送单次识别所需数据。

---

## 📄 License

本项目仅供个人与家庭学习交流使用，如需商用请自行评估第三方 API 服务条款与合规要求。
