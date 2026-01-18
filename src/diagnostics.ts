/**
 * yamllint-ts VS Code Extension
 * Diagnostic provider for YAML linting
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { runAll, YamlLintConfig, LintProblem } from 'yamllint-ts';

// Configuration file names to search for (in order of priority)
const CONFIG_FILE_NAMES = [
  '.yamllint',
  '.yamllint.yaml',
  '.yamllint.yml',
  '.yamllint.json',
];

// Default yamllint configuration (inlined to avoid import.meta.url issues in bundled extension)
// This matches yamllint-ts's default.yaml configuration
const DEFAULT_CONFIG = `---
yaml-files:
  - '*.yaml'
  - '*.yml'
  - '.yamllint'

rules:
  anchors: enable
  braces: enable
  brackets: enable
  colons: enable
  commas: enable
  comments:
    level: warning
  comments-indentation:
    level: warning
  document-end: disable
  document-start:
    level: warning
  empty-lines: enable
  empty-values: disable
  float-values: disable
  hyphens: enable
  indentation: enable
  key-duplicates: enable
  key-ordering: disable
  line-length: enable
  new-line-at-end-of-file: enable
  new-lines: enable
  octal-values: disable
  quoted-strings: disable
  trailing-spaces: enable
  truthy:
    level: warning
`;

/**
 * Provides diagnostics for YAML files using yamllint-ts.
 */
export class YamlLintDiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private configCache: Map<string, YamlLintConfig | null> = new Map();
  private debounceTime: number = 300;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('yamllint');
    this.updateConfiguration();
  }

  /**
   * Update cached configuration values.
   */
  updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration('yamllint');
    this.debounceTime = config.get<number>('debounceTime', 300);
    // Clear config cache when configuration changes
    this.configCache.clear();
  }

  /**
   * Lint a document and update diagnostics.
   */
  async lint(document: vscode.TextDocument): Promise<void> {
    const config = vscode.workspace.getConfiguration('yamllint');
    
    if (!config.get<boolean>('enable', true)) {
      this.clear(document);
      return;
    }

    console.log(`yamllint: Linting ${document.uri.fsPath}`);

    try {
      const yamlConfig = this.getYamlLintConfig(document);
      const content = document.getText();
      const filepath = document.uri.fsPath;

      console.log(`yamllint: Got config, content length: ${content.length}`);

      // Run yamllint (runAll returns an array of problems)
      const problems = runAll(content, yamlConfig, filepath);

      console.log(`yamllint: Found ${problems.length} problems`);

      // Convert problems to VS Code diagnostics
      const diagnostics = problems.map((problem) => this.problemToDiagnostic(problem, document));

      this.diagnosticCollection.set(document.uri, diagnostics);
      console.log(`yamllint: Set ${diagnostics.length} diagnostics`);
    } catch (error) {
      console.error('yamllint error:', error);
      // Show a single error diagnostic if linting fails
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `yamllint error: ${error instanceof Error ? error.message : String(error)}`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = 'yamllint';
      this.diagnosticCollection.set(document.uri, [diagnostic]);
    }
  }

  /**
   * Lint a document with debouncing (for change events).
   */
  lintWithDebounce(document: vscode.TextDocument): void {
    const uri = document.uri.toString();

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(uri);
      this.lint(document);
    }, this.debounceTime);

    this.debounceTimers.set(uri, timer);
  }

  /**
   * Clear diagnostics for a document.
   */
  clear(document: vscode.TextDocument): void {
    this.diagnosticCollection.delete(document.uri);
    
    // Clear any pending debounce timer
    const uri = document.uri.toString();
    const timer = this.debounceTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(uri);
    }
  }

  /**
   * Get or create yamllint configuration for a document.
   */
  private getYamlLintConfig(document: vscode.TextDocument): YamlLintConfig {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const workspacePath = workspaceFolder?.uri.fsPath;

    // Check for user-specified config path
    const userConfigPath = vscode.workspace.getConfiguration('yamllint').get<string>('config', '');
    
    if (userConfigPath) {
      // Resolve relative paths against workspace
      const resolvedPath = workspacePath 
        ? path.resolve(workspacePath, userConfigPath)
        : userConfigPath;
      
      if (this.configCache.has(resolvedPath)) {
        const cached = this.configCache.get(resolvedPath);
        if (cached) return cached;
      }

      try {
        const config = YamlLintConfig.fromFile(resolvedPath);
        this.configCache.set(resolvedPath, config);
        return config;
      } catch (error) {
        console.warn(`Failed to load config from ${resolvedPath}:`, error);
      }
    }

    // Search for config file in workspace
    if (workspacePath) {
      for (const configName of CONFIG_FILE_NAMES) {
        const configPath = path.join(workspacePath, configName);
        
        if (this.configCache.has(configPath)) {
          const cached = this.configCache.get(configPath);
          if (cached) return cached;
        }

        try {
          if (fs.existsSync(configPath)) {
            const config = YamlLintConfig.fromFile(configPath);
            this.configCache.set(configPath, config);
            return config;
          }
        } catch (error) {
          console.warn(`Failed to load config from ${configPath}:`, error);
        }
      }
    }

    // Fall back to default configuration
    const defaultKey = '__default__';
    if (this.configCache.has(defaultKey)) {
      const cached = this.configCache.get(defaultKey);
      if (cached) return cached;
    }

    // Use inlined default config to avoid import.meta.url issues when bundled
    const config = new YamlLintConfig(DEFAULT_CONFIG);
    this.configCache.set(defaultKey, config);
    return config;
  }

  /**
   * Convert a yamllint problem to a VS Code diagnostic.
   */
  private problemToDiagnostic(
    problem: LintProblem,
    document: vscode.TextDocument
  ): vscode.Diagnostic {
    // yamllint uses 1-based line/column, VS Code uses 0-based
    const line = Math.max(0, problem.line - 1);
    const column = Math.max(0, problem.column - 1);

    // Try to get the word at the error position for better range
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    let endColumn = column;

    // Extend range to end of word or end of line
    while (endColumn < lineText.length && !/\s/.test(lineText[endColumn]!)) {
      endColumn++;
    }

    // If we couldn't extend, at least highlight one character
    if (endColumn === column) {
      endColumn = Math.min(column + 1, lineText.length);
    }

    const range = new vscode.Range(line, column, line, endColumn);

    // Map level to severity
    const severity = problem.level === 'error'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(range, problem.message, severity);
    diagnostic.source = 'yamllint';
    
    if (problem.rule) {
      diagnostic.code = problem.rule;
    }

    return diagnostic;
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.diagnosticCollection.dispose();
    
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.configCache.clear();
  }
}
