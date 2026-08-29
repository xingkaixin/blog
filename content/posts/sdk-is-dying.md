---
title: '只调 8 个端点却装几兆依赖：AI 把薄 SDK 的账算反了'
date: '2026-08-28'
summary: SDK 依赖正在让后端变得臃肿脆弱。许多服务只用几个端点却引入几十兆依赖，而且薄 SDK 经常吞掉 Nginx 和网关的真实排障证据。区分厚 SDK（深层运行时插桩）与薄 SDK（纯 API 包装），用几十行统一 HTTP 客户端收窄边界。
tags:
  - SDK
  - API 集成
  - 可观测性
  - 软件架构
cover: sdk-is-dying.png
coverAlt: 只调 8 个端点却装几兆依赖：AI 把薄 SDK 的账算反了
---

![封面：薄 SDK 把原始 HTTP 证据包装成空洞异常](/posts/images/sdk-is-dying/sdk-is-dying-cover.png)

上个月排查一个线上偶发的退款失败，Sentry 给我报了个极其空洞的错：`StripeConnectionError: An error occurred with our connection to Stripe`。

我点进堆栈，底下全是被 SDK 内部包装过的重试逻辑。我想找 Stripe 这次返回的原始 HTTP 状态码，没有；想找 Response Header 里的 `Request-Id` 去找客服查日志，也没有。因为挡在最外层的不是 Stripe 的服务器，而是 Cloudflare 的防爬验证，返回了一串 HTML，SDK 按 JSON 解析炸了之后，顺手把最底层的原始报错吞得干干净净。

最后我不得不去改 `node_modules/stripe` 里的源码加 console.log 打断点。顺便看了一眼它的体积：6.5MB。

我们整个后端其实只调了 Stripe 的 8 个接口。

## 机器生成的包装，专在出事时添乱

接第三方 API 时直接装官方 SDK，过去算是一种省事的肌肉记忆。但这些年大多数服务商的公开 SDK，本质上都是从 OpenAPI 文档里批量自动生成的代码机器。

为了讨好所有人，它必须把五年前弃用的旧端点、各种冷门语言的垫片、几百个用不到的类型全塞进来。`@slack/web-api` 7.7MB，`@linear/sdk` 34MB，`googleapis` 更是奔着 200MB 去。

体积大只是在打包时恶心一下人，真正要命的是它对异常的二次加工。

生产环境里的网络调用，从来不可能保证永远收到规范的 JSON。网关超时会吐 504 HTML，WAF 限流会吐 429 纯文本，反向代理崩了会直接断开 TCP。这些第一现场在 SDK 的类型抽象眼里都是“非法响应”，然后统一给你包成一个含糊不清的类。

当你在本地让 Claude Code 排查问题，或者自己看日志时，能拿到的一手证据全被中间这层壳给过滤了。Agent 只能对着抽象出来的空壳异常反复盲猜。

![SDK 异常与原始 HTTP 证据](/posts/images/sdk-is-dying/sdk-is-dying-01.png)

## 随手 import，架构入口就散架了

官方 SDK 带来的另一个隐形坏处，是调用成本太低，低到谁都可以在业务代码里随手来一发。

打开代码库搜一下，Controller 里直接 `new Stripe(...)`，定时任务里随手 import 一个 Slack Client。大家调得开心，结果是：
* 每个人都在自己的调用点单独包 `try/catch`；
* 遇到了 429 限流，有人写了个 sleep，有人直接抛 500；
* 耗时统计、TraceId 传递、日志脱敏，全靠写代码时的主观自觉。

Stripe 和 WorkOS 的限流在业务上是一回事，但在代码里却是两个完全不同的 SDK 异常。

最后你为了兜底这些零碎的调用，在业务外层糊了一圈又一圈的 `catchRateLimitError`。

## 自己写 50 行 fetch，契约反而更干净

Alvin（@alvinsng）他们团队之前把 Stripe、WorkOS 和 Slack 的官方 SDK 全部踢出了生产依赖，换成一个几十行的自建基类。

做法其实特别土：
```ts
export class BaseHttpClient {
  constructor(private baseUrl: string, private authHeader: () => string) {}

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': this.authHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const rawBody = await res.text();
      // 保留全部状态码、header 与原始 body，绝不私自吞掉证据
      throw new HttpError(res.status, res.headers, rawBody);
    }

    return res.json() as T;
  }
}
```

每个第三方服务继承这个基类，只声明自己的 BaseUrl 和真正会用到的那几个具体函数。

![SDK 成本与自建客户端成本的总账](/posts/images/sdk-is-dying/sdk-is-dying-02.png)

这带来的改变是立竿见影的：
1. **原始现场永远都在**：上游网关吐 HTML 也好、返回特定 Header 也罢，错误一抛出来就是完整的网络第一现场，排障不用猜。
2. **所有出口收归一处**：重试、超时、打点、Trace 上报，只在这几十行代码里维护一次，全项目的第三方调用都老老实实走同一套规矩。
3. **摆脱依赖泥潭**：不用再为了等某个 SDK 修复奇怪的子依赖漏洞而去整天折腾升级。

有人会问类型怎么办？其实可以在 `devDependencies` 里留着 SDK 或者直接让 Agent 根据官方文档把用到的那几个 Request/Response 类型写出来。运行时只要纯净的 HTTP，开发时有类型约束就够了。

## 该留的留，该删的删

这不是说所有叫 SDK 的东西都要删。

像 Sentry、Datadog 这种库，它要 hook 进 Node.js 运行时的事件循环，要接管未捕获异常，要跨异步上下文传递 Trace。这种深度介入运行时的能力，属于基础设施，自己写纯属找虐，必须留着。

但对于 Stripe、Slack、Linear 这类本质上就是几个 REST 端点的纯包装器，真没必要无脑引入几十兆的黑盒。

写集成代码在过去是个繁琐的体力活，大家为了省事才买单 SDK 的包袱；现在把接口文档丢给 Agent，写几行强类型的封装也就是几秒钟的事。

接第三方服务前，先看一眼它到底是底层的运行时组件，还是只是个发 HTTP 请求的薄壳。如果是后者，几十行自己写出来的透明代码，远比几兆黑盒用起来让人安心。

---

本号持续探讨 AI 辅助编程下的架构瘦身与一手工程实践。后面我会继续记录接口收敛、透明排障、极简依赖以及工程自动化里的各种具体权衡。欢迎关注。
