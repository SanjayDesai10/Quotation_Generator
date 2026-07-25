import XLSX from 'xlsx-js-style';

/**
 * Helper to convert sheet to binary array buffer for browser download.
 */
function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

/**
 * Helper to convert cell coordinate to Excel column letter (e.g. 0 -> A, 1 -> B).
 */
function getColLetter(colIdx) {
  let temp = '';
  let letter = '';
  while (colIdx >= 0) {
    temp = colIdx % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIdx = Math.floor(colIdx / 26) - 1;
  }
  return letter;
}

/**
 * Builds the SheetJS styled cell object.
 */
function createStyledCell(value, options = {}) {
  const {
    isBold = false,
    fontSize = 10,
    fontColor = '000000',
    fontName = 'Arial',
    fillColor = null,
    alignH = null,
    alignV = 'bottom',
    hasBorder = false,
    formula = null,
    numFmt = null,
  } = options;

  const cell = {};
  if (value !== null && value !== undefined) {
    cell.v = value;
    cell.t = typeof value === 'number' ? 'n' : 's';
  } else if (!formula) {
    cell.v = '';
    cell.t = 's';
  }

  if (formula) {
    cell.f = formula;
  }

  if (numFmt) {
    cell.z = numFmt;
  }

  // Build style object
  const style = {
    font: {
      name: fontName,
      sz: fontSize,
      bold: isBold,
      color: { rgb: fontColor },
    },
    alignment: {
      vertical: alignV,
    },
  };

  if (alignH) {
    style.alignment.horizontal = alignH;
  }

  if (fillColor) {
    style.fill = {
      fgColor: { rgb: fillColor },
    };
  }

  if (hasBorder) {
    const borderStyle = 'thin';
    const borderColor = '000000';
    style.border = {
      top: { style: borderStyle, color: { rgb: borderColor } },
      bottom: { style: borderStyle, color: { rgb: borderColor } },
      left: { style: borderStyle, color: { rgb: borderColor } },
      right: { style: borderStyle, color: { rgb: borderColor } },
    };
  }

  cell.s = style;
  return cell;
}

/**
 * Generates the Excel sheet data array for a single quote (Supplier).
 */
export function buildSheetData(metadata, products, options = {}) {
  const {
    customerName = metadata.customerName,
    customerAddress = metadata.customerAddress,
    isQuoteA = false,
    isQuoteB = false,
  } = options;

  const fontName = isQuoteB ? 'Bahnschrift SemiBold' : (isQuoteA ? 'Cambria' : 'Arial');
  const isBoldAddress = !isQuoteA && !isQuoteB;

  // 1. Collect all distinct GST rates in descending order
  const distinctGstRates = Array.from(
    new Set(products.map((p) => p.gstPercentage / 100))
  ).sort((a, b) => b - a);

  // 2. Setup cell layout map (using row index 0-based for writing)
  const sheetCells = {};

  // Address section starting on dynamic row indices matching the template
  let currRow = 14;
  if (isQuoteA) currRow = 15;
  if (isQuoteB) currRow = 16;

  sheetCells[`A${currRow + 1}`] = createStyledCell('TO,', { isBold: isBoldAddress, fontName });
  currRow++;

  // Write customer name (bold for main/Sheet2)
  sheetCells[`A${currRow + 1}`] = createStyledCell(customerName.toUpperCase(), { isBold: isBoldAddress, fontName });
  currRow++;

  // Write customer address lines
  customerAddress.forEach((line) => {
    sheetCells[`A${currRow + 1}`] = createStyledCell(line.toUpperCase(), { isBold: isBoldAddress, fontName });
    currRow++;
  });

  // Gap row
  currRow++;

  // Table header row (e.g. Row 20)
  const headerRow = currRow;
  let headerCols = [];
  if (isQuoteA) {
    headerCols = ['S.NO', 'NAME OF ITEMS', 'QUANTITY', 'RATE', ...distinctGstRates];
  } else if (isQuoteB) {
    headerCols = ['S NO', 'ITEM NAME', 'QUANTITY', 'RATE', ...distinctGstRates];
  } else {
    headerCols = ['S.No.', 'DESCRIPTION OF GOODS ', 'QUANTITY', 'RATE', ...distinctGstRates];
  }

  const headerIsBold = !isQuoteA && !isQuoteB;
  const headerFill = (!isQuoteA && !isQuoteB) ? '4285F4' : null;
  const headerFontColor = (!isQuoteA && !isQuoteB) ? 'FFFFFF' : '000000';

  headerCols.forEach((colVal, colIdx) => {
    const colLetter = getColLetter(colIdx);
    const isNumber = typeof colVal === 'number';
    
    sheetCells[`${colLetter}${headerRow + 1}`] = createStyledCell(colVal, {
      isBold: headerIsBold,
      fontName,
      fillColor: headerFill,
      fontColor: headerFontColor,
      alignH: 'center',
      alignV: 'bottom',
      hasBorder: true,
      numFmt: isNumber ? '0%' : null,
    });
  });
  currRow++;

  // Product rows
  const prodStartRow = currRow;
  products.forEach((prod, prodIdx) => {
    const rIdx = currRow + 1; // 1-based row index for excel formula
    
    // Serial number
    sheetCells[`A${rIdx}`] = createStyledCell(prodIdx + 1, { fontName, hasBorder: true });
    
    // Description
    const desc = prod.description;
    sheetCells[`B${rIdx}`] = createStyledCell(desc.toUpperCase(), { fontName, hasBorder: true });
    
    // Quantity
    sheetCells[`C${rIdx}`] = createStyledCell(prod.quantity, { fontName, hasBorder: true });
    
    // Rate
    const finalRate = prod.rate;
    sheetCells[`D${rIdx}`] = createStyledCell(finalRate, { fontName, hasBorder: true });

    // GST Columns
    distinctGstRates.forEach((rateVal, colIdx) => {
      const colLetter = getColLetter(colIdx + 4);
      const isMatch = Math.abs((prod.gstPercentage / 100) - rateVal) < 0.001;

      if (isMatch) {
        sheetCells[`${colLetter}${rIdx}`] = createStyledCell(null, {
          formula: `D${rIdx}*C${rIdx}`,
          fontName,
          hasBorder: true,
        });
      } else {
        sheetCells[`${colLetter}${rIdx}`] = createStyledCell(null, {
          fontName,
          hasBorder: true,
        });
      }
    });

    currRow++;
  });
  const prodEndRow = currRow; // exclusive of totals

  // Totals row (e.g. TOTAL)
  const totalRowIdx = currRow + 1;
  sheetCells[`D${totalRowIdx}`] = createStyledCell('TOTAL', { fontName, alignV: 'bottom', hasBorder: true });
  distinctGstRates.forEach((rateVal, colIdx) => {
    const colLetter = getColLetter(colIdx + 4);
    sheetCells[`${colLetter}${totalRowIdx}`] = createStyledCell(null, {
      formula: `SUM(${colLetter}${prodStartRow + 1}:${colLetter}${prodEndRow})`,
      fontName,
      alignH: 'right',
      alignV: 'bottom',
      hasBorder: true,
    });
  });
  currRow++;

  // CGST row
  const cgstRowIdx = currRow + 1;
  sheetCells[`D${cgstRowIdx}`] = createStyledCell('CGST', { fontName, alignV: 'bottom', hasBorder: true });
  distinctGstRates.forEach((rateVal, colIdx) => {
    const colLetter = getColLetter(colIdx + 4);
    if (rateVal > 0) {
      const ratePctText = `${Math.round(rateVal * 100)}%`;
      sheetCells[`${colLetter}${cgstRowIdx}`] = createStyledCell(null, {
        formula: `ROUND((${colLetter}${totalRowIdx}*${ratePctText})/2,2)`,
        fontName,
        alignH: 'right',
        alignV: 'bottom',
        hasBorder: true,
      });
    } else {
      // 0% GST rate has 0.0 CGST
      sheetCells[`${colLetter}${cgstRowIdx}`] = createStyledCell(0, {
        fontName,
        alignH: 'right',
        alignV: 'bottom',
        hasBorder: true,
      });
    }
  });
  currRow++;

  // SGST row
  const sgstRowIdx = currRow + 1;
  sheetCells[`D${sgstRowIdx}`] = createStyledCell('SGST', { fontName, alignV: 'bottom', hasBorder: true });
  distinctGstRates.forEach((rateVal, colIdx) => {
    const colLetter = getColLetter(colIdx + 4);
    sheetCells[`${colLetter}${sgstRowIdx}`] = createStyledCell(null, {
      formula: `${colLetter}${cgstRowIdx}`,
      fontName,
      alignH: 'right',
      alignV: 'bottom',
      hasBorder: true,
    });
  });
  currRow++;

  // TOTAL including taxes row
  const totalWithTaxRowIdx = currRow + 1;
  sheetCells[`D${totalWithTaxRowIdx}`] = createStyledCell('TOTAL', { fontName, alignV: 'bottom', hasBorder: true });
  distinctGstRates.forEach((rateVal, colIdx) => {
    const colLetter = getColLetter(colIdx + 4);
    sheetCells[`${colLetter}${totalWithTaxRowIdx}`] = createStyledCell(null, {
      formula: `SUM(${colLetter}${totalRowIdx}:${colLetter}${sgstRowIdx})`,
      fontName,
      alignH: 'right',
      alignV: 'bottom',
      hasBorder: true,
    });
  });
  currRow++;

  // G TOTAL row (Grand Total)
  const gtotalRowIdx = currRow + 1;
  const gtotalLabelIsBold = !isQuoteA && !isQuoteB;
  sheetCells[`D${gtotalRowIdx}`] = createStyledCell('G TOTAL', { 
    isBold: gtotalLabelIsBold, 
    fontName,
    alignV: 'bottom', 
    hasBorder: true 
  });
  
  // Grand total formula sums all dynamic columns in the totalWithTaxRowIdx row
  const firstCol = getColLetter(4);
  const lastCol = getColLetter(4 + distinctGstRates.length - 1);
  sheetCells[`E${gtotalRowIdx}`] = createStyledCell(null, {
    formula: `ROUND(SUM(${firstCol}${totalWithTaxRowIdx}:${lastCol}${totalWithTaxRowIdx}),0)`,
    isBold: false,
    fontName,
    alignH: 'right',
    alignV: 'bottom',
    hasBorder: true,
  });

  // Border formatting for remaining column cells in G TOTAL row
  for (let c = 5; c < 4 + distinctGstRates.length; c++) {
    const colLetter = getColLetter(c);
    sheetCells[`${colLetter}${gtotalRowIdx}`] = createStyledCell(null, {
      fontName,
      hasBorder: true,
    });
  }

  // 3. Set column widths
  const cols = [
    { wch: 13 }, // S.No
    { wch: 30 }, // Description
    { wch: 13 }, // Quantity
    { wch: 13 }, // Rate
    ...distinctGstRates.map(() => ({ wch: 13 })), // GST columns
  ];
  sheetCells['!cols'] = cols;

  // 4. Return formatted cell collection and sheet range
  const maxColLetter = getColLetter(4 + distinctGstRates.length - 1);
  sheetCells['!ref'] = `A1:${maxColLetter}${gtotalRowIdx}`;

  return sheetCells;
}

/**
 * Main function to generate and download the completed workbook.
 */
export function generateInvoiceExcel(metadata, products) {
  const wb = XLSX.utils.book_new();

  // Define sheet names based on standard supplier naming
  const mainSheetName = 'Sheet2'; // Main Supplier (Hanuman)
  const quoteASheetName = 'Sheet3'; // Quote A
  const quoteBSheetName = 'Sheet4'; // Quote B

  // 1. Build main sheet (Hanuman Papers)
  const mainSheet = buildSheetData(metadata, products, {
    customerName: metadata.customerName,
    customerAddress: metadata.customerAddress,
    rateModifier: 1.0,
  });
  XLSX.utils.book_append_sheet(wb, mainSheet, mainSheetName);

  // 2. Build Quote A sheet (Dummy Quote A)
  // Slightly adjust customer address to look like alternative entry: "PRINCIPAL P.T.C."
  const altAddressA = metadata.customerAddress.map(line => 
    line.replace(/POLICE TRAINING GROUND|POLICE TRAINING COLLEGE/g, 'P.T.C.')
  );
  const quoteASheet = buildSheetData(metadata, products, {
    customerName: metadata.customerName.replace(/POLICE TRAINING COLLEGE/g, 'P.T.C.'),
    customerAddress: altAddressA,
    rateModifier: 1.0,
    isQuoteA: true,
  });
  XLSX.utils.book_append_sheet(wb, quoteASheet, quoteASheetName);

  // 3. Build Quote B sheet (Dummy Quote B)
  const altAddressB = metadata.customerAddress.map(line => 
    line.replace(/POLICE TRAINING GROUND|POLICE TRAINING COLLEGE/g, 'POLICE TRAINING GROUND')
  );
  const quoteBSheet = buildSheetData(metadata, products, {
    customerName: metadata.customerName.replace(/ATP/g, 'ANANTAPUR'),
    customerAddress: altAddressB,
    rateModifier: 1.0,
    isQuoteB: true,
  });
  XLSX.utils.book_append_sheet(wb, quoteBSheet, quoteBSheetName);

  // 4. Write workbook and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  const filename = `${metadata.invoiceNo ? metadata.invoiceNo.replace(/\//g, '_') : 'Invoice'}.xlsx`;

  const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
