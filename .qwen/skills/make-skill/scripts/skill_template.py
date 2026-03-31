#!/usr/bin/env python3
"""
Template for a skill creation helper script.
This can be used to programmatically create Qwen skills.
"""

import os
from pathlib import Path

SKILL_TEMPLATE = """---
name: {skill_name}
description: {description}
---

# {skill_title}

## Instructions  
{instructions}

## Examples
{examples}
"""


def create_skill_directory(skill_name: str, base_path: Path, include_scripts: bool = False, include_templates: bool = False) -> Path:
    """Create the directory structure for a new skill."""
    skill_path = base_path / skill_name
    skill_path.mkdir(parents=True, exist_ok=True)

    # Only create optional subdirectories when requested
    if include_scripts:
        (skill_path / "scripts").mkdir(exist_ok=True)
    if include_templates:
        (skill_path / "templates").mkdir(exist_ok=True)

    return skill_path


def write_skill_md(skill_name: str, description: str, instructions: str, examples: str, skill_path: Path) -> None:
    """Write the SKILL.md file with proper formatting."""
    skill_title = skill_name.replace("-", " ").title()
    
    content = SKILL_TEMPLATE.format(
        skill_name=skill_name,
        description=description,
        skill_title=skill_title,
        instructions=instructions,
        examples=examples
    )
    
    (skill_path / "SKILL.md").write_text(content)


def create_skill(
    skill_name: str,
    description: str,
    instructions: str = "",
    examples: str = "",
    base_path: Path = Path(".qwen/skills"),
    include_reference: bool = False,
    include_examples: bool = False,
    include_scripts: bool = False,
    include_templates: bool = False,
) -> Path:
    """
    Create a complete Qwen skill.

    Args:
        skill_name: Name of the skill (lowercase, hyphens recommended)
        description: Brief description of what it does and when to use
        instructions: Step-by-step guidance for Qwen Code
        examples: Usage examples
        base_path: Base directory for skills (default: .qwen/skills)
        include_reference: Create optional reference.md
        include_examples: Create optional examples.md
        include_scripts: Create optional scripts/ directory
        include_templates: Create optional templates/ directory

    Returns:
        Path to the created skill directory
    """
    skill_path = create_skill_directory(skill_name, base_path, include_scripts, include_templates)
    write_skill_md(skill_name, description, instructions, examples, skill_path)

    # Only create optional files when requested
    if include_reference:
        (skill_path / "reference.md").write_text(f"# Reference: {skill_name}\n\nAdd reference documentation here.\n")
    if include_examples:
        (skill_path / "examples.md").write_text(f"# Examples: {skill_name}\n\nAdd usage examples here.\n")

    print(f"Created skill at: {skill_path}")
    return skill_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Create a new Qwen skill")
    parser.add_argument("skill_name", help="Skill name (lowercase, hyphens recommended)")
    parser.add_argument("description", help="Brief description of what it does and when to use")
    parser.add_argument("--instructions", default="", help="Step-by-step guidance")
    parser.add_argument("--examples", default="", help="Usage examples")
    parser.add_argument("--include-reference", action="store_true", help="Create optional reference.md")
    parser.add_argument("--include-examples", action="store_true", help="Create optional examples.md")
    parser.add_argument("--include-scripts", action="store_true", help="Create optional scripts/ directory")
    parser.add_argument("--include-templates", action="store_true", help="Create optional templates/ directory")

    args = parser.parse_args()

    create_skill(
        args.skill_name,
        args.description,
        args.instructions,
        args.examples,
        include_reference=args.include_reference,
        include_examples=args.include_examples,
        include_scripts=args.include_scripts,
        include_templates=args.include_templates,
    )
