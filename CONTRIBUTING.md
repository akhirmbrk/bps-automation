# Contributing to BPS Automation

First off, thank you for considering contributing to BPS Automation! This extension helps BPS teams work more efficiently, and every contribution matters.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

- Be respectful and inclusive
- Accept constructive feedback gracefully
- Focus on what's best for the community

## Getting Started

### Prerequisites

- Chrome 88+ or Edge 88+ (Chromium-based)
- VS Code (recommended) or any code editor

### Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/akhirmbrk/bps-automation.git
cd bps-automation

# 2. Load as unpacked extension in Chrome
# Open chrome://extensions/ → Developer Mode → Load unpacked → Select folder
```

## Coding Standards

### JavaScript/ES6+

```javascript
// ✅ DO: Use ES6+ features and modern patterns
const getConfig = () => config.get();
const { api, scraper } = config.get();

// ✅ DO: Use strict equality
if (value === null) return;

// ❌ DON'T: Use var or loose equality
var config = getConfig();
if (value == null) return;
```

### Naming Conventions

- **Variables/Functions**: camelCase (`loadSurveys`, `isDarkMode`)
- **Classes**: PascalCase (`App`, `ScraperService`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS`, `MAX_RETRIES`)
- **Files**: kebab-case (`auth-service.js`, `event-bus.js`)

### Architecture Guidelines

1. **Use EventBus for cross-module communication** — Don't import modules directly across feature boundaries
2. **Export singletons from modules** — Each module exports one singleton instance
3. **Centralize constants** — Add new constants to `src/constants.js`, not inline values
4. **Error handling** — Always use try/catch for async operations

### Code Style

- Use 2-space indentation
- Semicolons required
- Single quotes for strings (unless escaping is needed)
- Trailing commas in arrays/objects
- No unused variables or imports

## Pull Request Process

### Before Submitting

- [ ] Code follows project standards
- [ ] No console.log or debug statements
- [ ] No sensitive data (tokens, credentials)
- [ ] README.md updated if features changed
- [ ] Tested locally in Chrome/Edge

### PR Description Template

```markdown
## Description
Brief summary of changes.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally in Chrome
- [ ] No console errors

## Checklist
- [ ] Code follows project standards
- [ ] No sensitive data exposed
- [ ] Changes documented
```

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Use When |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `style` | Formatting, missing semicolons, etc |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Examples

```
feat(app): add JWT auto-capture from manajemen-mitra
fix(utils): correct debounce this context binding
docs(readme): update installation instructions
refactor(scraper): extract pagination logic to separate function
chore(deps): update xlsx library to v0.18.0
```

## Project Structure

```
src/
├── app.js              # Main controller
├── constants.js        # Centralized constants
├── core/               # Infrastructure modules
├── modules/            # Feature modules
│   ├── auth/           # Authentication
│   ├── surveys/        # Survey management
│   ├── scraper/        # Data extraction
│   ├── exporter/       # Export services
│   ├── allocation/     # User allocation
│   └── mitra/          # Mitra management
└── storage/            # History cache
```

## Need Help?

If you have questions, reach out to the project maintainer through repository issues or your team's communication channel.