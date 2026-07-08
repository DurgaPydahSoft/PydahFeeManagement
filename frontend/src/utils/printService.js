/**
 * Prints a raw HTML document string inside a hidden iframe
 * @param {string} htmlContent - Fully-formed HTML content
 */
export const printHtmlDocument = (htmlContent) => {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    // Write the HTML content into the iframe
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger printing once loaded
    let isPrinted = false;
    iframe.contentWindow.onload = () => {
        if (isPrinted) return;
        isPrinted = true;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 1000);
    };

    // Fallback if onload doesn't fire immediately
    setTimeout(() => {
        if (isPrinted) return;
        isPrinted = true;
        if (document.body.contains(iframe)) {
            iframe.contentWindow.focus();
            try {
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Print trigger failed:', err);
            }
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }
    }, 600);
};
