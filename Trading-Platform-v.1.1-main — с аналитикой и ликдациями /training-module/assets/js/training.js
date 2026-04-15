document.addEventListener('DOMContentLoaded', function () {
  const contentDivs = document.querySelectorAll('div.content');
  contentDivs.forEach(div => {
    div.setAttribute('data-aos', 'fade-up');
    div.setAttribute('data-aos-delay', '600');
    div.setAttribute('data-aos-duration', '600');
  });

  if (window.AOS) {
    AOS.init();
  }
});
