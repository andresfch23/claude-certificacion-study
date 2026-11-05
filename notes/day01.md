# Day 1 – Messages API, history, stop_reason

- stop_reason is something the API returns in the message, and it reflects why the agent stopped.
- The most common are end_turn (the petition was solved) and tool_use (the agent wants us to run a tool and send it the result).
- max_tokens: the limit of tokens I set was reached, so the answer is cut off.
- stop_sequence: for custom stop strings.
- Why `in` grows: it grows linearly, not exponentially. Each time it adds the previous things we asked and the results of that, so every call sends the whole history again.
- When the assistant reply wasn't stored, the model had no context of what happened before, because it has no memory. Anything that only existed in its earlier replies was lost. That's why we send everything in history: the inputs, the answers, and the results of the tools.
