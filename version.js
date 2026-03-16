const SITE_VERSION = '1.4.2';

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('siteVersion');
  if (el) el.textContent = 'v' + SITE_VERSION;
});
