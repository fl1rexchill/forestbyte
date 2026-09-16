/**
 * shared/anim.js — мягкая загрузка anime.js v4 (https://animejs.com).
 *
 * Виджеты используют анимации «прогрессивно»: если CDN недоступен, виджет всё равно
 * работает, просто без анимации. Модуль кэшируется — грузится один раз на страницу.
 *
 * Использование в виджете:
 *   import { loadAnime } from "../shared/anim.js";
 *   const A = await loadAnime();
 *   if (A) A.animate(el, { opacity: [0,1], translateY: [20,0], duration: 500, ease: "outExpo" });
 *
 * API v4 (именованные экспорты): animate, stagger, createTimeline, createTimer,
 * onScroll, utils, eases/easings, svg, ... (default-экспорта нет).
 */
const CDN = "https://cdn.jsdelivr.net/npm/animejs@4/+esm";

let _promise = null;

export function loadAnime() {
  if (!_promise) {
    _promise = import(/* @vite-ignore */ CDN).catch((e) => {
      console.warn("anim.js: не удалось загрузить anime.js, работаем без анимаций", e);
      return null;
    });
  }
  return _promise;
}

/** Уважать prefers-reduced-motion: не анимировать, если пользователь просил меньше движения. */
export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
