/**
 * Universal Print Engine for Sandana Clinic & Dudrucs Pharmacy.
 * Handles printing reliably inside iframes (such as the dev preview),
 * standard desktop browsers, and mobile/tablet devices.
 */

export interface PrintOptions {
  title?: string;
  autoClose?: boolean;
  extraStyles?: string;
}

/**
 * Prints a specific DOM element cleanly by copying its content into an isolated
 * print iframe, copying parent styles, and executing print with zero UI clutter.
 */
export function printElementById(elementId: string, options: PrintOptions = {}): boolean {
  try {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.warn(`[printEngine] Element #${elementId} not found. Falling back to window.print()`);
      window.print();
      return true;
    }

    const title = options.title || document.title || 'Sandana Clinic Print';

    // Remove any previously created print frame
    const existingFrame = document.getElementById('sandana-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }

    // Create an isolated hidden iframe
    const printFrame = document.createElement('iframe');
    printFrame.id = 'sandana-print-frame';
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc) {
      window.print();
      return true;
    }

    // Gather all stylesheets and style tags from current document
    let stylesHtml = '';
    const styleTags = document.querySelectorAll('link[rel="stylesheet"], style');
    styleTags.forEach((node) => {
      stylesHtml += node.outerHTML + '\n';
    });

    const defaultPrintStyles = `
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
        }
        html, body {
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 13px !important;
          margin: 0 !important;
          padding: 8px !important;
          width: 100% !important;
        }
        .no-print, button, input[type="file"], .btn-print, .modal-close {
          display: none !important;
        }
        .printable-content {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          border: 1px solid #cbd5e1 !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        th, td {
          border-color: #cbd5e1 !important;
        }
        img {
          max-width: 100% !important;
          page-break-inside: avoid !important;
        }
        ${options.extraStyles || ''}
      </style>
    `;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          ${stylesHtml}
          ${defaultPrintStyles}
        </head>
        <body>
          <div class="printable-wrapper">
            ${targetElement.outerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    // Give browser time to load images and styles, then print
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.warn('[printEngine] Iframe print blocked, falling back to window.print():', err);
        window.print();
      } finally {
        setTimeout(() => {
          printFrame.remove();
        }, 15000);
      }
    }, 350);

    return true;
  } catch (outerErr) {
    console.error('[printEngine] Error during printing:', outerErr);
    try {
      window.print();
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * Opens a dedicated popup print window containing the rendered document
 * so the user has an unobstructed full-page print view if desired.
 */
export function openPrintWindow(elementId: string, title = 'Prescription / Bill Print'): Window | null {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    window.print();
    return null;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=800,menubar=no,toolbar=no,status=no');
  if (!printWindow) {
    // Popup was blocked by browser, use inline iframe printer
    printElementById(elementId, { title });
    return null;
  }

  let stylesHtml = '';
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    stylesHtml += node.outerHTML + '\n';
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${stylesHtml}
        <style>
          @page { size: A4; margin: 10mm; }
          body { background: #f8fafc; padding: 20px; font-family: ui-sans-serif, system-ui, sans-serif; }
          .no-print { display: none !important; }
          .printable-card { background: #fff; max-width: 800px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; }
          @media print {
            body { background: #fff; padding: 0; }
            .printable-card { border: none; box-shadow: none; padding: 0; }
            .top-bar { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="top-bar" style="max-width:800px;margin:0 auto 16px;display:flex;justify-content:space-between;align-items:center;background:#0F2942;color:#fff;padding:12px 16px;border-radius:8px;">
          <span style="font-weight:bold;font-size:14px;">Sandana Clinic · Document Print Preview</span>
          <div>
            <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;font-weight:bold;border-radius:6px;cursor:pointer;margin-right:8px;">🖨️ Print Now</button>
            <button onclick="window.close()" style="background:#e2e8f0;color:#1e293b;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;">✕ Close</button>
          </div>
        </div>
        <div class="printable-card">
          ${targetElement.outerHTML}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  return printWindow;
}
