# System Architecture

This directory contains the editable source code for the system architecture diagrams.
We use [Eraser.io](https://eraser.io) for diagramming.

## Files

| Diagram | Source | Rendered |
|---------|--------|----------|
| **Database Schema** | [`database-schema.eraser.md`](./database-schema.eraser) | ![Database Schema](./database-schema.svg) |
| **Auth System Flow** | [`auth-system-flow.eraser.md`](./auth-system-flow.eraser) | ![Auth System Flow](./auth-system-flow.svg) |
| **Inbox & Settings** | [`inbox-settings-system-flow.eraser.md`](./inbox-settings-system-flow.eraser) | ![Inbox Settings](./inbox-settings-system-flow.svg) |
| **Razorpay Credits System Flow** | [`razorpay-credits-system-flow.eraser.md`](./razorpay-credits-system-flow.eraser) | ![Razorpay Credits System Flow](./razorpay-credits-system-flow.svg) |

## How to edit diagrams

1. **Copy Source**: Open the `.eraser` file and copy the code.
2. **Edit in Eraser**: Paste the code into a new [Eraser.io](https://eraser.io) file.
3. **Export SVG**: Once updated, export the diagram as an **SVG**.
4. **Update File**: Overwrite the corresponding `.svg` file in this directory.
5. **Update Source**: Copy the updated DSL code from Eraser back into the `.eraser` file.
6. **Commit Both**: Commit **BOTH** the `.eraser` and the `.svg` files in your PR.

> **Critical**: PRs that update the SVG without updating the specific source code (or vice versa) must be rejected. The source and the visual must always stay in sync.
