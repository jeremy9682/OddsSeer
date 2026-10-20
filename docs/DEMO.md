# OddsSeer 产品演示 / Product demo gallery

[中文使用说明](../README.zh-CN.md) · [English README](../README.md)

## 在网页上发现预测市场 / Discover markets on the web

OddsSeer 的入口是你正在阅读的普通网页。阅读新闻、讨论或文章时，选中一个问题，查看相关 Polymarket / Kalshi 市场与概率卡片。后续可使用当前插件的本地关注与提醒功能，具体支持范围见 README。

OddsSeer starts on the page you are reading: select a question and explore related prediction markets. The current extension also provides local watchlists and alert preferences; see the README for supported capabilities.

**素材说明 / Demo provenance:** 本页素材制作于 2026-10-20，早于独立源码最终修复。原插件内容脚本运行在本地虚构文章上，Chrome 消息通道由测试适配器替代，Shadow DOM 为工具操作而开放。行情和分析是预设样本；无真实私钥、支付、模型调用或实盘下单。视频为实际操作截图编排，非连续录屏。当前发行版原生安装、后台 Service Worker、原生侧栏及跨站兼容性未由这些素材验证。

These assets predate the final standalone source corrections. They use the original content script on a fictional local article, a Chrome messaging test adapter, accessible shadow roots and fixture data. No real keys, payments, model calls or live orders were used. Videos are edited UI-capture sequences, not continuous recordings or evidence of native installation, service-worker/side-panel operation or cross-site acceptance.

### 19 秒插件流程 / 19-second extension flow

[打开 MP4 视频 / Open MP4](media/oddsseer-extension-intro.mp4)

![浏览网页、选中问题、查看市场 / Read, select, discover](media/oddsseer-extension-intro.gif)

| 浏览本地样例文章 / Read the sample | 划词搜索 / Select and search |
| --- | --- |
| ![虚构文章与插件入口](media/00-extension-article.jpg) | ![划词搜索](media/00b-extension-selection.jpg) |

![相关市场结果 / Matching market](media/00c-extension-results.jpg)

<details>
<summary>插件介绍封面 / Extension video cover</summary>

![插件介绍封面](media/extension-cover.png)

</details>

## 历史工作台演示 / Historical workspace demo

**下面所有画面是临时宿主中的早期集成演示，不是当前插件发行版的功能清单。** 模拟交易、持仓、充值、积分、订阅及 Trader 工作台均未包含在当前源码发行版中。分析结果为预设回放，不是模型预测成绩；“Running / Monitoring Live”等旧界面文字不能证明真实监控运行。PromptTrading 不属于插件的使用前提。

**Everything below is historical integration material, not the current extension feature list.** Paper trading, positions, top-ups, credits, subscriptions and the Trader workspace are not shipped in this source release. Analysis is fixture playback, not model performance; historical “Running / Monitoring Live” labels do not establish active monitoring. PromptTrading is not required to use OddsSeer.

[53 秒历史演示视频 / Historical 53-second MP4](media/oddsseer-walkthrough.mp4)

<details>
<summary>展开历史演示 GIF 与封面 / Historical GIF and cover</summary>

![历史混合工作台演示，非当前发行功能](media/oddsseer-walkthrough.gif)

![历史演示封面](media/cover.png)

</details>

### 中文界面截图 / Chinese interface screenshot

以下中文界面属于旧工作台。样例事件正文仍为英文，不表示当前插件界面或全量中文翻译。

This Chinese UI belongs to the historical workspace; event fixtures remain in English. It is not a screenshot of the current standalone extension.

![历史工作台中文界面](media/11-chinese-ui.jpg)

### 全部历史截图 / All historical screenshots

<details>
<summary>市场列表 / Market list — 历史演示 / historical demo</summary>

![市场列表 / Market list](media/01-markets.jpg)

</details>

<details>
<summary>事件详情与行情 / Event details — 历史演示 / historical demo</summary>

![事件详情与行情 / Event details](media/02-event-detail.jpg)

</details>

<details>
<summary>预设分析回放 / Fixture analysis replay — 历史演示 / historical demo</summary>

![预设分析回放 / Fixture analysis replay](media/03-analysis.jpg)

</details>

<details>
<summary>示例概率与风险 / Sample assessment — 历史演示 / historical demo</summary>

![示例概率与风险 / Sample assessment](media/03b-assessment.jpg)

</details>

<details>
<summary>模拟买入 / Paper order — 历史演示 / historical demo</summary>

![模拟买入 / Paper order](media/04-paper-order.jpg)

</details>

<details>
<summary>虚拟持仓 / Paper positions — 历史演示 / historical demo</summary>

![虚拟持仓 / Paper positions](media/05-portfolio.jpg)

</details>

<details>
<summary>模拟交易记录 / Paper history — 历史演示 / historical demo</summary>

![模拟交易记录 / Paper history](media/06-history.jpg)

</details>

<details>
<summary>虚拟积分充值 / Simulated credit top-up — 历史演示 / historical demo</summary>

![虚拟积分充值 / Simulated credit top-up](media/07-virtual-topup.jpg)

</details>

<details>
<summary>样本积分记录 / Fixture credit history — 历史演示 / historical demo</summary>

![样本积分记录 / Fixture credit history](media/08-credits.jpg)

</details>

<details>
<summary>旧工作台关注列表 / Historical watchlist — 历史演示 / historical demo</summary>

![旧工作台关注列表 / Historical watchlist](media/09-watchlist.jpg)

</details>

<details>
<summary>暂停状态的示例策略 / Paused sample strategy — 历史演示 / historical demo</summary>

![暂停状态的示例策略 / Paused sample strategy](media/10-traders.jpg)

</details>

<details>
<summary>旧工作台中文界面 / Historical Chinese UI — 历史演示 / historical demo</summary>

![旧工作台中文界面 / Historical Chinese UI](media/11-chinese-ui.jpg)

</details>

<details>
<summary>实盘禁用提示 / Live trading disabled — 历史演示 / historical demo</summary>

![实盘禁用提示 / Live trading disabled](media/12-live-disabled.jpg)

</details>

<details>
<summary>关闭提示后恢复浏览 / Browsing after dismissal — 历史演示 / historical demo</summary>

![关闭提示后恢复浏览 / Browsing after dismissal](media/13-browser-recovered.jpg)

</details>

## 运行当前版本 / Run the current version

请按仓库 [README](../README.zh-CN.md) 构建和配置独立插件。旧混合演示源码包与内部操作记录不属于本次媒体发布；不要据此启动旧宿主或接入真实资金。

Follow the [current README](../README.md) to build and configure the standalone extension. The old mixed demo source package and private operation records are not distributed here.
