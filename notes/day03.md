# Day 3 – Tool descriptions and tool_choice

The model picks a tool by reading its name and its description. With two tools that have clear names (get_customer, lookup_order), routing was 10 of 10 correct even with one-line descriptions, and renaming them or making the ID formats look the same did not break it.
So descriptions are not magic with two well-named tools. They matter when there are many tools and their descriptions overlap, like analyze_content and analyze_document. That is the case the exam describes.
When the wrong tool gets picked in production, the first fix is the description: say what the tool is for, what its inputs look like, and when to use the other tool instead. It is cheaper than few-shot examples, a routing layer or merging tools.
tool_choice has three settings: auto lets the model answer in text or call a tool, any forces it to call some tool, and a named tool forces that specific tool.
