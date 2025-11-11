import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportTablesToPdf(className: string, name: string) {
  const tables = document.querySelectorAll(`.${className}`);

  if (!tables.length) return;

  const pdf = new jsPDF({
    orientation: 'l',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const verticalPadding = 10;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i] as HTMLElement;

    const canvas = await html2canvas(table, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(
      pdfWidth / imgWidth,
      (pdfHeight / 2 - 2 * verticalPadding) / imgHeight
    );

    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;

    const isTop = i % 2 === 0;
    const yOffset = isTop ? verticalPadding : pdfHeight / 2 + verticalPadding;

    const xOffset = (pdfWidth - finalWidth) / 2;

    pdf.addImage(
      imgData,
      'JPEG',
      xOffset,
      yOffset,
      finalWidth,
      finalHeight,
      undefined,
      'FAST'
    );

    if (i % 2 === 1 && i !== tables.length - 1) {
      pdf.addPage();
    }
  }

  pdf.save(`${name}.pdf`);
}
