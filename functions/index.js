const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const smtpFrom = defineSecret("SMTP_FROM");

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

exports.sendContactEmail = onCall(
  {
    secrets: [smtpUser, smtpPass, smtpFrom],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    try {
      logger.log("sendContactEmail called", { data: JSON.stringify(request.data) });
      const { name, email, message, storeSettings } = request.data;

      const transporter = createTransporter();
      const storeName = storeSettings?.name || "Nuestra Tienda";
      const contactNotif = storeSettings?.contactNotifications || {};
      const recipients = [
        contactNotif.email1,
        contactNotif.email2,
        contactNotif.email3,
      ].filter((e) => e && e.trim() !== "" && e.includes("@"));

      if (recipients.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "No se encontraron destinatarios de contacto."
        );
      }

      const mailOptions = {
        from: `"${storeName} - Contacto" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: recipients.join(", "),
        replyTo: email,
        subject: `Nuevo mensaje de contacto de ${name} - ${storeName}`,
        html: `
          <div style="font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;border:1px solid #eee;padding:20px;border-radius:10px">
            <h1 style="color:#6C5CE7;text-align:center">Nuevo Mensaje de Contacto</h1>
            <p>Has recibido un nuevo mensaje a traves del formulario de contacto de tu tienda.</p>
            <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:20px 0">
              <p style="margin:0"><strong>Nombre:</strong> ${escapeHtml(name)}</p>
              <p style="margin:5px 0 0"><strong>Correo:</strong> ${escapeHtml(email)}</p>
              <p style="margin:15px 0 0"><strong>Mensaje:</strong></p>
              <div style="background:#fff;padding:10px;border:1px solid #ddd;border-radius:5px;margin-top:5px">${escapeHtml(message).replace(/\n/g, "<br>")}</div>
            </div>
            <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
            <p style="font-size:12px;color:#777;text-align:center">${storeName}<br>Este es un mensaje automatico enviado desde el sistema de contacto.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return { success: true, recipients };
    } catch (error) {
      logger.error("sendContactEmail error", { error: error.message, stack: error.stack });
      throw new HttpsError("internal", "Error al enviar el correo: " + error.message);
    }
  }
);

exports.sendOrderEmail = onCall(
  {
    secrets: [smtpUser, smtpPass, smtpFrom],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    try {
      logger.log("sendOrderEmail START", {
        hasData: !!request.data,
        dataKeys: request.data ? Object.keys(request.data) : [],
        smtpUser: process.env.SMTP_USER ? "SET" : "MISSING",
        smtpPass: process.env.SMTP_PASS ? "SET" : "MISSING",
        smtpFrom: process.env.SMTP_FROM ? "SET" : "MISSING",
      });

      const { order, storeSettings, pdfBase64, showPrices } = request.data;

      logger.log("sendOrderEmail DATA PARSED", {
        orderId: order?.id,
        orderNumber: order?.orderNumber,
        customerEmail: order?.customer?.email,
        customerName: order?.customer?.name,
        storeName: storeSettings?.name,
        notifications: JSON.stringify(storeSettings?.notifications),
        pdfLength: pdfBase64 ? pdfBase64.length : 0,
        showPrices,
      });

      const transporter = createTransporter();
      const storeName = storeSettings?.name || "Nuestra Tienda";
      const orderId = (order?.id || "0000").substring(0, 8).toUpperCase();
      const notifications = storeSettings?.notifications || {};

      const recipients = [
        order?.customer?.email,
        notifications.ownerEmail,
        notifications.extraEmail1,
        notifications.extraEmail2,
      ].filter((e) => e && e.trim() !== "" && e.includes("@"));

      logger.log("sendOrderEmail RECIPIENTS", {
        raw: [order?.customer?.email, notifications.ownerEmail, notifications.extraEmail1, notifications.extraEmail2],
        filtered: recipients,
        count: recipients.length,
      });

      if (recipients.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "No se encontraron destinatarios para la notificacion."
        );
      }

      const attachments = [];
      if (pdfBase64 && pdfBase64.length > 20) {
        attachments.push({
          filename: `Pedido_${orderId}.pdf`,
          content: pdfBase64,
          encoding: "base64",
        });
      }

      const pricesNote = showPrices === false
        ? `<div style="background:#FFF3E0;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #E17055">
            <p style="margin:0;font-weight:bold;color:#E17055">Nota importante:</p>
            <p style="margin:5px 0 0">Este pedido se ha registrado como una <strong>orden de compra</strong>. El documento adjunto no es una factura. Nuestro equipo se comunicara contigo para concretar los detalles de la compra, incluyendo los precios finales.</p>
           </div>`
        : "";

      const mailOptions = {
        from: `"${storeName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: recipients.join(", "),
        subject: `Nuevo Pedido #${orderId} - ${storeName}`,
        html: `
          <div style="font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;border:1px solid #eee;padding:20px;border-radius:10px">
            <h1 style="color:#6C5CE7;text-align:center">Gracias por tu pedido!</h1>
            <p>Hola <strong>${escapeHtml(order?.customer?.name || "Cliente")}</strong>,</p>
            <p>Hemos recibido tu pedido correctamente. Adjunto encontraras el comprobante de tu compra en formato PDF.</p>
            <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:20px 0">
              <p style="margin:0"><strong>Numero de Pedido:</strong> #${orderId}</p>
              ${showPrices !== false ? `<p style="margin:5px 0 0"><strong>Total a Pagar:</strong> $${(order?.total || 0).toFixed(2)}</p>` : `<p style="margin:5px 0 0"><strong>Total a Pagar:</strong> Se acordara directamente con la tienda</p>`}
              <p style="margin:5px 0 0"><strong>Metodo de Pago:</strong> Pago contra entrega</p>
            </div>
            ${pricesNote}
            <p>Nos pondremos en contacto contigo pronto para coordinar la entrega.</p>
            <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
            <p style="font-size:12px;color:#777;text-align:center">${storeName}<br>${storeSettings?.address || ""}<br>${storeSettings?.phone || ""}</p>
          </div>
        `,
        attachments,
      };

      logger.log("sendOrderEmail SENDING EMAIL", {
        to: recipients.join(", "),
        subject: mailOptions.subject,
        attachmentCount: attachments.length,
      });

      const info = await transporter.sendMail(mailOptions);
      logger.log("sendOrderEmail SUCCESS", { messageId: info.messageId, recipients });
      return { success: true, recipients, messageId: info.messageId };
    } catch (error) {
      logger.error("sendOrderEmail ERROR", {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });
      throw new HttpsError("internal", "Error al enviar el correo: " + error.message);
    }
  }
);
