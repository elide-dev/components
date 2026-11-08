import type { Meta, StoryObj } from '@storybook/react-vite';
import { ElideLogo } from '../elements/logo';
import { ElideLogo as Legacy } from '../components/elide-logo';

const meta = {
  title: 'Brand/ElideLogoElement',
  component: ElideLogo,
  args: { form: 'full', variant: 'gradient', height: 40, title: 'Elide' },
} satisfies Meta<typeof ElideLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Parity: Story = {
  render: () => <div style={{ display: 'grid', gap: 24 }}>
    {(['full', 'square'] as const).flatMap(form => (['gradient', 'mono', 'blend'] as const).map(variant =>
      <div key={`${form}-${variant}`} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Legacy form={form} variant={variant} height={48} />
        <ElideLogo form={form} variant={variant} height={48} />
      </div>,
    ))}
  </div>,
};
export const Formats: Story = {
  render: () => <div style={{ display: 'flex', gap: 32 }}>
    {(['svg', 'png', 'webp', 'avif'] as const).map(format =>
      <ElideLogo key={format} variant="blend" format={format} height={40} />,
    )}
    <ElideLogo variant="blend" linked height={40} />
  </div>,
};
