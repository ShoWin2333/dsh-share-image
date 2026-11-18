const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Exercise the actual parser/layout helpers without a DSH host or DOM. Font
// metrics deliberately distinguish regular/bold so state leaks are observable.
const source = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');
const start = source.indexOf('    function unescapeMarkdown');
const end = source.indexOf('    function layoutMessageBlocks');
assert.ok(start >= 0 && end > start, 'renderer helper section exists');
const metricStart = source.indexOf('    function measureTextWidth');
const metricEnd = source.indexOf('\n    }', metricStart) + 6;
assert.ok(metricStart >= 0 && metricEnd > metricStart);
const context = vm.createContext({});
vm.runInContext('const SANS = "sans-serif";\n' + source.slice(start, end) + source.slice(metricStart, metricEnd) +
  '\nglobalThis.api = { parseBlocks, tableCellLines, layoutTable };', context);
const { parseBlocks, tableCellLines, layoutTable } = context.api;
const plain = (value) => JSON.parse(JSON.stringify(value));
const measure = () => ({ font: '', measureText(text) {
  return { width: [...text].length * (this.font.startsWith('700 ') ? 10 : 5) };
} });

for (const text of ['left | right\n---', '| a | b |\n| --- |', '| a |\n| --- | --- |']) {
  test('preserves mismatched table header: ' + JSON.stringify(text), () => {
    const blocks = plain(parseBlocks(text));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, 'p');
    assert.equal(blocks[0].text, text);
  });
}
test('parses matching headers, alignment and escaped pipes', () => {
  const blocks = plain(parseBlocks('| Name | Value |\n| :--- | ---: |\n| a\\|b | 18.4% |'));
  assert.deepEqual(blocks, [{kind:'table', aligns:['left','right'], header:['Name','Value'], rows:[['a|b','18.4%']]}]);
});
test('supports tables without outer pipes and single-column tables', () => {
  assert.equal(parseBlocks('A | B\n--- | ---\nx | y')[0].kind, 'table');
  assert.equal(parseBlocks('| A |\n| --- |\n| x |')[0].rows[0][0], 'x');
});
test('paragraphs and lists yield to a matching table', () => {
  assert.deepEqual(plain(parseBlocks('intro\n| A |\n| --- |')).map(b=>b.kind), ['p','table']);
  assert.deepEqual(plain(parseBlocks('- item\n| A |\n| --- |')).map(b=>b.kind), ['item','table']);
});
test('ordinary prose and code fences remain intact', () => {
  assert.equal(parseBlocks('left | right')[0].text, 'left | right');
  assert.equal(parseBlocks('```\n| A |\n| --- |\n```')[0].kind, 'code');
});
test('measures every word in a bold run with the bold font', () => {
  const {lines} = tableCellLines(measure(), '**alpha beta gamma**', '13px sans-serif', 200);
  assert.deepEqual(plain(lines[0].filter(t=>!t.space).map(t=>t.width)), [50,40,50]);
});
test('bold run wraps using actual rendered widths after spaces', () => {
  const {lines} = tableCellLines(measure(), '**alpha beta**', '13px sans-serif', 80);
  assert.deepEqual(plain(lines.map(line=>line.map(t=>t.text).join(''))), ['alpha','beta']);
});
test('overlong bold words retain bold character widths and regular runs reset', () => {
  const {lines} = tableCellLines(measure(), '**a abcdef** z', '13px sans-serif', 35);
  const tokens = lines.flat().filter(t=>!t.space);
  assert.ok(tokens.filter(t=>t.bold).every(t=>t.width === t.text.length*10));
  assert.equal(tokens.find(t=>t.text==='z').width, 5);
});
test('layout emits non-overlapping text and finite table operations', () => {
  const ops = [];
  const metrics = measure();
  const block = parseBlocks('| Name | Value |\n| --- | ---: |\n| **alpha beta gamma** | 18.4% |')[0];
  const height = layoutTable(ops, block, 0, 0, 300, metrics, {tableBg:'white',tableHead:'gray',tableBorder:'black',heading:'black',body:'black'});
  assert.ok(height > 0 && Number.isFinite(height));
  const rows = new Map();
  for (const op of ops.filter(op=>op.t==='text')) {
    const line = rows.get(op.y) || [];
    line.push(op); rows.set(op.y,line);
  }
  for (const line of rows.values()) {
    line.sort((a,b)=>a.x-b.x);
    for (let i=1;i<line.length;i++) {
      metrics.font=line[i-1].f;
      assert.ok(line[i-1].x + metrics.measureText(line[i-1].s).width <= line[i].x + 1e-6);
    }
  }
});
