// Copyright (c) 2009 - 2020 [Codrops]
// MIT License

import anime from '../../vendor/anime.esm.js';

export function mount(el, opts = {}) {
  const DOM = {
    links: [...el.querySelectorAll('a')],
    items: [...el.querySelectorAll('.bg-scale-item')],
  };

  let current = 0;
  let isAnimating = false;

  if (DOM.items.length === 0) return { update() {}, destroy() {} };

  const showItem = (item) => {
    anime({
      targets: item,
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutQuad',
    });
  };

  const hideItem = (item) => {
    anime({
      targets: item,
      opacity: 1,
      duration: 400,
      easing: 'easeOutQuad',
    });
  };

  const onMouseEnter = (ev) => {
    if (isAnimating) return;

    const position = DOM.links.indexOf(ev.target);
    if (position === current) return;

    isAnimating = true;
    const prevItem = DOM.items[current];
    const nextItem = DOM.items[position];

    current = position;

    // Kill any running animations
    anime.set([prevItem, nextItem], {});

    // Hide previous
    hideItem(prevItem);

    // Show next
    showItem(nextItem);

    anime({
      targets: nextItem,
      scale: [1.1, 1],
      duration: 1800,
      easing: 'easeOutPower2',
      delay: 200,
      complete: () => { isAnimating = false; },
    });
  };

  DOM.links.forEach((link) => {
    link.addEventListener('mouseenter', onMouseEnter);
  });

  return {
    update() {},
    destroy() {
      DOM.links.forEach((link) => {
        link.removeEventListener('mouseenter', onMouseEnter);
      });
    },
  };
}

export const meta = {
  name: 'bg-scale-hover',
  kind: 'effect',
  version: '1.0.0',
  category: 'gallery',
  tags: ['hover', 'background', 'navigation', 'image'],
  summary: 'Navigation menu with a full-bleed background image that scales up on item hover, revealed through an expanding clip window.',
  needs: ['anime'],
  options: {
    duration: { type: 'number', default: 1800, description: 'Animation duration in ms' },
  },
  license: 'MIT',
  origin: {
    repo: 'codrops/BackgroundScaleHoverEffect',
    commit: '5ec048fcd4d43d7ec80260c2037065e6f77d6011',
    path: ['src/js/screen.js', 'src/js/navigation.js', 'src/css/base.css'],
  },
};
