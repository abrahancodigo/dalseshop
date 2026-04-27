import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const generateOrderInvoice = (order, settings) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const storeName = settings?.name || "Nuestra Tienda";
  const storeAddress = settings?.address || "";
  const storePhone = settings?.phone || "";
  const storeEmail = settings?.email || "";

  // Colors
  const primaryColor = [108, 92, 231]; // Matches #6C5CE7
  const textColor = [45, 52, 54];
  const mutedColor = [99, 110, 114];

  // HEADER
  let headerY = 20;
  
  if (settings?.logo) {
    console.log("PDF Invoice: Logo detected, length:", settings.logo.length);
    try {
      // Detect format from base64 if possible
      let format = "PNG";
      if (settings.logo.includes("image/jpeg") || settings.logo.includes("image/jpg")) format = "JPEG";
      else if (settings.logo.includes("image/webp")) format = "WEBP";
      
      // Calculate aspect ratio or use a fixed box
      // Standard logo area: 35mm x 18mm
      doc.addImage(settings.logo, format, 20, 10, 35, 18, undefined, 'FAST');
      headerY = 35;
    } catch (e) {
      console.error("PDF Invoice: Error adding logo:", e);
      // Last resort fallback
      headerY = 20;
    }
  } else {
    console.warn("PDF Invoice: No logo provided in settings");
    headerY = 20;
  }

  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(storeName.toUpperCase(), 20, headerY);

  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "normal");
  headerY += 8;
  if (storeAddress) { doc.text(storeAddress, 20, headerY); headerY += 5; }
  if (storePhone) { doc.text(`Tel: ${storePhone}`, 20, headerY); headerY += 5; }
  if (storeEmail) { doc.text(`Email: ${storeEmail}`, 20, headerY); headerY += 5; }

  // INVOICE DETAILS (Right)
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.setFont("helvetica", "bold");
  doc.text("NOTA DE PEDIDO", 140, 20);
  doc.setFontSize(10);
  doc.text(`#${(order.id || "0000").substring(0, 8).toUpperCase()}`, 140, 26);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 140, 31);
  doc.text(`Estado: ${order.paymentMethod === "cashOnDelivery" ? "Pago contra entrega" : "Pendiente"}`, 140, 36);

  doc.setDrawColor(200);
  doc.line(20, 50, 190, 50);

  // CUSTOMER INFO
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE", 20, 60);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${order.customer?.name || ""}`, 20, 68);
  doc.text(`Email: ${order.customer?.email || ""}`, 20, 73);
  doc.text(`Teléfono: ${order.customer?.phone || ""}`, 20, 78);
  doc.text(`Dirección: ${order.customer?.address || ""}, ${order.customer?.city || ""}`, 20, 83);

  if (order.invoice?.wantsInvoice) {
    doc.setFont("helvetica", "bold");
    doc.text("DATOS FISCALES:", 120, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`Razón Social: ${order.invoice.businessName}`, 120, 68);
    doc.text(`NIT: ${order.invoice.taxId}`, 120, 73);
    doc.text(`NRC: ${order.invoice.nrc || ""}`, 120, 78);
    doc.text(`Giro: ${order.invoice.businessType}`, 120, 83);
  }

  // ITEMS TABLE
  const tableData = (order.items || []).map(item => [
    item.barcode || item.sku || "-",
    item.name + (item.variant ? ` (${item.variant})` : ""),
    item.quantity,
    `$${(item.price || 0).toLocaleString()}`,
    `$${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 95,
    head: [["Código", "Producto", "Cant.", "Precio Unit.", "Total"]],
    body: tableData,
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 20, right: 20 },
    theme: "striped"
  });

  // TOTALS
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  
  doc.text("Subtotal:", 140, finalY);
  doc.text(`$${order.subtotal.toLocaleString()}`, 170, finalY);
  
  if (order.discount > 0) {
    doc.text("Descuento:", 140, finalY + 5);
    doc.text(`-$${order.discount.toLocaleString()}`, 170, finalY + 5);
  }
  
  doc.text("Envío:", 140, finalY + 10);
  doc.text(order.shipping === 0 ? "Gratis" : `$${order.shipping.toLocaleString()}`, 170, finalY + 10);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("TOTAL:", 140, finalY + 18);
  doc.text(`$${order.total.toLocaleString()}`, 170, finalY + 18);

  // FOOTER
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "italic");
  doc.text("¡Gracias por tu compra!", 105, 280, { align: "center" });

  return doc;
};
