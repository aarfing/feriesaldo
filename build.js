const fs = require('fs');
const path = require('path');
const dir = __dirname;
const core = fs.readFileSync(path.join(dir, 'core.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
const ui = fs.readFileSync(path.join(dir, 'ui.js'), 'utf8');
const src = '(function(){\n' + core + '\n' + ui + '\n})();';
fs.writeFileSync(path.join(dir, 'bookmarklet.js'), src);
const url = 'javascript:' + encodeURIComponent(src);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
fs.writeFileSync(
  path.join(dir, 'install.html'),
  '<meta charset="utf-8"><h2>Feriesaldo til TOR</h2><p>Træk linket til din bogmærkelinje. Åbn TOR, klik på bogmærket, og klik derefter på fanen "Saldi".</p><p><a href="' +
    esc(url) +
    '">Feriesaldo</a></p>'
);
console.log('bookmarklet bytes:', url.length);
