import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail(
  transporter: any,
  mailOptions: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err: any, info: any) => {
      if (err) reject(err);
      else resolve(info);
    });
  });
}

Deno.serve(async (req) => {
  try {
    const { order, storeSettings, pdfBase64, showPrices } = await req.json();

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured");
    }

    const nodemailer = await import("npm:nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const storeName = storeSettings?.name || "Nuestra Tienda";
    const orderId = (order?.id || "0000").substring(0, 8).toUpperCase();
    const notifications = storeSettings?.notifications || {};

    const recipients = [
      order?.customer?.email,
      notifications.ownerEmail,
      notifications.extraEmail1,
      notifications.extraEmail2,
    ].filter((e: string) => e && e.trim() !== "" && e.includes("@"));

    if (recipients.length === 0) {
      throw new Error("No se encontraron destinatarios para la notificacion.");
    }

    const attachments: any[] = [];
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
      from: `"${storeName}" <${smtpFrom}>`,
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

    const info = await sendEmail(transporter, mailOptions);

    return new Response(
      JSON.stringify({ success: true, recipients, messageId: info.messageId }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sendOrderEmail error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
