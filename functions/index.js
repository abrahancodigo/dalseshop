const { createHash } = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

initializeApp();

const db = getFirestore();
const authAdmin = getAuth();
const SUPER_ADMIN_EMAIL = "abrahanramos@gmail.com";
const VALID_ROLES = ["superadmin", "admin", "escritor", "lector"];
const USERNAME_AUTH_DOMAIN = "auth.dalseshop.internal";

const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const smtpFrom = defineSecret("SMTP_FROM");

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9](?:[a-z0-9._-]{2,29})$/.test(normalizeUsername(value));
}

function usernameAuthEmail(username) {
  return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`;
}

function uniqueEmails(values) {
  return [...new Set(values.map(cleanEmail).filter(Boolean))];
}

function cleanPermissions(value) {
  const allowedKeys = [
    "dashboard", "settings", "theme", "pages", "navigation", "products",
    "categories", "brands", "orders", "customers", "coupons", "blog",
    "newsletter", "reviews", "shipping", "features", "users", "inventory", "payroll", "marketResearch",
  ];
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of allowedKeys) {
    const permission = value[key];
    if (permission === true || permission === false || permission === "view" || permission === "manage") {
      result[key] = permission;
    }
  }
  return result;
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return request.auth;
}

async function getAccess(auth) {
  if (!auth?.uid) return { role: null, active: false, permissions: {} };
  const email = cleanEmail(auth.token?.email);
  if (email === SUPER_ADMIN_EMAIL) {
    return { role: "superadmin", active: true, permissions: {} };
  }
  const snapshot = await db.doc(`users/${auth.uid}`).get();
  if (!snapshot.exists) return { role: null, active: false, permissions: {} };
  const data = snapshot.data() || {};
  return {
    role: VALID_ROLES.includes(data.role) ? data.role : "lector",
    active: data.isActive !== false,
    permissions: data.customPermissions || {},
  };
}

function permissionValue(access, permission, fallback) {
  return Object.prototype.hasOwnProperty.call(access.permissions, permission)
    ? access.permissions[permission]
    : fallback;
}

function canManage(access, permission) {
  if (!access.active) return false;
  if (access.role === "superadmin" || access.role === "admin") {
    const value = permissionValue(access, permission, true);
    return value === true || value === "manage";
  }
  if (access.role === "escritor") {
    const editorDefaults = ["pages", "products", "categories", "brands", "blog", "inventory"];
    const value = permissionValue(access, permission, editorDefaults.includes(permission) ? "manage" : "view");
    return value === true || value === "manage";
  }
  return false;
}

async function requireManage(request, permission) {
  const auth = requireAuth(request);
  const access = await getAccess(auth);
  if (!canManage(access, permission)) {
    throw new HttpsError("permission-denied", "No tienes permiso para realizar esta acción.");
  }
  return { auth, access };
}

async function getStoreSettings() {
  const [settingsSnapshot, featuresSnapshot] = await Promise.all([
    db.doc("config/settings").get(),
    db.doc("config/features").get(),
  ]);
  return {
    settings: settingsSnapshot.exists ? settingsSnapshot.data() : {},
    features: featuresSnapshot.exists ? featuresSnapshot.data() : {},
  };
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function enforceRateLimit(key, maxAttempts, windowMs) {
  const ref = db.doc(`rate_limits/${key}`);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const windowStartedAt = Number(data.windowStartedAt || 0);
    const withinWindow = now - windowStartedAt < windowMs;
    const count = withinWindow ? Number(data.count || 0) : 0;
    if (count >= maxAttempts) {
      throw new HttpsError("resource-exhausted", "Demasiados intentos. Intenta más tarde.");
    }
    transaction.set(ref, {
      count: count + 1,
      windowStartedAt: withinWindow ? windowStartedAt : now,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

exports.ensureUserProfile = onCall(async (request) => {
  const auth = requireAuth(request);
  const uidRef = db.doc(`users/${auth.uid}`);
  const uidSnapshot = await uidRef.get();
  if (uidSnapshot.exists) return { id: auth.uid, ...uidSnapshot.data() };

  const email = cleanEmail(auth.token?.email);
  const username = email.endsWith(`@${USERNAME_AUTH_DOMAIN}`)
    ? email.slice(0, -(`@${USERNAME_AUTH_DOMAIN}`).length)
    : "";
  const legacySnapshot = email
    ? await db.collection("users").where("email", "==", email).limit(1).get()
    : null;
  const legacyDoc = legacySnapshot && !legacySnapshot.empty ? legacySnapshot.docs[0] : null;
  const legacyData = legacyDoc?.data() || {};
  const role = email === SUPER_ADMIN_EMAIL
    ? "superadmin"
    : (VALID_ROLES.includes(legacyData.role) ? legacyData.role : "lector");
  const profile = {
    email,
    ...(username ? { username } : {}),
    displayName: cleanText(legacyData.displayName || auth.token?.name || email.split("@")[0], 120),
    photoURL: cleanText(legacyData.photoURL || auth.token?.picture, 2000),
    role,
    isActive: legacyData.isActive !== false,
    customPermissions: cleanPermissions(legacyData.customPermissions),
    createdAt: legacyData.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = db.batch();
  batch.set(uidRef, profile, { merge: true });
  if (legacyDoc && legacyDoc.id !== auth.uid) batch.delete(legacyDoc.ref);
  await batch.commit();
  await authAdmin.setCustomUserClaims(auth.uid, { role });
  return { id: auth.uid, ...profile, createdAt: null, updatedAt: null };
});

exports.saveManagedUser = onCall(async (request) => {
  const { auth } = await requireManage(request, "users");
  const data = request.data || {};
  const username = normalizeUsername(data.username);
  const isUsernameAccount = Boolean(username);
  if (isUsernameAccount && !isValidUsername(username)) {
    throw new HttpsError("invalid-argument", "El nombre de usuario no es válido.");
  }
  const email = isUsernameAccount ? usernameAuthEmail(username) : cleanEmail(data.email);
  const displayName = cleanText(data.displayName || username || email, 120);
  const legacyId = cleanText(data.legacyId, 128);
  const callerIsSuperAdmin = cleanEmail(auth.token?.email) === SUPER_ADMIN_EMAIL;
  let requestedRole = VALID_ROLES.includes(data.role) ? data.role : "lector";
  if (!email) throw new HttpsError("invalid-argument", "El usuario o correo no es válido.");
  if (email === SUPER_ADMIN_EMAIL) requestedRole = "superadmin";
  if (requestedRole === "superadmin" && !callerIsSuperAdmin) {
    throw new HttpsError("permission-denied", "Solo el superadmin puede asignar ese rol.");
  }

  const legacySnapshot = legacyId ? await db.doc(`users/${legacyId}`).get() : null;
  const legacyProfile = legacySnapshot?.exists ? legacySnapshot.data() : {};
  let authUser = null;
  if (legacyId) {
    try {
      authUser = await authAdmin.getUser(legacyId);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      const legacyEmail = cleanEmail(legacyProfile.email);
      if (legacyEmail) {
        try {
          authUser = await authAdmin.getUserByEmail(legacyEmail);
        } catch (emailError) {
          if (emailError.code !== "auth/user-not-found") throw emailError;
        }
      }
    }
  }
  if (!authUser) {
    try {
      authUser = await authAdmin.getUserByEmail(email);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
  }

  if (!authUser && isUsernameAccount && !data.password) {
    throw new HttpsError("invalid-argument", "La contraseña es obligatoria al crear un usuario.");
  }

  const targetWasSuperAdmin = legacyProfile.role === "superadmin"
    || cleanEmail(legacyProfile.email) === SUPER_ADMIN_EMAIL
    || authUser?.customClaims?.role === "superadmin"
    || cleanEmail(authUser?.email) === SUPER_ADMIN_EMAIL;
  if (targetWasSuperAdmin && !callerIsSuperAdmin) {
    throw new HttpsError("permission-denied", "Solo el superadmin puede modificar esa cuenta.");
  }

  if (authUser) {
    const updateData = {
      email,
      displayName,
      disabled: data.isActive === false,
    };
    if (data.password) updateData.password = String(data.password).slice(0, 128);
    authUser = await authAdmin.updateUser(authUser.uid, updateData);
  } else {
    const createData = {
      email,
      displayName,
      disabled: data.isActive === false,
    };
    if (data.password) createData.password = String(data.password).slice(0, 128);
    authUser = await authAdmin.createUser(createData);
  }

  await authAdmin.setCustomUserClaims(authUser.uid, { role: requestedRole });
  const targetRef = db.doc(`users/${authUser.uid}`);
  const targetSnapshot = await targetRef.get();
  const profile = {
    email,
    ...(isUsernameAccount ? { username } : {}),
    displayName,
    photoURL: cleanText(data.photoURL || legacyProfile.photoURL || authUser.photoURL, 2000),
    role: requestedRole,
    isActive: data.isActive !== false,
    customPermissions: cleanPermissions(data.customPermissions),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!targetSnapshot.exists) profile.createdAt = legacyProfile.createdAt || FieldValue.serverTimestamp();
  await targetRef.set(profile, { merge: true });
  if (legacySnapshot?.exists && legacyId !== authUser.uid) await legacySnapshot.ref.delete();
  return { id: authUser.uid };
});

exports.resetManagedUserPassword = onCall(async (request) => {
  await requireManage(request, "users");
  const uid = cleanText(request.data?.uid, 128);
  const password = String(request.data?.password || "");
  if (!uid || password.length < 6 || password.length > 128) {
    throw new HttpsError("invalid-argument", "La contraseña debe tener entre 6 y 128 caracteres.");
  }
  await authAdmin.updateUser(uid, { password });
  return { success: true };
});

exports.deleteManagedUser = onCall(async (request) => {
  const { auth } = await requireManage(request, "users");
  const uid = cleanText(request.data?.uid, 128);
  if (!uid || uid === auth.uid) throw new HttpsError("invalid-argument", "No puedes eliminar tu propio usuario.");
  const profileRef = db.doc(`users/${uid}`);
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.data() || {};
  let authUser = null;
  try {
    authUser = await authAdmin.getUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    const email = cleanEmail(profile.email);
    if (email) {
      try {
        authUser = await authAdmin.getUserByEmail(email);
      } catch (emailError) {
        if (emailError.code !== "auth/user-not-found") throw emailError;
      }
    }
  }
  if (
    profile.role === "superadmin"
    || cleanEmail(profile.email) === SUPER_ADMIN_EMAIL
    || authUser?.customClaims?.role === "superadmin"
    || cleanEmail(authUser?.email) === SUPER_ADMIN_EMAIL
  ) {
    throw new HttpsError("permission-denied", "No se puede eliminar al superadmin.");
  }
  await profileRef.delete();
  if (authUser) {
    if (authUser.uid !== uid) await db.doc(`users/${authUser.uid}`).delete();
    await authAdmin.deleteUser(authUser.uid);
  }
  return { success: true };
});

exports.subscribeNewsletter = onCall(async (request) => {
  const email = cleanEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "El correo no es válido.");
  const emailHash = createHash("sha256").update(email).digest("hex");
  const ipHash = createHash("sha256")
    .update(String(request.rawRequest?.ip || "unknown"))
    .digest("hex")
    .slice(0, 32);
  await enforceRateLimit(`newsletter_ip_${ipHash}`, 20, 24 * 60 * 60 * 1000);
  await enforceRateLimit(`newsletter_${emailHash}`, 3, 24 * 60 * 60 * 1000);
  const ref = db.doc(`subscribers/${emailHash}`);
  const snapshot = await ref.get();
  if (snapshot.exists) return { success: true, alreadySubscribed: true };
  await ref.set({ email, subscribedAt: FieldValue.serverTimestamp() });
  return { success: true };
});

exports.submitReview = onCall(async (request) => {
  const productId = cleanText(request.data?.productId, 128);
  const name = cleanText(request.data?.name, 120);
  const comment = cleanText(request.data?.comment, 3000);
  const rating = Math.trunc(Number(request.data?.rating));
  if (!productId || !name || comment.length < 3 || rating < 1 || rating > 5) {
    throw new HttpsError("invalid-argument", "Completa correctamente la reseña.");
  }

  const productSnapshot = await db.doc(`products/${productId}`).get();
  if (!productSnapshot.exists || productSnapshot.data()?.isActive === false) {
    throw new HttpsError("not-found", "El producto no está disponible.");
  }

  const ipHash = createHash("sha256")
    .update(String(request.rawRequest?.ip || "unknown"))
    .digest("hex")
    .slice(0, 32);
  await enforceRateLimit(`review_ip_${ipHash}`, 10, 24 * 60 * 60 * 1000);
  await enforceRateLimit(`review_${ipHash}_${productId}`, 3, 24 * 60 * 60 * 1000);

  const reviewRef = db.collection("reviews").doc();
  await reviewRef.set({
    name,
    rating,
    comment,
    productId,
    productName: cleanText(productSnapshot.data()?.name, 160),
    isApproved: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: reviewRef.id };
});

exports.createOrder = onCall(async (request) => {
  const auth = requireAuth(request);
  const access = await getAccess(auth);
  if (!access.active && access.role) throw new HttpsError("permission-denied", "La cuenta está inactiva.");
  const data = request.data || {};
  const source = data.source === "facturacion" ? "facturacion" : "checkout";
  if (source === "facturacion" && !canManage(access, "orders")) {
    throw new HttpsError("permission-denied", "No tienes permiso para crear pedidos administrativos.");
  }

  const requestedItems = Array.isArray(data.items) ? data.items.slice(0, 100) : [];
  if (!requestedItems.length) throw new HttpsError("invalid-argument", "El pedido no contiene productos.");
  const normalizedItems = requestedItems.map((item) => ({
    productId: cleanText(item.productId, 128),
    quantity: Math.max(1, Math.min(100, Math.trunc(Number(item.quantity) || 1))),
    variant: cleanText(item.variant, 120) || null,
  }));
  if (normalizedItems.some((item) => !item.productId)) {
    throw new HttpsError("invalid-argument", "Hay productos inválidos en el pedido.");
  }
  if (new Set(normalizedItems.map((item) => item.productId)).size !== normalizedItems.length) {
    throw new HttpsError("invalid-argument", "El pedido contiene productos duplicados.");
  }
  await enforceRateLimit(
    `orders_${auth.uid}`,
    canManage(access, "orders") ? 100 : 20,
    60 * 60 * 1000
  );

  const authEmail = cleanEmail(auth.token?.email);
  const requestedEmail = cleanEmail(data.customer?.email);
  const customerEmail = source === "checkout" ? authEmail : requestedEmail;
  if (!customerEmail) throw new HttpsError("invalid-argument", "El correo del cliente no es válido.");
  const customer = {
    name: cleanText(data.customer?.name || auth.token?.name, 120),
    email: customerEmail,
    phone: cleanText(data.customer?.phone, 40),
    address: cleanText(data.customer?.address, 300),
    city: cleanText(data.customer?.city, 100),
    state: cleanText(data.customer?.state, 100),
    zipCode: cleanText(data.customer?.zipCode, 30),
  };
  if (!customer.name) throw new HttpsError("invalid-argument", "El nombre del cliente es obligatorio.");

  return db.runTransaction(async (transaction) => {
    const productRefs = normalizedItems.map((item) => db.doc(`products/${item.productId}`));
    const productSnapshots = [];
    for (const productRef of productRefs) productSnapshots.push(await transaction.get(productRef));
    const counterRef = db.doc("config/orderCounter");
    const shippingRef = db.doc("config/shipping");
    const counterSnapshot = await transaction.get(counterRef);
    const shippingSnapshot = await transaction.get(shippingRef);

    let subtotal = 0;
    const items = normalizedItems.map((item, index) => {
      const snapshot = productSnapshots[index];
      if (!snapshot.exists) throw new HttpsError("not-found", "Uno de los productos ya no existe.");
      const product = snapshot.data();
      const currentStock = Number(product.stock) || 0;
      if (currentStock < item.quantity) {
        throw new HttpsError("failed-precondition", `Stock insuficiente para ${cleanText(product.name, 120)}.`);
      }
      const price = Math.max(0, Number(product.price) || 0);
      subtotal += price * item.quantity;
      return {
        productId: snapshot.id,
        name: cleanText(product.name, 160),
        price,
        quantity: item.quantity,
        variant: item.variant,
        image: cleanText(product.images?.[0] || product.image, 2000),
        barcode: cleanText(product.barcode, 120),
        sku: cleanText(product.sku, 120),
        productRef: snapshot.ref,
        newStock: currentStock - item.quantity,
      };
    });

    const shippingConfig = shippingSnapshot.exists ? shippingSnapshot.data() : {};
    const shippingZone = cleanText(data.shippingZone, 120);
    let shipping = source === "facturacion" ? 0 : Math.max(0, Number(shippingConfig.flatRate) || 0);
    if (source === "checkout" && shippingConfig.freeShipping === true) {
      const minimum = Math.max(0, Number(shippingConfig.freeShippingMin) || 0);
      if (minimum === 0 || subtotal >= minimum) shipping = 0;
    } else if (source === "checkout" && shippingZone && Array.isArray(shippingConfig.zones)) {
      const zone = shippingConfig.zones.find((entry) => cleanText(entry?.name, 120) === shippingZone);
      if (zone) shipping = Math.max(0, Number(zone.cost) || 0);
    }
    const orderNumber = (counterSnapshot.exists ? Number(counterSnapshot.data().value) || 0 : 0) + 1;
    const orderRef = db.collection("orders").doc();
    const publicItems = items.map(({ productRef, newStock, ...item }) => item);
    const order = {
      items: publicItems,
      subtotal,
      shipping,
      discount: 0,
      total: Math.max(0, subtotal + shipping),
      customer,
      customerEmail,
      userId: auth.uid,
      notes: cleanText(data.notes, 1000),
      status: "pending",
      paymentMethod: cleanText(data.paymentMethod || "cashOnDelivery", 50),
      paymentStatus: "pending",
      source,
      shippingZone: shippingZone || null,
      invoice: data.invoice?.wantsInvoice ? {
        wantsInvoice: true,
        businessName: cleanText(data.invoice.businessName, 180),
        taxId: cleanText(data.invoice.taxId, 80),
        nrc: cleanText(data.invoice.nrc, 80),
        businessType: cleanText(data.invoice.businessType, 180),
      } : null,
      orderNumber,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(counterRef, { value: orderNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    for (const item of items) {
      transaction.update(item.productRef, { stock: item.newStock, updatedAt: FieldValue.serverTimestamp() });
    }
    transaction.set(orderRef, order);
    return { id: orderRef.id, orderNumber, order: { ...order, createdAt: null, updatedAt: null } };
  });
});

exports.sendContactEmail = onCall(
  { secrets: [smtpUser, smtpPass, smtpFrom], timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    const name = cleanText(request.data?.name, 120);
    const email = cleanEmail(request.data?.email);
    const message = cleanText(request.data?.message, 5000);
    if (!name || !email || message.length < 5) {
      throw new HttpsError("invalid-argument", "Completa correctamente el formulario de contacto.");
    }
    const ipHash = createHash("sha256")
      .update(String(request.rawRequest?.ip || "unknown"))
      .digest("hex")
      .slice(0, 32);
    await enforceRateLimit(`contact_${ipHash}`, 5, 10 * 60 * 1000);

    const { settings } = await getStoreSettings();
    const access = await getAccess(request.auth);
    const suppliedSettings = request.data?.storeSettings || {};
    const contactNotifications = canManage(access, "settings")
      ? (suppliedSettings.contactNotifications || settings.contactNotifications || {})
      : (settings.contactNotifications || {});
    const recipients = uniqueEmails([
      contactNotifications.email1,
      contactNotifications.email2,
      contactNotifications.email3,
    ]);
    if (!recipients.length) throw new HttpsError("failed-precondition", "No hay destinatarios configurados.");

    const storeName = cleanText(settings.name || "Nuestra Tienda", 120);
    await createTransporter().sendMail({
      from: `"${storeName} - Contacto" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${name} - ${storeName}`,
      html: `<div style="font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
        <h1>Nuevo mensaje de contacto</h1>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Correo:</strong> ${escapeHtml(email)}</p>
        <p><strong>Mensaje:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      </div>`,
    });
    logger.info("Contact email sent", { recipientCount: recipients.length });
    return { success: true };
  }
);

exports.sendOrderEmail = onCall(
  { secrets: [smtpUser, smtpPass, smtpFrom], timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const auth = requireAuth(request);
    const access = await getAccess(auth);
    const suppliedOrder = request.data?.order || {};
    const orderId = cleanText(request.data?.orderId || suppliedOrder.id, 128);
    const isTest = orderId.startsWith("TEST-") && canManage(access, "settings");
    let order;
    let orderRef = null;
    if (isTest) {
      order = suppliedOrder;
    } else {
      if (!orderId) throw new HttpsError("invalid-argument", "Pedido no válido.");
      orderRef = db.doc(`orders/${orderId}`);
      const snapshot = await orderRef.get();
      if (!snapshot.exists) throw new HttpsError("not-found", "El pedido no existe.");
      order = { id: snapshot.id, ...snapshot.data() };
      const ownsOrder = order.userId === auth.uid || cleanEmail(order.customerEmail) === cleanEmail(auth.token?.email);
      const canViewAll = access.active && ["superadmin", "admin", "escritor"].includes(access.role);
      if (!ownsOrder && !canViewAll) throw new HttpsError("permission-denied", "No puedes enviar este pedido.");
      if (order.emailSentAt && !canManage(access, "orders")) return { success: true, alreadySent: true };
    }

    const pdfBase64 = String(request.data?.pdfBase64 || "");
    if (pdfBase64.length > 11_000_000) throw new HttpsError("invalid-argument", "El PDF es demasiado grande.");
    const { settings, features } = await getStoreSettings();
    const notifications = settings.notifications || {};
    const recipients = isTest
      ? uniqueEmails([order.customer?.email])
      : uniqueEmails([order.customer?.email, notifications.ownerEmail, notifications.extraEmail1, notifications.extraEmail2]);
    if (!recipients.length) throw new HttpsError("failed-precondition", "No hay destinatarios configurados.");

    const storeName = cleanText(settings.name || "Nuestra Tienda", 120);
    const displayOrderNumber = order.orderNumber || orderId.substring(0, 8).toUpperCase();
    const showPrices = features.showPrices !== false;
    const attachments = pdfBase64.length > 20 ? [{
      filename: `Pedido_${displayOrderNumber}.pdf`,
      content: pdfBase64,
      encoding: "base64",
      contentType: "application/pdf",
    }] : [];
    await createTransporter().sendMail({
      from: `"${storeName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `${isTest ? "Prueba - " : ""}Nuevo Pedido #${displayOrderNumber} - ${storeName}`,
      html: `<div style="font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
        <h1>Gracias por tu pedido</h1>
        <p>Hola <strong>${escapeHtml(order.customer?.name || "Cliente")}</strong>,</p>
        <p>Hemos recibido tu pedido correctamente.</p>
        <p><strong>Número:</strong> #${escapeHtml(displayOrderNumber)}</p>
        ${showPrices ? `<p><strong>Total:</strong> ${formatCurrency(order.total)}</p>` : ""}
      </div>`,
      attachments,
    });
    if (orderRef) await orderRef.set({ emailSentAt: FieldValue.serverTimestamp() }, { merge: true });
    logger.info("Order email sent", { orderId, recipientCount: recipients.length, isTest });
    return { success: true };
  }
);
