// Intersection Observer for scroll animations
const observerOptions = {
  // threshold 0 = animasi mulai begitu sedikit saja elemen terlihat.
  // (Sebelumnya 0.2 = harus 20% terlihat; di HP section daftar kos setinggi
  // ~4000px tidak pernah mencapai 20% sehingga tetap transparan selamanya.)
  threshold: 0,
  // margin negatif hanya di bawah: elemen baru dianggap "terlihat" saat
  // sudah masuk 50px dari tepi bawah layar
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // Unobserve after animation to improve performance
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe all elements with data-animate attribute
document.addEventListener('DOMContentLoaded', () => {
  const animatedElements = document.querySelectorAll('[data-animate]');
  animatedElements.forEach(el => {
    el.classList.add('animate-on-scroll');
    observer.observe(el);
  });
});
