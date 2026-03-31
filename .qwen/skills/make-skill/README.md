# Make Skill - Qwen Skill Creator

This directory contains the "make-skill" skill for Qwen Code. This skill helps you create other skills.

## What is this?

This is a **skill that helps create skills**. When you ask Qwen Code to help you make a new skill, it will use the instructions in this directory's parent (`SKILL.md`) to guide the creation process.

## Structure

```
make-skill/
├── SKILL.md          # Main skill instructions (required)
├── reference.md      # Reference documentation
├── examples.md       # Usage examples
├── scripts/          # Helper scripts
│   └── skill_template.py  # Python script for programmatic skill creation
└── templates/        # Template files (empty by default)
```

## How to Use

1. Ask Qwen Code: "Create a skill for [what you need]"
2. Qwen will use the instructions in `SKILL.md` to create the new skill
3. The new skill will be created in `.qwen/skills/<skill-name>/`

## Related Documentation

- [Qwen Code Skills Docs](https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/)