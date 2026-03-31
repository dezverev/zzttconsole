# Examples: Creating Qwen Skills

## Example 1: PDF Text Extraction Skill

**User Request:**
> "Create a skill for extracting text and tables from PDF files, useful when working with document extraction tasks."

**Skill Created:**
```
.qwen/skills/pdf-text-extract/
├── SKILL.md
├── reference.md
└── examples.md
```

**SKILL.md Content:**
```markdown
---
name: pdf-text-extract
description: Extract text and tables from PDF files. Use when working with PDF document extraction or converting scanned documents to editable text.
---

# PDF Text Extract

## Instructions
1. Accept a PDF file path as input
2. Use PyPDF2 or pdfplumber to extract text
3. Detect and extract tables using appropriate library
4. Return structured output (text sections, tables as markdown)

## Examples
- Input: "Extract text from /path/to/document.pdf"
- Output: Plain text with tables converted to markdown
```

---

## Example 2: Git Commit Message Helper

**User Request:**
> "Make a skill that helps write good commit messages following conventional commits format."

**Skill Created:**
```
.qwen/skills/git-commit-helper/
├── SKILL.md
└── scripts/
    └── conventional_commit.py
```

**SKILL.md Content:**
```markdown
---
name: git-commit-helper
description: Help write conventional commit messages following the Conventional Commits specification. Use when preparing git commits for team projects.
---

# Git Commit Helper

## Instructions
1. Review git diff or staged changes
2. Identify commit type (feat, fix, chore, etc.)
3. Suggest a properly formatted commit message
4. Include breaking changes if applicable

## Examples
- Input: "Review my staged changes for a commit message"
- Output: "feat: add user authentication system"
```

---

## Example 3: HTML Linting Assistant

**User Request:**
> "Create a skill that checks HTML files for accessibility issues and common mistakes."

**Skill Created:**
```
.qwen/skills/html-lint/
├── SKILL.md
└── scripts/
    └── html_checker.py
```

**SKILL.md Content:**
```markdown
---
name: html-lint
description: Check HTML files for accessibility issues, semantic correctness, and common mistakes. Use when reviewing or debugging HTML code.
---

# HTML Lint

## Instructions
1. Analyze HTML structure and semantics
2. Check for common accessibility issues (alt text, ARIA labels)
3. Verify proper heading hierarchy
4. Report issues with severity and fix suggestions

## Examples
- Input: "Check this HTML for accessibility problems"
- Output: List of issues with line numbers and fixes
```
