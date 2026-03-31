---
name: make-skill
description: Create new Qwen skills with proper structure, YAML frontmatter, and documentation. Use when you need to create a new skill for Qwen Code, either personal (~/.qwen/skills/) or project-based (.qwen/skills/).
---

# Make Skill - Qwen Skill Creator

## Instructions

This skill helps you create new Qwen skills. Follow these steps:

1. **Ask me to create a skill** - Describe what the new skill should do, including:
   - The skill name (lowercase, hyphens recommended)
   - A brief description of what it does
   - When/why to use it

2. **I will create the skill structure** including:
   - `SKILL.md` with proper YAML frontmatter
   - Optional supporting files (`reference.md`, `examples.md`)
   - Proper directory structure

3. **I will validate** the skill by checking:
   - YAML syntax is correct
   - Required fields are present (`name`, `description`)
   - File paths are accurate

## Skill Creation Template

When creating a new skill, use this structure:

```
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

### YAML Field Requirements
- `name`: non-empty string (recommended: lowercase, numbers, hyphens only)
- `description`: non-empty string (include what it does and when to use it)

### Best Practices
- Keep skills focused: One capability per skill
- Write clear descriptions with triggers and use cases
- Test thoroughly after creation
- For project skills, commit the skill directory to Git

## Examples

**Example 1: Create a PDF extraction skill**

User request: "Create a skill for extracting text from PDF files"

I will create:
- Directory: `.qwen/skills/pdf-text-extract/`
- `SKILL.md` with proper frontmatter and instructions

**Example 2: Create a git commit helper**

User request: "Make a skill that helps write good commit messages"

I will create:
- Directory: `.qwen/skills/git-commit-helper/`
- Complete skill structure with examples
