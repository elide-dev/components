import * as React from 'react';
import { createComponent } from '@lit/react';
import { ElideLogoElement, defineLogo } from '@elide/elements/logo';
import type { ElideLogoProps } from '../components/elide-logo';

const Logo = createComponent({ react: React, tagName: 'eld-logo', elementClass: ElideLogoElement });

/**
 * Additive browser adapter. Ref/className/style target eld-logo, not an SVG.
 * For static SSR use @elide/elements/ssr or the existing React ElideLogo.
 */
export const ElideLogo = React.forwardRef<ElideLogoElement, ElideLogoProps>(
  ({ title = 'Elide', form, markOnly, ...props }, ref) => {
    // Registration is idempotent and occurs before React creates the host.
    // Never register a browser constructor into an SSR shim from this adapter.
    if (typeof window !== 'undefined') defineLogo();
    return <Logo {...props} ref={ref} accessibleLabel={title} form={form ?? (markOnly ? 'square' : 'full')} />;
  },
);
ElideLogo.displayName = 'ElideLogoElement';
