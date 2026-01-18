# yamllint-ts VS Code Extension

A VS Code extension for linting YAML files using [yamllint-ts](https://github.com/your-username/yamllint-ts), a native TypeScript implementation of the popular Python [yamllint](https://github.com/adrienverge/yamllint) tool.

## Features

- **Native TypeScript** - No Python installation required
- **Real-time linting** - See errors as you type
- **Configurable** - Uses standard yamllint configuration format
- **Full compatibility** - Supports the same rules as Python yamllint

## Configuration

The extension looks for configuration files in the following order:

1. Path specified in `yamllint.config` setting
2. `.yamllint`, `.yamllint.yaml`, `.yamllint.yml`, or `.yamllint.json` in workspace root
3. Default configuration (if no config file found)

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `yamllint.enable` | boolean | `true` | Enable or disable yamllint |
| `yamllint.config` | string | `""` | Path to yamllint configuration file |
| `yamllint.lintOnSave` | boolean | `true` | Lint files when saved |
| `yamllint.lintOnChange` | boolean | `true` | Lint files as you type |
| `yamllint.lintOnOpen` | boolean | `true` | Lint files when opened |
| `yamllint.debounceTime` | number | `300` | Debounce time (ms) for linting on change |

### Example Configuration File

Create a `.yamllint` or `.yamllint.yaml` file in your workspace:

```yaml
---
extends: default

rules:
  line-length:
    max: 120
    level: warning
  indentation:
    spaces: 2
  document-start: disable
```

## Commands

- **yamllint: Lint Current File** - Manually lint the current YAML file
- **yamllint: Lint All YAML Files in Workspace** - Lint all YAML files in the workspace

## Available Rules

All standard yamllint rules are supported:

| Rule | Description |
|------|-------------|
| `anchors` | Control use of anchors and aliases |
| `braces` | Control spacing inside braces `{}` |
| `brackets` | Control spacing inside brackets `[]` |
| `colons` | Control spacing around colons |
| `commas` | Control spacing around commas |
| `comments` | Control comment formatting |
| `comments-indentation` | Control comment indentation |
| `document-end` | Require or forbid document end markers |
| `document-start` | Require or forbid document start markers |
| `empty-lines` | Control blank lines |
| `empty-values` | Forbid empty values |
| `float-values` | Control float formatting |
| `hyphens` | Control spacing after hyphens |
| `indentation` | Control indentation |
| `key-duplicates` | Forbid duplicate keys |
| `key-ordering` | Enforce alphabetical key ordering |
| `line-length` | Control line length |
| `new-line-at-end-of-file` | Require newline at end of file |
| `new-lines` | Control newline type (LF/CRLF) |
| `octal-values` | Control octal value formatting |
| `quoted-strings` | Control string quoting |
| `trailing-spaces` | Forbid trailing spaces |
| `truthy` | Control truthy value formatting |

## Why yamllint-ts?

Unlike other VS Code YAML linters that shell out to the Python yamllint binary:

- **No dependencies** - Works out of the box without Python
- **Faster** - No process spawning overhead
- **Better integration** - Native TypeScript enables richer IDE features

## License

GPL-3.0
