---
name: task-complete-notify
description: Notify the user that a task is complete with three beeps and a Windows popup.
---

# Task Complete Notify

Use this skill right before the final response for a completed implementation, debugging, or editing task.

## What this skill does

- Plays 3 notification beeps on Windows.
- Shows a popup containing the task completion message.

## How to use it

1. Prepare a short completion message in plain text.
2. Run the bundled PowerShell script with a short title and message before sending the final response.

PowerShell command:

```powershell
powershell -ExecutionPolicy Bypass -File ".agents/skills/task-complete-notify/task-complete-notify.ps1" -Title "OpenCode" -Message "<completion message>"
```

## Message guidance

- Keep the popup text short and readable.
- Mention the main thing that was completed.
- Do not use this skill for blocked, partial, or analysis-only work.
