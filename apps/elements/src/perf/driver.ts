export interface LogoDriver {
  mount(count: number): Promise<void>;
  update(indices: number[], height: number): Promise<void>;
  clear(): Promise<void>;
}

declare global {
  interface Window {
    logoDriver: LogoDriver;
    logoReady: Promise<void>;
  }
}

/** Same initial data and ready boundary in every runtime-bearing fixture. */
export function start(driver: LogoDriver) {
  const count = Number(new URLSearchParams(location.search).get('count') ?? 1);
  if (![1, 100, 1000].includes(count)) throw new Error('count must be 1, 100, or 1000');
  window.logoDriver = driver;
  window.logoReady = driver.mount(count).then(() => { performance.mark('eld:ready'); });
}
