# Day 5 – Validation, retries and examples

- In the first run, invoice A needed two attempts because the model did not know the date format we wanted. It copied "15 December 2026", the validator rejected it, and the retry with the exact error fixed it. In the second run we gave examples in the prompt from the beginning, so it wrote the date correctly on the first attempt.
- Receipt B ended the same way in both runs because the customer name is not in the document. We told the model not to invent values, so it returned null both times. Examples or no examples, the result is always the same.
- A retry is worth it when the answer can be improved with what is already in the document, like a wrong format. When the data is not present, no retry and no example can help. That record goes to a human or to another data source.
