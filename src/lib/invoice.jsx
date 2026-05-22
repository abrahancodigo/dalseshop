import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPrice } from "@/lib/format";

/**
 * Converts a logo URL (or data URI) into a JPEG base64 data URL
 * suitable for jsPDF rendering. Returns null on failure.
 */
export const prepareLogoForPDF = async (logoUrl) => {
  if (!logoUrl) return null;
  // Already a data URI — use directly
  if (logoUrl.startsWith("data:image")) return logoUrl;
  // Fetch the URL and convert to JPEG via canvas
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) throw new Error("Fetch failed: " + res.status);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch (e) {
    console.warn("prepareLogoForPDF failed:", e.message);
    return null;
  }
};

export const generateOrderInvoice = async (order, settings, origin, options = {}) => {
  const showPrices = options.showPrices !== false;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const storeName = settings?.name || "Nuestra Tienda";
  const storeAddress = settings?.address || "";
  const storePhone = settings?.phone || "";
  const storeEmail = settings?.email || "";

  const primaryColor = [108, 92, 231];
  const textColor = [45, 52, 54];
  const mutedColor = [99, 110, 114];

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // === HEADER: Compact 3-column layout ===
  const logoMaxW = 35;
  const logoMaxH = 20;
  const logoX = 20;
  const logoY = 8;

  // Try to render logo - attempt PNG first, fallback to JPEG conversion
  let actualLogoH = 0;
  if (settings?.logo) {
    try {
      let imgFormat = "PNG";
      let logoData = settings.logo;

      if (typeof settings.logo === "string") {
        if (settings.logo.startsWith("data:image/jpeg")) {
          imgFormat = "JPEG";
        } else if (settings.logo.startsWith("data:image/webp")) {
          imgFormat = "WEBP";
        } else if (settings.logo.startsWith("data:image/png")) {
          imgFormat = "PNG";
        }
      }

      // Get image dimensions to preserve aspect ratio
      const imgDims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = logoData;
      });

      const ratio = imgDims.w / imgDims.h;
      let logoW = logoMaxW;
      let logoH = logoW / ratio;
      if (logoH > logoMaxH) {
        logoH = logoMaxH;
        logoW = logoH * ratio;
      }

      doc.addImage(logoData, imgFormat, logoX, logoY, logoW, logoH, undefined, "FAST");
      actualLogoH = logoH;
    } catch (e) {
      console.warn("Logo PNG failed, trying JPEG fallback:", e.message);
      // Fallback: try to convert PNG data URL to JPEG via canvas
      try {
        if (typeof settings.logo === "string" && settings.logo.startsWith("data:image")) {
          // Create an offscreen canvas to convert PNG to JPEG
          const img = new Image();
          img.src = settings.logo;
          await new Promise((resolve, reject) => {
            img.onload = () => {
              const ratio = img.width / img.height;
              let logoW = logoMaxW;
              let logoH = logoW / ratio;
              if (logoH > logoMaxH) {
                logoH = logoMaxH;
                logoW = logoH * ratio;
              }

              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              const jpegData = canvas.toDataURL("image/jpeg", 0.95);
              doc.addImage(jpegData, "JPEG", logoX, logoY, logoW, logoH, undefined, "FAST");
              actualLogoH = logoH;
              resolve();
            };
            img.onerror = () => reject(new Error("Image load failed"));
            // Timeout after 3 seconds
            setTimeout(() => reject(new Error("Image conversion timeout")), 3000);
          });
        }
      } catch (e2) {
        console.warn("Logo JPEG fallback also failed:", e2.message);
      }
    }
  }

  const logoH = actualLogoH || 15;
  const headerBottom = logoY + logoH;

  // QR code on the right, aligned with logo top
  const qrSize = 15;
  const qrX = pageWidth - 20 - qrSize;
  const qrY = logoY;

  try {
    const QRCode = (await import("qrcode")).default;
    const baseUrl = (origin || "https://dalseshop.web.app").replace(/\/+$/, "");
    const qrUrl = `${baseUrl}/facturacion/detalle?orderId=${order.id || ""}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 150,
      margin: 1,
      color: { dark: "#2D3436", light: "#FFFFFF" },
    });
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  } catch (e) {
    console.warn("QR could not be generated:", e);
  }

  // Center column: NOTA DE PEDIDO + order number
  const centerX = pageWidth / 2;
  const titleY = logoY + 3;
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text("NOTA DE PEDIDO", centerX, titleY, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(...textColor);
  const orderLabel = order.orderNumber ? `#${String(order.orderNumber).padStart(4, "0")}` : `#${(order.id || "0000").substring(0, 8).toUpperCase()}`;
  doc.text(orderLabel, centerX, titleY + 5, { align: "center" });

  // Second row: Date | State
  const row2Y = headerBottom + 2;
  doc.setFontSize(7);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "normal");
  const dateStr = `Fecha: ${new Date().toLocaleDateString()}`;
  const stateStr = `Estado: ${order.paymentMethod === "cashOnDelivery" ? "Pago contra entrega" : "Pendiente"}`;
  doc.text(`${dateStr}  |  ${stateStr}`, centerX, row2Y, { align: "center" });

  // Third row: Store contact info
  const contactY = row2Y + 4;
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "normal");
  const contactParts = [];
  if (storeAddress) contactParts.push(storeAddress);
  if (storePhone) contactParts.push(`Tel: ${storePhone}`);
  if (storeEmail) contactParts.push(`Email: ${storeEmail}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  |  "), centerX, contactY, { align: "center" });
  }

  // Separator line
  const separatorY = contactY + 3;
  doc.setDrawColor(200);
  doc.line(20, separatorY, 190, separatorY);

  // === CLIENT DATA ===
  const clientY = separatorY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text("DATOS DEL CLIENTE", 20, clientY);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${order.customer?.name || ""}`, 20, clientY + 7);
  doc.text(`Email: ${order.customer?.email || ""}`, 20, clientY + 12);
  doc.text(`Telefono: ${order.customer?.phone || ""}`, 20, clientY + 17);
  doc.text(`Direccion: ${order.customer?.address || ""}, ${order.customer?.city || ""}`, 20, clientY + 22);

  if (order.invoice?.wantsInvoice) {
    doc.setFont("helvetica", "bold");
    doc.text("DATOS FISCALES:", 120, clientY);
    doc.setFont("helvetica", "normal");
    doc.text(`Razon Social: ${order.invoice.businessName}`, 120, clientY + 7);
    doc.text(`NIT: ${order.invoice.taxId}`, 120, clientY + 12);
    doc.text(`NRC: ${order.invoice.nrc || ""}`, 120, clientY + 17);
    doc.text(`Giro: ${order.invoice.businessType}`, 120, clientY + 22);
  }

  // === ITEMS TABLE ===
  const tableStartY = clientY + 28;

  const tableData = (order.items || []).map(item => [
    item.barcode || item.sku || "-",
    item.name + (item.variant ? ` (${item.variant})` : ""),
    item.quantity,
    showPrices ? `$${formatPrice(item.price)}` : "Consultar",
    showPrices ? `$${formatPrice((item.price || 0) * (item.quantity || 1))}` : "—"
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [["Codigo", "Producto", "Cant.", "Precio Unit.", "Total"]],
    body: tableData,
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 20, right: 20 },
    theme: "striped",
    didParseCell: (data) => {
      // Reduce font size for "Consultar" text in price columns (col 3 and 4)
      if (!showPrices && data.section === "body" && (data.column.index === 3 || data.column.index === 4)) {
        data.cell.styles.fontSize = 7;
      }
    }
  });

  // === TOTALS ===
  // Check if autoTable created a new page
  const tableEndY = doc.lastAutoTable.finalY;
  const currentPage = doc.internal.getNumberOfPages();
  
  // If table ended near bottom, add a new page for totals and note
  let totalsY = tableEndY + 10;
  if (totalsY > pageHeight - 50) {
    doc.addPage();
    totalsY = 20;
  }

  // Ensure we're on the correct page
  doc.setPage(currentPage);
  // If we added a new page, use that page's context
  if (doc.internal.getNumberOfPages() > currentPage) {
    doc.setPage(doc.internal.getNumberOfPages());
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  
  const labelX = 125;
  const valueX = 175;
  
  doc.text("Subtotal:", labelX, totalsY);
  doc.text(showPrices ? `$${formatPrice(order.subtotal)}` : "—", valueX, totalsY);
  
  if (order.discount > 0 && showPrices) {
    doc.text("Descuento:", labelX, totalsY + 6);
    doc.text(`-$${formatPrice(order.discount)}`, valueX, totalsY + 6);
  }
  
  doc.text("Envio:", labelX, totalsY + 12);
  doc.text(showPrices ? `$${formatPrice(order.shipping || 0)}` : "—", valueX, totalsY + 12);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("TOTAL:", labelX, totalsY + 20);
  if (showPrices) {
    doc.text(`$${formatPrice(order.total)}`, valueX, totalsY + 20);
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Consultar precio", valueX, totalsY + 20);
  }

  // === FOOTER NOTE ===
  const noteY = totalsY + 30;
  
  // If note would go off page, add new page
  if (noteY > pageHeight - 20) {
    doc.addPage();
    doc.setPage(doc.internal.getNumberOfPages());
    doc.text("TOTAL:", labelX, totalsY + 20);
    doc.text(showPrices ? `$${formatPrice(order.total)}` : "Consultar precio", valueX, totalsY + 20);
  }

  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "italic");

  if (!showPrices) {
    doc.text("Este documento es una orden de compra, no una factura.", 105, noteY, { align: "center" });
    doc.text("Nuestro equipo se comunicara con usted para concretar los detalles de la compra.", 105, noteY + 5, { align: "center" });
  } else {
    doc.text("¡Gracias por tu compra!", 105, noteY, { align: "center" });
  }

  return doc;
};
