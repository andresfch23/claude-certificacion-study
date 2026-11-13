# Day 4 – Structured output with JSON schemas

A nullable field protects us from the AI inventing a value. It gives the model a way to say there is no value for that field.
In invoice B the model put a glass cabinet under "accessories", because "accessories" is very general and a cabinet can be read as one. The fix is in the description of the category field: say what accessories means (items used with the cards) and that things like cabinets or lights go under "other". category_detail is where the model then writes what the "other" item is.
In invoice C the schema guaranteed there were no syntax errors, but not semantic ones. It guarantees the right type of value in each field, not the correct value. We used our own function to verify that the items add up to the stated total.
