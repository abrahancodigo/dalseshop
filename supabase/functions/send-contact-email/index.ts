import "@supabase/functions-js/edge-runtime.d.ts";

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  try {
    const { name, email, message, storeSettings } = await req.json();

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
    const contactNotif = storeSettings?.contactNotifications || {};
    const recipients = [
      contactNotif.email1,
      contactNotif.email2,
      contactNotif.email3,
    ].filter((e: string) => e && e.trim() !== "" && e.includes("@"));

    if (recipients.length === 0) {
      throw new Error("No se encontraron destinatarios de contacto.");
    }

    const mailOptions = {
      from: `"${storeName} - Contacto" <${smtpFrom}>`,
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

    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (err: any, info: any) => {
        if (err) reject(err);
        else resolve(info);
      });
    });

    return new Response(
      JSON.stringify({ success: true, recipients }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sendContactEmail error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
