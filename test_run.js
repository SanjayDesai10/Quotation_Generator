import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import XLSX from 'xlsx-js-style';
import { parseInvoiceHtml } from './src/parser/invoiceParser.js';
import { buildSheetData } from './src/excel/excelGenerator.js';

// 1. Setup mock JSDOM environment for DOMParser
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;

const __dirname = path.resolve();

// 2. Read Invoice22.html
const htmlPath = path.join(__dirname, '../Invoice22.html');
console.log('Reading HTML invoice from:', htmlPath);
const htmlContent = fs.readFileSync(htmlPath, 'latin1'); // windows-1252/latin1 compatible

// 3. Parse invoice
console.log('Parsing invoice HTML...');
const parsed = parseInvoiceHtml(htmlContent);
console.log('Parsed Metadata:', JSON.stringify(parsed.metadata, null, 2));
console.log(`Parsed ${parsed.products.length} line items.`);

// 4. Generate Excel Workbook via xlsx-js-style
console.log('Generating Excel sheet structures...');
const wb = XLSX.utils.book_new();

// Sheet2: Main (Hanuman)
const mainSheet = buildSheetData(parsed.metadata, parsed.products, {
  customerName: parsed.metadata.customerName,
  customerAddress: parsed.metadata.customerAddress,
  rateModifier: 1.0,
});
XLSX.utils.book_append_sheet(wb, mainSheet, 'Sheet2');

// Sheet3: Quote A
const altAddressA = parsed.metadata.customerAddress.map(line => 
  line.replace(/POLICE TRAINING GROUND|POLICE TRAINING COLLEGE/g, 'P.T.C.')
);
const quoteASheet = buildSheetData(parsed.metadata, parsed.products, {
  customerName: parsed.metadata.customerName.replace(/POLICE TRAINING COLLEGE/g, 'P.T.C.'),
  customerAddress: altAddressA,
  rateModifier: 1.0,
  isQuoteA: true,
});
XLSX.utils.book_append_sheet(wb, quoteASheet, 'Sheet3');

// Sheet4: Quote B
const altAddressB = parsed.metadata.customerAddress.map(line => 
  line.replace(/POLICE TRAINING GROUND|POLICE TRAINING COLLEGE/g, 'POLICE TRAINING GROUND')
);
const quoteBSheet = buildSheetData(parsed.metadata, parsed.products, {
  customerName: parsed.metadata.customerName.replace(/ATP/g, 'ANANTAPUR'),
  customerAddress: altAddressB,
  rateModifier: 1.0,
  isQuoteB: true,
});
XLSX.utils.book_append_sheet(wb, quoteBSheet, 'Sheet4');

// 5. Write Excel workbook to filesystem
const outPath = path.join(__dirname, '../generated_test.xlsx');
console.log('Writing test excel workbook to:', outPath);
XLSX.writeFile(wb, outPath);
console.log('Headless test run completed successfully.');
