import { useState } from 'react';
import { parseInvoiceHtml } from './parser/invoiceParser';
import { generateInvoiceExcel } from './excel/excelGenerator';

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [error, setError] = useState(null);

  // Calculate sum of line items to compare with invoice summary
  const getCalculatedSubtotal = () => {
    if (!invoiceData) return 0;
    return invoiceData.products.reduce((acc, curr) => acc + (curr.quantity * curr.rate), 0);
  };

  const getCalculatedTax = () => {
    if (!invoiceData) return 0;
    return invoiceData.products.reduce((acc, curr) => {
      const lineAmt = curr.quantity * curr.rate;
      return acc + (lineAmt * (curr.gstPercentage / 100));
    }, 0);
  };

  const getCalculatedTotal = () => {
    return Math.round(getCalculatedSubtotal() + getCalculatedTax());
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    
    // Check file type
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      setError('Please upload an HTML invoice file.');
      setFile(null);
      setInvoiceData(null);
      return;
    }

    setFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseInvoiceHtml(text);
        
        if (!parsed.products || parsed.products.length === 0) {
          throw new Error('No product line items could be extracted. Please check the invoice format.');
        }

        if (!parsed.metadata.invoiceNo) {
          throw new Error('Could not identify the invoice number in the file.');
        }

        setInvoiceData(parsed);
      } catch (err) {
        setError(err.message || 'An error occurred while parsing the invoice.');
        setFile(null);
        setInvoiceData(null);
      }
    };
    reader.onerror = () => {
      setError('Error reading the file.');
    };
    reader.readAsText(file, 'windows-1252'); // standard encoding for billing software reports
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDownload = () => {
    if (!invoiceData) return;
    try {
      generateInvoiceExcel(invoiceData.metadata, invoiceData.products);
    } catch (err) {
      setError('Failed to generate Excel file: ' + err.message);
    }
  };

  const handleReset = () => {
    setFile(null);
    setInvoiceData(null);
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
          Invoice to Excel Converter
        </h1>
        <p className="mt-3 text-slate-400 text-lg max-w-xl mx-auto">
          Convert XFRX-generated billing invoices into styled Excel template workbooks with dynamic math verification.
        </p>
      </header>

      {/* Main Content Card */}
      <main className="glass-panel rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative corner glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-200 flex items-start space-x-3">
            <svg className="w-6 h-6 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="font-semibold">Conversion Error:</span>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!file && (
          /* Dropzone */
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center cursor-pointer ${
              dragActive
                ? 'border-indigo-400 bg-indigo-950/20 scale-[1.01]'
                : 'border-slate-700 bg-slate-900/20 hover:border-slate-500 hover:bg-slate-900/30'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".html,.htm"
              onChange={handleChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 shadow-inner">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">Drag & Drop HTML Invoice</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                Drop your billing invoice file here, or click to browse files from your computer.
              </p>
              <span className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/25">
                Browse Files
              </span>
            </label>
          </div>
        )}

        {file && invoiceData && (
          /* Preview State */
          <div>
            {/* Success Bar */}
            <div className="mb-8 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-slate-100 text-sm">✅ Invoice converted successfully</span>
                  <p className="text-slate-400 text-xs mt-0.5">Parsed file: {file.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  Upload Another
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-600/30 active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Excel</span>
                </button>
              </div>
            </div>

            {/* Dashboard grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Customer and Invoice Details */}
              <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-800/60">
                    Invoice details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Invoice Number</span>
                      <span className="text-slate-200 font-medium text-lg">{invoiceData.metadata.invoiceNo}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Invoice Date</span>
                      <span className="text-slate-200 font-medium text-lg">{invoiceData.metadata.invoiceDate}</span>
                    </div>
                    {invoiceData.metadata.poNumber && (
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">PO Number</span>
                        <span className="text-slate-200 font-medium">{invoiceData.metadata.poNumber}</span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-indigo-400 mb-3">Customer details</h3>
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 mb-4">
                    <span className="text-sm font-semibold text-slate-200 block">{invoiceData.metadata.customerName}</span>
                    {invoiceData.metadata.customerAddress.map((line, idx) => (
                      <span key={idx} className="text-sm text-slate-400 block mt-1">{line}</span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-800/40">
                  <span>Supplier GST: {invoiceData.metadata.supplierGst || 'N/A'}</span>
                  <span>Customer GST: {invoiceData.metadata.customerGst || 'N/A'}</span>
                </div>
              </div>

              {/* Validation Summary */}
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-indigo-400 mb-4 pb-2 border-b border-slate-800/60">
                    Math Validation
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Total Line Items</span>
                      <span className="text-slate-200 font-bold bg-slate-850 px-2 py-0.5 rounded text-sm">
                        {invoiceData.products.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Calculated Subtotal</span>
                      <span className="text-slate-200 font-medium">
                        Rs. {getCalculatedSubtotal().toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Calculated GST</span>
                      <span className="text-slate-200 font-medium">
                        Rs. {getCalculatedTax().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-slate-200 font-semibold text-base">Grand Total</span>
                    <span className="text-indigo-400 text-2xl font-extrabold">
                      Rs. {getCalculatedTotal().toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-xs">
                    💡 **Excel Calculation is the source of truth.** Cell sums are generated dynamically and rounded to the nearest integer.
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted Product Items Table */}
            <div>
              <h3 className="text-xl font-semibold text-slate-100 mb-4">Extracted Line Items</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 bg-slate-900/10">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">S.No.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">HSN</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">GST %</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Qty</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">Unit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Calculated Line Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {invoiceData.products.map((prod, index) => (
                      <tr key={index} className="hover:bg-slate-850/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 text-slate-200 font-semibold max-w-xs truncate" title={prod.description}>
                          {prod.description}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400">{prod.hsn || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-slate-300 font-medium">
                          {prod.gstPercentage.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-slate-100 font-semibold">
                          {prod.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-slate-400">{prod.unit}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-slate-300">
                          {prod.rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-indigo-300 font-bold">
                          {(prod.quantity * prod.rate).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
