# OddsSeer

用于普通网页的预测市场浏览器插件。阅读新闻或文章时，选中文字或点击扫描，查看相关的 Polymarket / Kalshi 市场、公开行情，并将关注的市场保存在本地。

[English](README.md) · [架构](docs/ARCHITECTURE.md) · [安全与隐私](SECURITY.md) · [验证状态](docs/VERIFICATION.md)

## 看看它怎么用

**浏览网页 → 选中问题 → 在当前页面发现相关预测市场。**

[下载 19 秒插件介绍 MP4](docs/media/oddsseer-extension-intro.mp4?raw=true) · [完整截图与 GIF 画廊](docs/DEMO.md)

> 以下为原插件内容脚本在本地虚构文章上的交互演示，使用模拟行情；视频由实际操作截图编排。它用于介绍交互方式，不代表当前版本已完成原生 Chrome 安装或跨网站验收。

![OddsSeer：浏览、划词、发现相关市场](docs/media/oddsseer-extension-intro.gif)

| 选中网页中的问题 | 查看相关市场 |
| --- | --- |
| ![划词并点击搜索](docs/media/00b-extension-selection.jpg) | ![当前页面中的市场结果卡片](docs/media/00c-extension-results.jpg) |

读到新闻中的一个判断，可以选中文字查找对应市场，查看市场问题与公开价格，再决定是否加入关注。插件不要求先打开 PromptTrading。

完整画廊也保留了早期工作台的中文界面、分析、模拟持仓与积分截图。这些均标为历史演示；当前开源插件不包含其交易、充值或订阅功能。

## 本地运行

需要 Node.js 22.18+ 和 npm，在本仓库目录执行：

```sh
npm --prefix extension ci
npm --prefix server ci
npm run build
npm start
```

在 Chrome 扩展管理页开启开发者模式，选择“加载已解压的扩展”，加载 `extension/.output/chrome-mv3`。后端只监听本机 `127.0.0.1:8787`。扩展来源白名单和可选增强配置见 [后端说明](server/README.md)。安装后刷新普通网页，即可使用悬浮工具栏和划词搜索。

## 功能范围

- 独立插件，不需要打开 PromptTrading 网页。
- 默认使用真实公共市场关键词搜索；中文跨语言匹配能力不等同于原语义检索。
- 保留原混合检索、向量、全文、RRF、重排算法；需要独立 PostgreSQL/pgvector 数据库、同步市场数据，并按需配置模型服务。
- 保留新闻时间线、价格异动和评论情绪分析。外部数据不可达会影响功能；评论模型密钥只在后端配置。
- 收藏、提醒、设置保存在当前浏览器；通知受 Chrome 权限和运行状态影响。
- 当前不创建钱包、不接收私钥、不充值、不托管资金、不执行交易，也不提供付费订阅。未使用的旧账户、付款界面和登录示例不进入公开源码。

普通网页打开时，页面 URL、标题和提取的关键词会进入扩展后台内存，不会因此自动上传后端。工具栏位置使用扩展存储，不写入所访问网站的 localStorage。扫描和划词由点击触发，文本会发送到自部署后端或公共市场搜索接口。预测市场增强页可能自动读取公开市场信息和评论。**配置服务端模型密钥及允许的扩展来源后，页面增强可能自动将最多 20 条公开评论（含用户名）发送给 OpenRouter，并产生模型费用，无需另外点击分析。** 关闭页面增强或不配置模型密钥即可停用。请勿将机密文本发送到第三方搜索接口。浏览器内部页、扩展商店等受保护页面不支持普通内容脚本。

密钥不能放入 `VITE_*`，因为这些变量会被打进公开插件。环境示例仅含占位配置，真实本地环境文件不入库。

```sh
npm run typecheck
npm run build
npm run test:extension
npm run test:server
npm run scan:secrets
```

本次首次源码开源采用 [MIT 许可证](LICENSE)，延续原插件 README 的 MIT 标注；第三方依赖遵循各自许可证，见[第三方说明](THIRD-PARTY-NOTICES.md)。

类型检查、构建和离线测试已通过。**尚未完成 Chrome 原生加载及跨网页交互验证。** 可选模型和数据库功能需要单独配置；后端仅供本机使用。已知依赖问题与独立源码审查范围见[验证记录](docs/VERIFICATION.md)和[审查说明](docs/REVIEW.md)。
