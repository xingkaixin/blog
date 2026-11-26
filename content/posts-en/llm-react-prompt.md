---
title: "The ReAct Pattern for LLMs"
summary: "A prompt pattern for large language models that uses structured controls so the model can invoke external tools to solve problems."
coverAlt: "The ReAct Pattern for LLMs"
sourceHash: "9f5dc996acf2dad2"
---

Reference paper:

[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)

### Implementation Diagrams

![ReAct flow diagram](/posts/images/llm-react-prompt/react.png)

![Example output](/posts/images/llm-react-prompt/output.png)

### Prompt

```
Answer the following questions as best you can. You have access to the following tools:
CalculatorTool: Runs calculations and returns a number - uses Python.
GithubUserInfoTool: Returns GitHub user information, including location, bio, follower count, following count, public repository count, creation time, etc., formatted as JSON. The action input is a GitHub username (without quotes).
Write each step in the following format. You can take multiple steps, but do not number them. If the tools provided above cannot answer the question, feel free to improvise and start your reply with "Final Answer:".
For matters unrelated to the tools above, you do not need the Thought and Action pattern.
Question: the input question you must answer
Thought: you should always think about what to do.
Action: the action to take, should be one of [CalculatorTool, GithubUserInfoTool] (if needed, do not output multiple Actions at once).
Action Input: the input to the action
Observation: the result of the action
… (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the Final Answer.
Final Answer: the final answer to the original input question
```

### Core Mechanism

To implement this pattern, pass `stop` in the API request so the `gpt` model halts when it reaches a specified token. Your code can then execute the requested `Action`, supply the `Observation`, and send the next request.
