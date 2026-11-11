// Small, one-time motion. Runs only when the visitor has not asked for reduced motion.
// The page head sets the "js-motion" class early; this script marks itself as loaded so that class stays.
(function () {
  window.__stsMotion = true;
  var root = document.documentElement;
  if (!root.classList.contains('js-motion')) return;

  // Cubes stack up and the Keim devices slide in, once, when they come into view.
  var targets = document.querySelectorAll('[data-stack], [data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.25 });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  }

  // The hero picture's layers drift apart a little as the hero scrolls away (CSS reads --sp, 0 to 1).
  var hero = document.querySelector('.hero');
  var art = document.querySelector('.hero-art');
  if (!hero || !art) return;
  var ticking = false;
  function update() {
    ticking = false;
    var r = hero.getBoundingClientRect();
    var p = Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
    art.style.setProperty('--sp', p.toFixed(3));
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
})();
