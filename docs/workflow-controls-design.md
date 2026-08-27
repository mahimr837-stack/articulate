# Workflow Controls Design

Articulate’s workflow controls operate on the complete `WorkflowState` graph, preserving node configuration, connection state, and layout together. Templates, starters, and exports use the local persistence boundary first; the existing Supabase storage adapter remains the future shared persistence boundary. Sharing uses an explicit user action that creates a portable workflow payload rather than silently sending workflow data to another service.
