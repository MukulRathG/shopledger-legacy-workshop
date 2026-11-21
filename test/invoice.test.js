var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice matches the amount and GST breakdown used for billing', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.tax };
  }));
});

test('CURRENT BEHAVIOUR: order pricing applies HSN GST to post-discount taxable value', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var totals = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 5,
      taxable: 95,
      tax: 4.75,
      net: 99.75
    }]
  });
});

test('invoice applies the billed HSN slab to line GST and totals', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.deepEqual(figures, {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 5
    }]
  });
});

test('invoice applies the billed GST rate and coupon to post-discount taxable value', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'WELCOME',
    items: [{ name: 'Tea', gstRate: 0.05, price: 100, qty: 1 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 4.75);
  assert.equal(figures.discount, 5);
  assert.equal(figures.total, 99.75);
});

test('invoice renders the same computed total as the order ledger without a mismatch notice', function () {
  var html = invoice.render({
    id: 42,
    date: '2026-11-21',
    total: 105,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice escapes item and customer text in rendered HTML', function () {
  var html = invoice.render({
    id: 7,
    customer: '<Buyer & Co>',
    items: [{ name: '<Rice & Dal>', price: 1, qty: 1 }]
  });

  assert.match(html, /&lt;Buyer &amp; Co&gt;/);
  assert.match(html, /&lt;Rice &amp; Dal&gt;/);
});
