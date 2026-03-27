const SITE_VERSION = '1.5.3';

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('siteVersion');
  if (el) el.textContent = 'v' + SITE_VERSION;
});
