---
title: 'Agent 还在网页上找按钮，WebMCP 已经让网站交出工具了'
date: '2026-08-31'
summary: WebMCP 让网页把前端函数直接注册给浏览器 Agent。相比用视觉模型猜像素点按钮，它能原生复用前端状态机与登录态；但商业网站的利益博弈注定让它只能在企业内网与 SaaS 闭环中生根。
tags:
  - WebMCP
  - AI Agent
  - 前端
  - 浏览器自动化
cover: webmcp-agent-web-interface.png
coverAlt: 网页主动向 Agent 交出结构化工具
---

写过 E2E 自动化脚本的人，看最近一堆人吹 Browser Use，心情大多很微妙。

这事我们太熟了。以前用 Selenium 算 xpath，后来用 Puppeteer 抓 CSS 选择器，现在无非是套了个多模态大模型帮你看截图点屏幕。可前端只要发个版把类名哈希掉，或者在按钮外面裹一层埋点用的隐形 `div`，半夜跑定时任务照样挂给你看。

让大模型盯着几百万像素的截图去猜那个按钮在哪，根本不是什么前沿智能，就是纯粹的算力浪费。

## 前端明明可以直接交底

页面上那个“批量审批”按钮，点下去无非就是触发一段绑在内存里的 JS。

数据在 Store 里躺着，校验规则写在 schema 里，Axios 拦截器早把鉴权 token 贴好了。

偏偏现在的视觉 Agent 要绕一个大圈子：
前端把数据渲染成 DOM，浏览器把 DOM 变成像素，Agent 截屏发给模型，模型算出一个大致的 `(x, y)` 坐标，再通过 CDP 协议模拟鼠标点过去。

只要赶上动画没播完、局部区域有滚动条、或者屏幕分辨率变了一下，模型就会点空，接着就是漫长的重试和死循环。

W3C 社区组起草的 WebMCP，说白了就是前端受够了被外部脚本暴力逆向，索性在浏览器原生环境里给 Agent 递个钥匙。

网页挂载时，直接在当前标签页注册自己的可用方法：

```ts
// 封装成一个标准的 React Hook
function useExpenseTools() {
  useEffect(() => {
    if (!('modelContext' in document)) return;

    const tool = document.modelContext.registerTool({
      name: 'batchApprove',
      description: '批量审批选中的报销单据',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } }
        },
        required: ['ids']
      },
      execute: async ({ ids }) => {
        const res = await expenseApi.batchApprove(ids);
        setList(prev => prev.filter(item => !ids.includes(item.id)));
        return { success: true, count: res.affected };
      }
    });

    return () => tool.unregister();
  }, []);
}
```

Agent 进页面后直接拿到结构化 Schema 做 Function Calling。模型出参数，前端在当前进程里跑 JS，改组件状态、发带登录态的请求。

没有坐标计算，不吃分辨率，也不用管 CSS 怎么写。

![Browser Use 的像素绕路与 WebMCP 的结构化工具](/posts/images/webmcp-agent-web-interface/webmcp-agent-web-interface-01.png)

## 为什么不能直接甩给后台接口？

每次聊到这，总有人会问：既然都有结构化参数了，为什么不直接起个 MCP Server 去调后端的 REST 接口？

因为很多业务逻辑和数据，根本就没存到数据库里。

比如一个多步骤的采购申请单，用户在第一步选了供应商，前端立刻动态拉了专属报价表，并在内存里算好了税率折让。这些中间状态全在前端内存里。走后台接口，你得让后端专门写一套影子服务来维护这套草稿状态机；而走 WebMCP，Agent 就是直接在当前页面帮用户填这一步。

更重要的是人能不能安心。

把删数据或打款的权限扔给一个后台黑盒脚本，谁心里都发毛。但在浏览器里，Agent 调完 WebMCP 函数，界面的变化是实时渲染在眼前的。它把二十个筛选条件拉满、表单填完，稳稳停在“确认提交”的前一刻。

最后那一下点击留给肉眼核对，这是目前企业落地自动化唯一让人睡得着觉的形态。

![WebMCP 使用当前页面状态，MCP 连接独立后台服务](/posts/images/webmcp-agent-web-interface/webmcp-agent-web-interface-02.png)

## 指望商业网站适配是不现实的

WebMCP 在工程上很顺，但它大概率只会在企业内部系统和 SaaS 里活得好。

![内部系统主动开放 WebMCP，公开网站仍需继续找按钮](/posts/images/webmcp-agent-web-interface/webmcp-agent-web-interface-03.png)

指望美团、携程这些公开商业平台主动去接 WebMCP，就像当年指望他们保留 RSS 一样不现实。

商业平台的饭碗就是停留时长、广告位曝光和会员弹窗。如果真给网页接了 WebMCP，让 Agent 进门毫秒级拿走最低价然后跳过全部推荐流，平台拿什么变现？

只要 Chrome 没把 WebMCP 变成硬性的流量分发权重，公开网站不仅不会给你写 `registerTool`，反而会加固指纹风控把自动化请求往死里防。

所以分工其实很清晰：

在自己能控制的后台、ERP 和重度生产力工具里，用 WebMCP 注册好工具，别再陪着模型猜像素；至于外网那些充满反爬和动态混淆的站点，继续用笨拙的 Browser Use 去硬啃。

好用的协议改变不了商业利益的博弈，但至少在自己的系统里，我们能把方向走对。
