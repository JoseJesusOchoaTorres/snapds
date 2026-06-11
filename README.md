# Snapds (VS Code Extension)

Snapds is a powerful VS Code extension designed for React monorepos. It introspects your packages, extracts component metadata using `react-docgen-typescript`, and provides a seamless webview gallery for visually exploring and drag-and-dropping JSX components directly into your code.

## Features

- 🧩 **Visual Component Gallery**: Browse all available components from your registered packages in a dedicated sidebar webview.
- 🚀 **Drag and Drop JSX**: Drag a component from the gallery and drop it into your React code. Snapds automatically generates the correct JSX and handles the necessary import statements.
- 📦 **Smart Import Management**: Automatically injects new imports without duplicating existing ones. It correctly handles multi-line Prettier-formatted imports and updates them seamlessly.
- ⚡ **Performance Optimized**: Uses advanced caching based on file modification times (`mtime`) and differential updates to ensure the introspection and gallery remain blazingly fast.

## Configuration Hierarchy

Snapds uses a 3-level cascading configuration system to give you maximum flexibility:

1. **Auto (AST Introspection)**: By default, Snapds parses your TypeScript components to determine properties, types, and default values.
2. **Team / Workspace (`snapds.config.json`)**: You can define a `snapds.config.json` (or `.snapds.json`) file at the root of your workspace to provide corporate overrides, custom snippets, and ignore lists for specific components.
3. **User (`.vscode/settings.json`)**: Individual user preferences and package registrations are saved in your personal workspace settings under the `snapds.packages` key.

### Workspace Overrides (`snapds.config.json`)

To override default introspection or provide custom drag-and-drop snippets, create a `snapds.config.json` file in the root of your workspace:

```json
{
  "ignore": ["InternalHelperComponent"],
  "overrides": {
    "Button": {
      "snippet": "<Button variant=\"primary\" onClick={() => {}}>\n  $1\n</Button>"
    }
  }
}
```

When a `snapds.config.json` file is present, any changes to it will automatically invalidate the cache and refresh the gallery.

## Extension Commands

Snapds provides the following commands via the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`):

- **`Snapds: Open Settings`**: Opens the package management and configuration panel.
- **`Snapds: Open Props Panel`**: Opens a dedicated panel for editing component properties.

## Getting Started (Development)

This extension is built as a monorepo containing the VS Code extension and multiple Vite-based React applications for the webviews.

To build and run the extension locally:

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Build the extension and webviews:
   ```bash
   pnpm run build
   ```
3. Open the project in VS Code, press `F5` to open a new Extension Development Host window.
4. In the new window, open a React project, click on the **Snapds** icon in the Activity Bar, and start exploring your components!
