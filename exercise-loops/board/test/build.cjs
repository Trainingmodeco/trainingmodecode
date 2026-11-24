// Refreshes test/index.html from ../index.html, wrapped the way the published page is, with the mock runtime in front. Also syntax-checks the inline script.
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'index.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><script src="mock.js"></script></head><body>' + page + '</body></html>');
fs.copyFileSync(path.join(__dirname, '..', 'board.json'), path.join(__dirname, 'board.json'));
const m = /<script>([\s\S]*?)<\/script>/.exec(page);
new vm.Script(m[1], { filename: 'inline-script.js' });
console.log('test/index.html refreshed, inline script parses (' + m[1].split('\n').length + ' lines, page ' + page.length + ' bytes)');
