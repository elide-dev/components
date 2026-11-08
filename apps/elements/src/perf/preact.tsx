// The same component and local-state driver, compiled through preact/compat.
// This isolates the runtime choice instead of comparing different markup.
import { ElideLogo } from '@elide/ui/components/elide-logo';
import { startReact } from './react-driver';

startReact(ElideLogo);
