import type { MonitorTask } from './types';

// Only the background worker writes monitors; queued operations read fresh state.
export function createMonitorMutator(
  read: () => Promise<MonitorTask[]>,
  write: (items: MonitorTask[]) => Promise<void>
) {
  let pending: Promise<unknown> = Promise.resolve();
  return (update: (items: MonitorTask[]) => MonitorTask[]) => {
    const result = pending.then(async () => {
      const items = update(await read());
      await write(items);
      return items;
    });
    pending = result.catch(() => {});
    return result;
  };
}

// A response to an old request must never resurrect a deleted or edited monitor.
export function mergeMonitorPrices(current: MonitorTask[], before: MonitorTask[], after: MonitorTask[]): MonitorTask[] {
  return current.map(item => {
    const original = before.find(old => old.id === item.id);
    const updated = after.find(next => next.id === item.id);
    return original && updated && JSON.stringify(original) === JSON.stringify(item) ? updated : item;
  });
}
