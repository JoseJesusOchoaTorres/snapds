import * as vscode from 'vscode';
import { DsRegistry, type DsPackage } from './ds/dsRegistry';
import { DsIntrospector } from './ds/dsIntrospector';
import { Store } from './state/store';
import { GalleryViewProvider } from './views/galleryViewProvider';
import { PropsPanelProvider } from './views/propsPanelProvider';
import { SettingsPanelProvider } from './views/settingsPanelProvider';
import { registerDropProvider } from './providers/dropProvider';
import type { ComponentMeta } from './util/messaging';

export function activate(ctx: vscode.ExtensionContext): void {
  const registry = new DsRegistry(ctx);
  const introspector = new DsIntrospector(ctx);
  const store = new Store(ctx);

  const propsPanel = new PropsPanelProvider(ctx, {
    onReady: () => {
      const sel = store.getSelected();
      if (sel) {
        propsPanel.postComponentSchema(sel, store.getConfiguredProps(sel.id));
      }
    },
    onPropsUpdated: (componentId, props) => {
      store.setConfiguredProps(componentId, props);
    },
  });

  const gallery = new GalleryViewProvider(ctx, {
    onReady: async () => {
      gallery.postComponentList(store.listComponents());
    },
    onSearch: (_query) => {
      // Filtering happens in the webview; reserved for future server-side filtering.
    },
    onSelect: async (componentId) => {
      const meta = store.getComponent(componentId);
      if (!meta) return;
      store.select(componentId);
      propsPanel.postComponentSchema(meta, store.getConfiguredProps(componentId));
    },
  });

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GalleryViewProvider.viewId, gallery, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  registerDropProvider(ctx, store);

  const settingsPanel = new SettingsPanelProvider(ctx, {
    onReady: async () => {
      const allPkgs = await registry.discoverAllPackagesInWorkspace();
      const currentList = registry.list();
      settingsPanel.postPackageList(allPkgs.map(name => {
        const pkg = currentList.find(p => p.name === name);
        return {
          name,
          enabled: !!pkg,
          blacklist: pkg?.blacklist || []
        };
      }));
    },
    onSavePackages: async (packages) => {
      settingsPanel.postSaving();

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Updating Snapds Packages...",
        cancellable: false
      }, async (progress) => {
        const oldList = registry.list();
        const currentList = oldList.map(p => p.name);
        const incomingNames = packages.map(p => p.name);

        const toDisable = currentList.filter(name => !incomingNames.includes(name));

        // Update or enable incoming packages
        for (const pkg of packages) {
          await registry.updatePackage(pkg.name, true, pkg.blacklist);
        }

        for (const name of toDisable) {
          await registry.updatePackage(name, false);
        }

        const activePackages = registry.list();
        let allComponents: ComponentMeta[] = [];

        for (const pkg of activePackages) {
          const oldPkg = oldList.find(p => p.name === pkg.name);
          const isNew = !oldPkg;
          const blacklistChanged = oldPkg && (oldPkg.blacklist?.join(',') !== pkg.blacklist?.join(','));
          const needsForce = isNew || blacklistChanged || false;

          progress.report({ message: `Introspecting ${pkg.name}...` });
          try {
            const newComponents: ComponentMeta[] = await introspector.introspect(pkg, { force: needsForce });
            allComponents = allComponents.concat(newComponents);
          } catch (e) {
            vscode.window.showErrorMessage(
              `Failed to introspect ${pkg.name}: ${(e as Error).message}`
            );
          }
        }

        store.setComponents(allComponents);
        gallery.postComponentList(allComponents);
      });

      settingsPanel.postSaved();

      const allPkgs = await registry.discoverAllPackagesInWorkspace();
      const newList = registry.list();
      settingsPanel.postPackageList(allPkgs.map(name => {
        const pkg = newList.find(p => p.name === name);
        return {
          name,
          enabled: !!pkg,
          blacklist: pkg?.blacklist || []
        };
      }));
    }
  });

  ctx.subscriptions.push(
    vscode.commands.registerCommand('snapds.openSettings', () => {
      settingsPanel.show();
    }),

    vscode.commands.registerCommand('snapds.openPropsPanel', () => {
      propsPanel.show();
    }),
  );

  void (async () => {
    const list = registry.list();
    if (list.length > 0) {
      // Refresh all configured packages in the workspace concurrently
      await Promise.all(list.map((pkg) => refreshActiveComponents(pkg)));
    }
  })();

  async function refreshActiveComponents(pkg: DsPackage): Promise<void> {
    try {
      const newComponents: ComponentMeta[] = await introspector.introspect(pkg);
      // Append these components to our store instead of overwriting the previous ones
      const existing = store.listComponents();
      // Remove any that might belong to the same package if it's being updated
      const filtered = existing.filter(c => !c.id.startsWith(`${pkg.name}#`));

      const combined = [...filtered, ...newComponents];

      store.setComponents(combined);
      gallery.postComponentList(combined);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failed to introspect ${pkg.name}: ${(e as Error).message}`,
      );
    }
  }
}

export function deactivate(): void {
  // no-op
}
