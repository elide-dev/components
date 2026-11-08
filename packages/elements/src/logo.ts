import { LitElement, css, html, svg, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import {
  paths, GRADIENTS, BRAND_PURPLE, BRAND_MAGENTA,
  FULL_VIEWBOX, SQUARE_VIEWBOX, FULL_ASPECT, SQUARE_ASPECT,
  assetPath, resolveVariant, isThemed, SCALES, BASE_SIZE, DEFAULT_ASSET_BASE,
  type BrandForm, type BrandVariant, type BrandFormat, type BrandTheme,
} from '@elide/brand';

/** Portable brand mark. Import define/logo separately to register eld-logo. */
export class ElideLogoElement extends LitElement {
  static properties = {
    form: { type: String },
    variant: { type: String },
    format: { type: String },
    linked: { type: Boolean },
    height: { type: Number },
    accessibleLabel: { type: String, attribute: 'accessible-label' },
    decorative: { type: Boolean },
    assetBase: { type: String, attribute: 'asset-base' },
  };

  // Declare fields so native class fields cannot shadow Lit's reactive accessors.
  declare form: BrandForm;
  declare variant: BrandVariant;
  declare format: BrandFormat;
  declare linked: boolean;
  declare height: number | undefined;
  declare accessibleLabel: string;
  declare decorative: boolean;
  declare assetBase: string;

  constructor() {
    super();
    this.form = 'full';
    this.variant = 'gradient';
    this.format = 'svg';
    this.linked = false;
    this.height = undefined;
    this.accessibleLabel = 'Elide';
    this.decorative = false;
    this.assetBase = DEFAULT_ASSET_BASE;
  }

  static styles = css`
    :host {
      display: inline-block;
      vertical-align: middle;
      line-height: 0;
      color: var(--eld-logo-color, var(--foreground, inherit));
    }
    :host([hidden]) { display: none; }
    .frame {
      display: block;
      height: var(--eld-logo-height, var(--_height));
      width: calc(var(--eld-logo-height, var(--_height)) * var(--_aspect));
    }
    svg, img { display: block; height: 100%; width: 100%; }
    .light { display: var(--eld-brand-light-display, block); }
    .dark { display: var(--eld-brand-dark-display, none); }
  `;

  protected render() {
    const form = this.form === 'square' ? 'square' : 'full';
    const variant = resolveVariant(form, ['gradient', 'mono', 'blend'].includes(this.variant) ? this.variant : 'gradient');
    const format = ['svg', 'png', 'webp', 'avif'].includes(this.format) ? this.format : 'svg';
    const explicitHeight = typeof this.height === 'number' && Number.isFinite(this.height) && this.height > 0;
    const height = explicitHeight ? this.height! : 24;
    const vector = format === 'svg' && !this.linked;
    const aspect = form === 'square' ? SQUARE_ASPECT : FULL_ASPECT;
    // Match React's intrinsic raster ratio at its default CSS height. Explicit
    // sizes use the vector geometry for every format, rounded to hundredths.
    const width = explicitHeight ? Math.round(height * aspect * 100) / 100
      : height * (format === 'svg' ? aspect : BASE_SIZE[form].width / BASE_SIZE[form].height);
    return html`<span part="artwork" class="frame"
      style=${styleMap({ '--_height': `${height}px`, '--_aspect': String(width / height) })}
      role=${this.decorative ? nothing : 'img'}
      aria-label=${this.decorative ? nothing : this.accessibleLabel}
      aria-hidden=${this.decorative ? 'true' : nothing}>
      ${vector
        ? this.vector(form, variant, width, height)
        : this.images(form, variant, format, width, height)}
    </span>`;
  }

  private gradient(id: string, coordinates: { x1: number; y1: number; x2: number; y2: number }) {
    return svg`<linearGradient id=${id} x1=${coordinates.x1} y1=${coordinates.y1}
      x2=${coordinates.x2} y2=${coordinates.y2} gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color=${BRAND_PURPLE}></stop>
      <stop offset="1" stop-color=${BRAND_MAGENTA}></stop>
    </linearGradient>`;
  }

  private vector(form: BrandForm, variant: BrandVariant, width: number, height: number) {
    // IDs are scoped to each shadow root, so they stay deterministic during SSR.
    const body = form === 'square'
      ? variant === 'mono'
        ? svg`<path d=${`${paths.squareBody} ${paths.squareRibbon}`} fill="currentColor" fill-rule="evenodd"></path>`
        : svg`<defs>${this.gradient('body', GRADIENTS.squareBody)}</defs>
            <path d=${paths.squareBody} fill="url(#body)"></path>
            <path d=${paths.squareRibbon} fill="#ffffff"></path>`
      : svg`<defs>
          ${variant !== 'mono' ? this.gradient('glyph', GRADIENTS.fullGlyph) : nothing}
          ${variant === 'gradient' ? this.gradient('word', GRADIENTS.fullWordmark) : nothing}
        </defs>
        <path d=${paths.fullGlyph} fill=${variant === 'mono' ? 'currentColor' : 'url(#glyph)'}></path>
        <path d=${paths.fullWordmark} fill=${variant === 'gradient' ? 'url(#word)' : 'currentColor'}></path>`;
    return html`<svg aria-hidden="true" focusable="false"
      viewBox=${form === 'square' ? SQUARE_VIEWBOX : FULL_VIEWBOX}
      width=${width} height=${height}>${body}</svg>`;
  }

  private images(form: BrandForm, variant: BrandVariant, format: BrandFormat, width: number, height: number) {
    const themed = isThemed(form, variant);
    const image = (theme: BrandTheme) => {
      const options = { form, variant, format, theme, base: this.assetBase };
      return html`<img class=${themed ? theme : ''} alt="" aria-hidden="true"
        width=${width} height=${height} src=${assetPath(options)}
        srcset=${format === 'svg' ? nothing : SCALES.filter(scale => scale !== 1)
          .map(scale => `${assetPath({ ...options, scale })} ${scale}x`).join(', ')}>`;
    };
    return html`${image('light')}${themed ? image('dark') : nothing}`;
  }
}

/** Explicit registration, shared by browser entry and server integration. */
export function defineLogo(registry: CustomElementRegistry = customElements): void {
  const existing = registry.get('eld-logo');
  if (existing && existing !== ElideLogoElement) {
    throw new Error('eld-logo is already registered with a different constructor. Deduplicate @elide/elements.');
  }
  if (!existing) registry.define('eld-logo', ElideLogoElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'eld-logo': ElideLogoElement;
  }
}
