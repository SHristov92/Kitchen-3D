import { h } from './dom.js';

/**
 * Google AdSense settings. Fill in both values to turn the ad on:
 *   client: your publisher ID, e.g. 'ca-pub-1234567890123456'
 *   slot:   the ad unit ID from AdSense > Ads > By ad unit, e.g. '1234567890'
 * Create the ad unit as a fixed-size 250 × 250 display ad. While either value is
 * empty, a neutral placeholder is shown and no Google script is loaded.
 */
export const ADSENSE = {
  client: '',
  slot: '',
};

export const AD_WIDTH = 250;
export const AD_HEIGHT = 250;

const SCRIPT_ID = 'adsense-loader';

export function adsConfigured(cfg = ADSENSE) {
  return /^ca-pub-\d+$/.test(cfg.client) && /^\d+$/.test(cfg.slot);
}

/** The ad slot shown at the bottom of the object library. */
export function renderAdSlot(cfg = ADSENSE) {
  const box = h('div', { class: 'ad-slot', style: `width:${AD_WIDTH}px;height:${AD_HEIGHT}px` });
  const wrap = h('aside', { class: 'ad-wrap', 'aria-label': 'Advertisement' },
    h('div', { class: 'ad-label' }, 'Advertisement'), box);

  if (!adsConfigured(cfg)) {
    box.classList.add('ad-placeholder');
    box.append(h('span', {}, 'Ad space'), h('span', { class: 'ad-size' }, `${AD_WIDTH} × ${AD_HEIGHT}`));
    return wrap;
  }

  box.append(h('ins', {
    class: 'adsbygoogle',
    style: `display:inline-block;width:${AD_WIDTH}px;height:${AD_HEIGHT}px`,
    'data-ad-client': cfg.client,
    'data-ad-slot': cfg.slot,
  }));
  if (!document.getElementById(SCRIPT_ID)) {
    document.head.append(h('script', {
      id: SCRIPT_ID, async: true, crossorigin: 'anonymous',
      src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.client)}`,
    }));
  }
  // Ask AdSense to fill the slot once it is actually on screen: the Library tab starts
  // hidden, and AdSense cannot size a slot inside a hidden panel.
  const fill = () => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an ad blocker */ }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fill(); }
    });
    io.observe(box);
  } else {
    setTimeout(fill, 0);
  }
  return wrap;
}
