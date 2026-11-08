import { html, nothing } from 'lit';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { defineLogo } from './logo.js';
import type { BrandForm, BrandVariant, BrandFormat } from '@elide/brand';

export interface LogoOptions {
  form?: BrandForm;
  variant?: BrandVariant;
  format?: BrandFormat;
  linked?: boolean;
  height?: number;
  accessibleLabel?: string;
  decorative?: boolean;
  assetBase?: string;
}

/**
 * Server-only HTML with declarative shadow DOM and inline critical styles.
 * Visible without JS. To upgrade, load Lit hydration support before Lit.
 * Treat the returned markup as trusted output, never concatenate raw user HTML.
 */
export function renderLogo(options: LogoOptions = {}): string {
  defineLogo();
  return collectResultSync(render(html`<eld-logo
    form=${options.form ?? 'full'} variant=${options.variant ?? 'gradient'}
    format=${options.format ?? 'svg'} height=${options.height ?? nothing}
    accessible-label=${options.accessibleLabel ?? 'Elide'}
    asset-base=${options.assetBase ?? '/brand'}
    ?linked=${options.linked} ?decorative=${options.decorative}
  ></eld-logo>`));
}
