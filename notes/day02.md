# Day 2 – Agentic loop with tools

- tool_use is one of the stop reasons, and the most important one after end_turn. It means the model stopped because it needs me to run a tool and give it the result before it can continue. It picks the tool by reading the descriptions of the tools I exposed and choosing the most accurate one for the task.
- The results of the tools go back as a user message, with the same tool_use_id the model sent, so the model has the context of what happened and knows which result belongs to which request.
- Stopping by a counter is an anti-pattern because it stops without any logical reason that is meaningful for the user. How can I know if two iterations are enough to answer the request? The only valid stop is end_turn, because that indicates the agent by itself found the answer.
