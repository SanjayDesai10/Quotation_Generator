/**
 * Utility to clean HTML text contents.
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8209;/g, '-')
    .replace(/\u00ad/g, '-') // Soft hyphen
    .replace(/\u2011/g, '-') // Non-breaking hyphen
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses style string to extract numeric coordinates.
 */
function parseStyleCoords(styleStr) {
  if (!styleStr) return { top: 0, left: 0, width: null, height: null };
  const topMatch = styleStr.match(/top:\s*(\d+)px/);
  const leftMatch = styleStr.match(/left:\s*(\d+)px/);
  const widthMatch = styleStr.match(/width:\s*(\d+)px/);
  const heightMatch = styleStr.match(/height:\s*(\d+)px/);

  return {
    top: topMatch ? parseInt(topMatch[1], 10) : 0,
    left: leftMatch ? parseInt(leftMatch[1], 10) : 0,
    width: widthMatch ? parseInt(widthMatch[1], 10) : null,
    height: heightMatch ? parseInt(heightMatch[1], 10) : null,
  };
}

/**
 * Identifies the column type based on left and right edge coordinates.
 */
function identifyColumn(left, right, width) {
  const hasWidth = typeof width === 'number' && width > 0;

  // Description column: starts around 70px (usually 70px to 150px)
  if (left >= 55 && left <= 160) {
    return 'desc';
  }
  // S.No. column: starts around 20-30px, and has no width or very narrow width
  if (left < 55 && (!hasWidth || width < 40)) {
    return 'sno';
  }
  // HSN column: starts around 370-400px, narrow width
  if (left >= 350 && left <= 405 && (!hasWidth || width < 60)) {
    return 'hsn';
  }

  // Right-aligned columns: typically start on the left edge (25-35px) and right-align via width
  if (left < 55 && hasWidth) {
    if (right >= 420 && right <= 465) return 'gst';
    if (right >= 470 && right <= 515) return 'qty';
    if (right >= 520 && right <= 560) return 'unit';
    if (right >= 570 && right <= 625) return 'rate';
    if (right >= 670 && right <= 730) return 'amount';
  }

  // Fallback: match strictly by right edge in case left positioning shifts
  if (right >= 420 && right <= 465) return 'gst';
  if (right >= 470 && right <= 515) return 'qty';
  if (right >= 520 && right <= 560) return 'unit';
  if (right >= 570 && right <= 625) return 'rate';
  if (right >= 670 && right <= 730) return 'amount';

  return null;
}

/**
 * Main parser function. Runs in the browser using DOMParser.
 */
export function parseInvoiceHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Find all pages
  const pageElements = doc.querySelectorAll('.page');
  const pages = pageElements.length > 0 ? Array.from(pageElements) : [doc.body];

  let invoiceMetadata = {
    invoiceNo: '',
    invoiceDate: '',
    customerName: '',
    customerAddress: [],
    customerGst: '',
    poNumber: '',
    supplierGst: '',
  };

  let allProducts = [];

  pages.forEach((page, pageIndex) => {
    const divs = Array.from(page.querySelectorAll('div'));
    const parsedDivs = [];

    // First pass: extract text and coordinates
    divs.forEach((div) => {
      const text = cleanText(div.textContent);
      const style = div.getAttribute('style') || '';
      const { top, left, width, height } = parseStyleCoords(style);
      
      parsedDivs.append = parsedDivs.push({
        element: div,
        text,
        top,
        left,
        width,
        height,
        right: width ? left + width : left,
      });
    });

    // Sort by top, then left
    parsedDivs.sort((a, b) => {
      if (Math.abs(a.top - b.top) <= 2) {
        return a.left - b.left;
      }
      return a.top - b.top;
    });

    // Find supplier GST (from first page)
    if (pageIndex === 0) {
      for (const d of parsedDivs) {
        const gstMatch = d.text.match(/GST\s*No\s*:\s*([A-Z0-9]+)/i);
        if (gstMatch) {
          invoiceMetadata.supplierGst = gstMatch[1].trim();
          break;
        }
      }
    }

    // Identify Invoice No, Date, PO on page 1
    if (pageIndex === 0) {
      parsedDivs.forEach((d) => {
        // Invoice No. label
        if (/Invoice\s*No\.?\s*:/i.test(d.text)) {
          // Find value below it
          const valDiv = parsedDivs.find(
            (v) => Math.abs(v.left - d.left) <= 10 && v.top > d.top && v.top <= d.top + 15 && v.text
          );
          if (valDiv) invoiceMetadata.invoiceNo = valDiv.text;
        }
        // Date label
        if (/Date\s*:/i.test(d.text)) {
          // Find value below it
          const valDiv = parsedDivs.find(
            (v) => Math.abs(v.left - d.left) <= 10 && v.top > d.top && v.top <= d.top + 15 && v.text
          );
          if (valDiv) invoiceMetadata.invoiceDate = valDiv.text;
        }
        // PO label
        if (/PURCHASE\s*ORDER\s*NO\.?/i.test(d.text) || /Buyer\s*Order\s*No/i.test(d.text)) {
          // Value is below it
          const valDiv = parsedDivs.find(
            (v) => Math.abs(v.left - d.left) <= 10 && v.top > d.top && v.top <= d.top + 25 && v.text && !/Dated/i.test(v.text)
          );
          if (valDiv) invoiceMetadata.poNumber = valDiv.text;
        }
      });

      // Parse Customer details (Name and Address)
      // Usually starts around top=210 on the left side
      const customerDivs = parsedDivs.filter(
        (d) => d.left >= 20 && d.left <= 100 && d.top >= 200 && d.top < 360 && d.text
      );

      let isParsingAddress = false;
      customerDivs.forEach((d) => {
        const text = d.text;
        
        // Stop indicators
        if (/Phone\s*No/i.test(text) || /GST\s*No/i.test(text) || /Email/i.test(text) || /S\.No/i.test(text)) {
          return;
        }

        // Check for customer GST No. explicitly
        const custGstMatch = text.match(/GST\s*No\.?\s*:\s*([A-Z0-9]+)/i);
        if (custGstMatch) {
          invoiceMetadata.customerGst = custGstMatch[1].trim();
          return;
        }

        if (!invoiceMetadata.customerName) {
          invoiceMetadata.customerName = text;
          isParsingAddress = true;
        } else if (isParsingAddress) {
          invoiceMetadata.customerAddress.push(text);
        }
      });

      // Check if we can find Customer GST No in other divs on the left
      if (!invoiceMetadata.customerGst) {
        const gstDiv = parsedDivs.find(
          (d) => d.left >= 20 && d.left <= 100 && d.top >= 280 && d.top < 360 && /GST\s*No/i.test(d.text)
        );
        if (gstDiv) {
          const parts = gstDiv.text.split(':');
          if (parts.length > 1 && parts[1].trim()) {
            invoiceMetadata.customerGst = parts[1].trim();
          }
        }
      }
    }

    // Locate the Table Header and Subtotal locations on this page
    const headerDiv = parsedDivs.find((d) => /S\.No\.|Description\s*of/i.test(d.text) && d.top >= 340 && d.top < 380);
    const subtotalDiv = parsedDivs.find((d) => /SUB\s*TOTAL|Sub\s*Total/i.test(d.text) && d.top > 400);

    const tableStartTop = headerDiv ? headerDiv.top : 365;
    const tableEndTop = subtotalDiv ? subtotalDiv.top : 10000;

    // Group remaining divs inside the table body by their top coordinates (2px tolerance)
    const rows = {};
    parsedDivs.forEach((d) => {
      if (!d.text) return;
      if (d.top <= tableStartTop || d.top >= tableEndTop) return;

      let grouped = false;
      for (const t of Object.keys(rows)) {
        const topVal = parseInt(t, 10);
        if (Math.abs(topVal - d.top) <= 2) {
          rows[t].push(d);
          grouped = true;
          break;
        }
      }
      if (!grouped) {
        rows[d.top] = [d];
      }
    });

    // Parse each row
    Object.keys(rows)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .forEach((topStr) => {
        const rowDivs = rows[topStr];
        const item = {
          sno: '',
          description: '',
          hsn: '',
          gstPercentage: 0,
          quantity: 0,
          unit: '',
          rate: 0,
          amount: 0,
        };

        let hasSnoOrDesc = false;

        rowDivs.forEach((d) => {
          const col = identifyColumn(d.left, d.right, d.width);
          if (!col) return;

          switch (col) {
            case 'sno':
              item.sno = d.text;
              hasSnoOrDesc = true;
              break;
            case 'desc':
              item.description = d.text;
              hasSnoOrDesc = true;
              break;
            case 'hsn':
              item.hsn = d.text;
              break;
            case 'gst':
              // Strip % and convert to float
              item.gstPercentage = parseFloat(d.text.replace(/%/g, ''));
              break;
            case 'qty':
              item.quantity = parseFloat(d.text.replace(/,/g, ''));
              break;
            case 'unit':
              item.unit = d.text;
              break;
            case 'rate':
              item.rate = parseFloat(d.text.replace(/,/g, ''));
              break;
            case 'amount':
              item.amount = parseFloat(d.text.replace(/,/g, ''));
              break;
          }
        });

        // Ensure this row contains actual item information (must have a description or sno)
        if (hasSnoOrDesc && item.description) {
          allProducts.push(item);
        }
      });
  });

  return {
    metadata: invoiceMetadata,
    products: allProducts,
  };
}
