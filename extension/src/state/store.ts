import type { ComponentMeta } from '../util/messaging';

export class Store {
  private components = new Map<string, ComponentMeta>();
  private configured = new Map<string, Record<string, unknown>>();
  private selected: string | undefined;

  setComponents(list: ComponentMeta[]): void {
    this.components.clear();
    for (const c of list) this.components.set(c.id, c);
  }

  getComponent(id: string): ComponentMeta | undefined {
    return this.components.get(id);
  }

  listComponents(): ComponentMeta[] {
    return [...this.components.values()];
  }

  select(id: string): void {
    this.selected = id;
  }

  getSelected(): ComponentMeta | undefined {
    return this.selected ? this.components.get(this.selected) : undefined;
  }

  setConfiguredProps(id: string, props: Record<string, unknown>): void {
    this.configured.set(id, props);
  }

  getConfiguredProps(id: string): Record<string, unknown> | undefined {
    return this.configured.get(id);
  }
}
