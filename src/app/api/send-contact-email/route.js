import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { name, email, message, storeSettings } = await request.json();

    console.log("send-contact-email: from:", email);
    console.log("send-contact-email: contactNotifications:", JSON.stringify(storeSettings?.contactNotifications));

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const storeName = storeSettings?.name || "Nuestra Tienda";

    // Build recipients list
    const contactNotif = storeSettings?.contactNotifications || {};
    const recipients = [
      contactNotif.email1,
      contactNotif.email2,
      contactNotif.email3,
    ].filter((email) => email && email.trim() !== "" && email.includes("@"));

    console.log("send-contact-email: recipients:", recipients);

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se encontraron destinatarios de contacto. Verifica la configuración." }),
        { status: 400 }
      );
    }

    const mailOptions = {
      from: `"${storeName} - Contacto" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${name} - ${storeName}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h1 style="color: #6C5CE7; text-align: center;">Nuevo Mensaje de Contacto</h1>
          <p>Has recibido un nuevo mensaje a través del formulario de contacto de tu tienda.</p>

          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Nombre:</strong> ${name}</p>
            <p style="margin: 5px 0 0;"><strong>Correo:</strong> ${email}</p>
            <p style="margin: 15px 0 0;"><strong>Mensaje:</strong></p>
            <div style="background: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-top: 5px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>

          <p>Puedes responder directamente a este correo para contactar al cliente.</p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />

          <p style="font-size: 12px; color: #777; text-align: center;">
            ${storeName}<br>
            Este es un mensaje automático enviado desde el sistema de contacto.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("send-contact-email: SUCCESS - sent to:", recipients.join(", "));

    return new Response(JSON.stringify({ success: true, recipients }), { status: 200 });
  } catch (error) {
    console.error("send-contact-email: ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
