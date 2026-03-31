# Reference: Qwen Skill Structure

## Directory Layout

```
.qwen/skills/<skill-name>/
├── SKILL.md          # Required: Main instruction file with YAML frontmatter
├── reference.md      # Optional: Reference documentation
├── examples.md       # Optional: Usage examples
├── scripts/          # Optional: Helper scripts (e.g., helper.py)
└── templates/        # Optional: Template files (e.g., template.txt)
```

## SKILL.md Format

```markdown
---
name: your-skill-name
description: Brief description of what this Skill does and when to use it
---

# Your Skill Name

## Instructions  
Provide clear, step-by-step guidance for Qwen Code.

## Examples  
Show concrete examples of using this Skill.
```

## YAML Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Non-empty string; lowercase with hyphens recommended |
| `description` | Yes | Non-empty string; include what it does and when to use |

## Locations

| Type | Path | Scope |
|------|------|-------|
| Personal Skill | `~/.qwen/skills/<name>/` | All projects |
| Project Skill | `.qwen/skills/<name>/` | Current project only |

## Discovery

Skills are discovered from:
- `~/.qwen/skills/` (personal)
- `.qwen/skills/` (project)
- Extension-provided Skills (`extension/skills/`)

## Invocation

- **Autonomous**: Model invokes based on skill description
- **Explicit**: Use `/skills <skill-name>` to trigger manually
