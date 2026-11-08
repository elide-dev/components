import { ElideLogoElement, defineLogo } from '@elide/elements/logo';
import { start } from './driver';

defineLogo();
const app = document.querySelector('#app')!;
let elements: ElideLogoElement[] = [];
start({
  async mount(count) {
    const fragment = document.createDocumentFragment();
    elements = Array.from({ length: count }, (_, index) => {
      const cell = document.createElement('div');
      cell.dataset.item = String(index);
      const logo = new ElideLogoElement();
      logo.form = 'full';
      logo.variant = 'mono';
      logo.height = 24;
      logo.decorative = true;
      cell.append(logo);
      fragment.append(cell);
      return logo;
    });
    app.replaceChildren(fragment);
    await Promise.all(elements.map(element => element.updateComplete));
  },
  async update(indices, height) {
    const selected = indices.map(index => elements[index]);
    for (const element of selected) element.height = height;
    await Promise.all(selected.map(element => element.updateComplete));
  },
  async clear() { app.replaceChildren(); elements = []; },
});
