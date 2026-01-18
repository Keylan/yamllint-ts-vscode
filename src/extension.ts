/**
 * yamllint-ts VS Code Extension
 * 
 * Provides YAML linting using the native TypeScript yamllint implementation.
 */

import * as vscode from 'vscode';
import { YamlLintDiagnosticProvider } from './diagnostics.js';

let diagnosticProvider: YamlLintDiagnosticProvider | undefined;
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation - called when VS Code activates the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('yamllint-ts');
  outputChannel.appendLine('yamllint-ts extension is now active');
  console.log('yamllint-ts extension is now active');

  try {
    // Create diagnostic provider
    diagnosticProvider = new YamlLintDiagnosticProvider();
    outputChannel.appendLine('Diagnostic provider created successfully');
  } catch (error) {
    outputChannel.appendLine(`Error creating diagnostic provider: ${error}`);
    console.error('Error creating diagnostic provider:', error);
    return;
  }

  // Register document event listeners
  context.subscriptions.push(
    // Lint on open
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (shouldLint(document, 'lintOnOpen')) {
        diagnosticProvider?.lint(document);
      }
    }),

    // Lint on save
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (shouldLint(document, 'lintOnSave')) {
        diagnosticProvider?.lint(document);
      }
    }),

    // Lint on change (debounced)
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (shouldLint(event.document, 'lintOnChange')) {
        diagnosticProvider?.lintWithDebounce(event.document);
      }
    }),

    // Clear diagnostics when document is closed
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnosticProvider?.clear(document);
    }),

    // Re-lint when configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('yamllint')) {
        diagnosticProvider?.updateConfiguration();
        // Re-lint all open YAML documents
        vscode.workspace.textDocuments.forEach((document) => {
          if (isYamlDocument(document)) {
            diagnosticProvider?.lint(document);
          }
        });
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('yamllint.lint', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isYamlDocument(editor.document)) {
        diagnosticProvider?.lint(editor.document);
      }
    }),

    vscode.commands.registerCommand('yamllint.lintWorkspace', async () => {
      await lintWorkspace();
    })
  );

  // Register the diagnostic collection for cleanup
  context.subscriptions.push(diagnosticProvider);

  // Lint all currently open YAML documents
  vscode.workspace.textDocuments.forEach((document) => {
    if (shouldLint(document, 'lintOnOpen')) {
      diagnosticProvider?.lint(document);
    }
  });
}

/**
 * Extension deactivation - called when VS Code deactivates the extension.
 */
export function deactivate(): void {
  diagnosticProvider?.dispose();
  diagnosticProvider = undefined;
}

/**
 * Check if a document is a YAML file.
 */
function isYamlDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'yaml' || 
         document.fileName.endsWith('.yaml') || 
         document.fileName.endsWith('.yml');
}

/**
 * Check if we should lint a document based on configuration.
 */
function shouldLint(document: vscode.TextDocument, trigger: 'lintOnOpen' | 'lintOnSave' | 'lintOnChange'): boolean {
  if (!isYamlDocument(document)) {
    return false;
  }

  const config = vscode.workspace.getConfiguration('yamllint');
  
  if (!config.get<boolean>('enable', true)) {
    return false;
  }

  return config.get<boolean>(trigger, true);
}

/**
 * Lint all YAML files in the workspace.
 */
async function lintWorkspace(): Promise<void> {
  const config = vscode.workspace.getConfiguration('yamllint');
  
  if (!config.get<boolean>('enable', true)) {
    vscode.window.showWarningMessage('yamllint is disabled');
    return;
  }

  // Find all YAML files
  const files = await vscode.workspace.findFiles('**/*.{yaml,yml}', '**/node_modules/**');
  
  if (files.length === 0) {
    vscode.window.showInformationMessage('No YAML files found in workspace');
    return;
  }

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Linting YAML files',
      cancellable: true,
    },
    async (progress, token) => {
      let processed = 0;
      const total = files.length;

      for (const file of files) {
        if (token.isCancellationRequested) {
          break;
        }

        progress.report({
          message: `${processed}/${total} files`,
          increment: (1 / total) * 100,
        });

        try {
          const document = await vscode.workspace.openTextDocument(file);
          await diagnosticProvider?.lint(document);
        } catch (error) {
          console.error(`Error linting ${file.fsPath}:`, error);
        }

        processed++;
      }

      vscode.window.showInformationMessage(`Linted ${processed} YAML files`);
    }
  );
}
