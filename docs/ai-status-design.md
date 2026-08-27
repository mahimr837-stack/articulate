# AI Status and Proposal Design

- Node status surfaces must expose only bounded operational labels such as processing, waiting, using tool, waiting for approval, completed, and failed.
- Private reasoning, hidden prompts, and model chain-of-thought are never stored or displayed.
- AI node proposals are structured server results that contain only a permitted node type, title, and concise purpose.
- A proposal remains pending until an explicit user approval event creates a node through the shared node factory.
