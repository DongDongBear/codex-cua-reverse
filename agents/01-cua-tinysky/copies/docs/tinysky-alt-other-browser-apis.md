# Other Browser APIs

For browser tabs, the above API is the most efficient way to complete:

- Short tasks
- Tasks which lack repetition, regardless of length

Other APIs are available in case:

- The accessibility API is not working or does not support the capability
- The specific task can be completed more efficiently with another API

For example, for certain tasks you can build locators with Playwright to batch more actions into a single call:

- Long and repetitive tasks, where element indices do not stay stable
- Testing sites you're developing, where you know the structure of the website

Playwright locators are more verbose to generate than the accessibility API, so ensure there are opportunities to reduce several calls to `getAXState()` to justify the more verbose code.
