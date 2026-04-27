import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { order, storeSettings, pdfBase64 } = await request.json();

    console.log("send-order-email: order id:", order?.id);
    console.log("send-order-email: customer email:", order?.customer?.email);
    console.log("send-order-email: notifications:", JSON.stringify(storeSettings?.notifications));
    console.log("send-order-email: SMTP_USER set:", !!process.env.SMTP_USER);
    console.log("send-order-email: SMTP_PASS set:", !!process.env.SMTP_PASS);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const storeName = storeSettings?.name || "Nuestra Tienda";
    const orderId = order.id?.substring(0, 8).toUpperCase() || "N/A";

    // Build recipients list from all possible sources
    const notifications = storeSettings?.notifications || {};
    const recipients = [
      order.customer?.email,
      notifications.ownerEmail,
      notifications.extraEmail1,
      notifications.extraEmail2,
    ].filter((email) => email && email.trim() !== "" && email.includes("@"));

    console.log("send-order-email: recipients:", recipients);

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se encontraron destinatarios. Verifica la configuración de notificaciones." }),
        { status: 400 }
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

    const mailOptions = {
      from: `"${storeName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `Nuevo Pedido #${orderId} - ${storeName}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h1 style="color: #6C5CE7; text-align: center;">¡Gracias por tu pedido!</h1>
          <p>Hola <strong>${order.customer?.name || "Cliente"}</strong>,</p>
          <p>Hemos recibido tu pedido correctamente. Adjunto encontrarás el comprobante de tu compra en formato PDF.</p>

          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Número de Pedido:</strong> #${orderId}</p>
            <p style="margin: 5px 0 0;"><strong>Total a Pagar:</strong> $${(order.total || 0).toLocaleString()}</p>
            <p style="margin: 5px 0 0;"><strong>Método de Pago:</strong> Pago contra entrega</p>
          </div>

          <p>Nos pondremos en contacto contigo pronto para coordinar la entrega.</p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />

          <p style="font-size: 12px; color: #777; text-align: center;">
            ${storeName}<br>
            ${storeSettings?.address || ""}<br>
            ${storeSettings?.phone || ""}
          </p>
        </div>
      `,
      attachments,
    };

    await transporter.sendMail(mailOptions);
    console.log("send-order-email: SUCCESS - sent to:", recipients.join(", "));

    return new Response(JSON.stringify({ success: true, recipients }), { status: 200 });
  } catch (error) {
    console.error("send-order-email: ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
