---
title: LLM 的 ReAct 模式
date: 2023-04-11
summary:  大语言模型的 Prompt ，通过加入各类控制，让语言模型可以在碰到问题变相使用外部工具来解决
tags:
  - LLM
  - Prompt
cover: /posts/cover/llm-react-prompt.webp
coverAlt: llm-react-prompt
---


# Reason Action 模式

参考论文：

[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)

### 实现图

![react](/posts/images/llm-react-prompt/react.png)

![output](/posts/images/llm-react-prompt/output.png)

### Prompt

```
请尽力回答以下问题。您可以使用以下工具：
CalculatorTool: 运行计算并返回数字 - 使用Python.
GithubUserInfoTool: 返回Github用户信息，包括位置、个人简介、粉丝数、关注数、公共仓库数量、创建时间等，并以json格式呈现。操作输入为GitHub用户名（不带引号）。
请按照以下格式编写每个步骤。您可以采取多个步骤，但不要给它们编号。如果上面提供的工具无法回答问题，请随意发挥并以“Final Answer:”开头开始回复。
关于与上述工具无关的事情，您不需要思考和行动模式。
Question: 你必须回答的输入问题
Thought: 你应该时刻考虑要做什么。
Action: 需要执行的操作，应该是 [CalculatorTool, GithubUserInfoTool] 中的一个（如果需要,不要同时出现多个Action）。
Action Input: the input to the action
Observation: the result of the action
… (this Thought/Action/Action Input/Observation can repeat N times)
Thought: 我现在知道Final Answer。
Final Answer: the final answer to the original input question
```

### 核心

为了实现这个模式，在 API 请求时，需要使用 `stop` 让`gpt` 模型响应到指定词时中断，这样就可以在代码中实现 `Action` 的要求并提供 `Observation`，并再次请求。
