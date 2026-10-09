import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  // If SMTP is not configured, log to console for development
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== OTP EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`===============================\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "Password Reset OTP",
      text: `Your OTP code is: ${otp}\n\nThis code will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Your OTP code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 8px; text-align: center; background: #f5f5f5; padding: 20px; border-radius: 8px;">${otp}</h1>
          <p style="color: #666;">This code will expire in 10 minutes.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendAppointmentApprovalEmail(
  to: string,
  fullName: string,
  date: string,
  time: string,
  timeZone: string,
  zoomLink: string
): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== APPOINTMENT APPROVAL EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Date: ${date} at ${time} (${timeZone})`);
    console.log(`Zoom Link: ${zoomLink}`);
    console.log(`================================================\n`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "Your Appointment Has Been Approved",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #15355E;">Appointment Confirmed!</h2>
          <p>Hi ${fullName},</p>
          <p>Your appointment request has been approved. Here are your details:</p>
          <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 0 0 8px;"><strong>Time:</strong> ${time} (${timeZone})</p>
            ${zoomLink ? `<p style="margin: 0;"><strong>Meeting Link:</strong> <a href="${zoomLink}" style="color: #2563eb;">${zoomLink}</a></p>` : ""}
          </div>
          <p>${zoomLink ? "Please join the meeting using the link above at the scheduled time." : "The team will share joining details with you."}</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you!</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send appointment approval email:", error);
    return false;
  }
}

export async function sendAppointmentRejectionEmail(
  to: string,
  fullName: string,
  date: string,
  time: string,
  timeZone: string,
  reason: string
): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== APPOINTMENT REJECTION EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Date: ${date} at ${time} (${timeZone})`);
    console.log(`Reason: ${reason}`);
    console.log(`=================================================\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "Your Appointment Request Was Not Approved",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #E22A44;">Appointment Request Update</h2>
          <p>Hi ${fullName},</p>
          <p>Unfortunately, your appointment request for <strong>${date} at ${time} (${timeZone})</strong> was not approved.</p>
          <div style="background: #fff5f5; border-left: 4px solid #E22A44; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #374151;"><strong>Reason:</strong> ${reason}</p>
          </div>
          <p>You are welcome to submit a new request for a different date or time.</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your understanding.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send appointment rejection email:", error);
    return false;
  }
}

export async function sendTrainingCancellationEmail(
  to: string,
  fullName: string,
  trainingTitle: string,
  refundAmountUsd: number,
): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== TRAINING CANCELLATION EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Training: ${trainingTitle}`);
    console.log(`Refund: $${refundAmountUsd}`);
    console.log(`=================================================\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "Training Cancelled — Refund Issued",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #E22A44;">Training Cancelled</h2>
          <p>Hi ${fullName},</p>
          <p>We regret to inform you that the following training has been cancelled:</p>
          <div style="background: #fff5f5; border-left: 4px solid #E22A44; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #374151;"><strong>${trainingTitle}</strong></p>
          </div>
          <p>A full refund of <strong>$${refundAmountUsd.toFixed(2)} USD</strong> has been issued to your original payment method. Please allow 5–10 business days for the funds to appear.</p>
          <p>We apologize for any inconvenience. Please feel free to browse other available training programs.</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your understanding.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send training cancellation email:", error);
    return false;
  }
}

export interface EnrollmentEmailData {
  to: string;
  fullName: string;
  training: {
    title: string;
    scheduledAt: string | Date;
    location: string;
    speaker: string;
    level: string;
  };
  enrollmentType: "ENROLLEE" | "OBSERVER";
}

export async function sendEnrollmentConfirmationEmail(data: EnrollmentEmailData): Promise<boolean> {
  const { to, fullName, training, enrollmentType } = data;
  const trainingDate = new Date(training.scheduledAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const levelDisplay = training.level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== ENROLLMENT CONFIRMATION EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Training: ${training.title}`);
    console.log(`Date: ${trainingDate}`);
    console.log(`Type: ${enrollmentType}`);
    console.log(`===================================================\n`);
    return true;
  }

  const didacticSection =
    enrollmentType === "ENROLLEE"
      ? `
        <h3 style="color: #15355E;">1. For Hands-on Trainees: Online Didactic and Quiz</h3>
        <p>Check the inbox of the email you listed in the training consent form. As a trainee, you are automatically enrolled in our Hans Academy and should have received 2 email notifications inviting you to reset your password and another to access your Pre-training course materials.</p>
        <p>Please visit the following link to access your Pre-training materials:<br/>
        <a href="https://academy.hansbiomed.us" style="color: #2563eb;">Foundational Course Link</a></p>
        <ul>
          <li>Watch the assigned MINT didactic video(s).</li>
          <li>Complete and pass the assessment quiz (minimum score: 80%).</li>
        </ul>
        <p style="font-size: 13px; color: #666;">Note: If you encounter issues accessing the platform, send an email to info@hansbiomed.us.</p>
      `
      : `
        <h3 style="color: #15355E;">2. For Observers</h3>
        <p>The online didactic steps are optional.</p>
        <p>If you would like access to the didactic materials, please contact your MINT Lift sales representative.</p>
      `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: `MINT Training Registration Confirmation — ${training.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
          <h2 style="color: #15355E;">MINT Training Registration Confirmation</h2>
          <p>Dear MINT trainees,</p>
          <p>Thank you for registering for the <strong>${training.title}</strong> session on <strong>${trainingDate}</strong>, in <strong>${training.location}</strong>. We are excited to have you join us and look forward to a valuable and impactful session together.</p>
          <p>This email includes important details to help you prepare for the training. Please read carefully and complete the required steps in advance.</p>

          <hr style="border: none; border-top: 2px solid #E5E7EB; margin: 24px 0;" />

          <h2 style="color: #15355E;">TRAINING SCHEDULE AND LOGISTICS</h2>
          <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px;"><strong>Training Date:</strong> ${trainingDate}</p>
            <p style="margin: 0 0 8px;"><strong>Training Level:</strong> ${levelDisplay}</p>
            <p style="margin: 0 0 8px;"><strong>Trainer:</strong> ${training.speaker}</p>
            <p style="margin: 0;"><strong>Location:</strong> ${training.location}</p>
          </div>
          <p>Please arrive 15 minutes early to help ensure a seamless start to the day. We will not wait for any trainees who are late. Model patients are to arrive 20 minutes before your designated hands-on time and are not allowed in the procedure room. All model patients will wait in the lounge until their turn for the procedure. This is to respect the semi-private environment, allow the training to flow swiftly, and due to limited space.</p>

          <hr style="border: none; border-top: 2px solid #E5E7EB; margin: 24px 0;" />

          <h2 style="color: #15355E;">PRE-TRAINING DIDACTIC REQUIREMENTS</h2>
          <p>During training, lecture material will be reviewed very briefly and the trainer will answer any last-minute questions before starting the hands-on segment so please make sure to study the materials in advance. We will assume you have watched the didactic and pace the hands-on training accordingly.</p>
          ${didacticSection}

          <hr style="border: none; border-top: 2px solid #E5E7EB; margin: 24px 0;" />

          <h2 style="color: #15355E;">MARKETING MATERIALS</h2>
          <p>Leverage our marketing resources to prepare your clinic! <em>(Intellectual Property of Hans Biomed USA, Inc. - Confidential - Not to be shared with any 3rd party)</em></p>
          <p>Inform your patients in advance that you will be adding MINT Lift threads to your clinic. The most successful clinics start marketing efforts early to build hype and book patients immediately after the training.</p>
          <p>Explore digital assets for social media &amp; website content, sample patient consent forms, promotional content, clinical articles, and much more via this link:<br/>
          <a href="https://mintpdo.com/digital-assets" style="color: #2563eb;">MINT Lift Digital Assets</a></p>
          <p>Print marketing materials such as patient brochures, are included as a complementary support with every MINT product order.</p>

          <hr style="border: none; border-top: 2px solid #E5E7EB; margin: 24px 0;" />

          <h2 style="color: #15355E;">NEXT STEPS</h2>
          <ul>
            <li>Complete pre-training material.</li>
            <li>Confirm model-patient details and ensure adherence to guidelines.</li>
            <li>After the training, your MINT Lift sales rep will guide you through your first thread order.</li>
          </ul>
          <p><strong>Tip:</strong> Using the product soon after your training will help build your confidence and reinforce the skills you've learned.</p>
          <p>If you haven't done so already, create your clinic account at <a href="https://store.mintpdo.com" style="color: #2563eb;">https://store.mintpdo.com</a> and bookmark this link for future orders.</p>

          <hr style="border: none; border-top: 2px solid #E5E7EB; margin: 24px 0;" />

          <p>Thank you, and we'll see you soon for an exciting day of learning and growth!</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">Hans Biomed USA, Inc.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send enrollment confirmation email:", error);
    return false;
  }
}

export async function sendTrainingLifecycleEmail(input: {
  to: string;
  fullName: string;
  subject: string;
  heading: string;
  message: string;
  trainingTitle: string;
}): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log("\n========== TRAINING UPDATE EMAIL ==========");
    console.log(`To: ${input.to}`);
    console.log(`Subject: ${input.subject}`);
    console.log(`Training: ${input.trainingTitle}`);
    console.log(input.message);
    console.log("===========================================\n");
    return true;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #27364b;">
          <h2 style="color: #15355E;">${input.heading}</h2>
          <p>Hi ${input.fullName},</p>
          <p>${input.message}</p>
          <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <strong>${input.trainingTitle}</strong>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Hans Biomed USA, Inc.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send training lifecycle email:", error);
    return false;
  }
}

export async function sendTrainingCreditIssuedEmail(input: {
  to: string;
  fullName: string;
  trainingTitle: string;
  amount: number;
  expiresAt: Date;
}): Promise<boolean> {
  const expiration = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return sendTrainingLifecycleEmail({
    to: input.to,
    fullName: input.fullName,
    subject: "Your MINT Lift Product Credits Are Available",
    heading: "Training Completed",
    trainingTitle: input.trainingTitle,
    message: `Your course completion has been confirmed. $${input.amount.toLocaleString("en-US")} in MINT Lift product credits is now available and may be used across eligible purchases through ${expiration}.`,
  });
}

export async function sendVerificationStatusEmail(
  to: string,
  status: "approved" | "rejected",
  fullName: string
): Promise<boolean> {
  // If SMTP is not configured, log to console for development
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== VERIFICATION STATUS EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Status: ${status}`);
    console.log(`===========================================\n`);
    return true;
  }

  const isApproved = status === "approved";

  const subject = isApproved
    ? "Account Verification Approved"
    : "Account Verification Update";

  const htmlContent = isApproved
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #10b981;">Account Verified!</h2>
        <p>Hi ${fullName},</p>
        <p>Great news! Your medical professional account has been verified and approved.</p>
        <p>You can now log in and access all features.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for joining our platform!</p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Account Verification Update</h2>
        <p>Hi ${fullName},</p>
        <p>Unfortunately, we were unable to verify your medical professional account at this time.</p>
        <p>If you believe this is an error or would like to provide additional documentation, please contact our support team.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your understanding.</p>
      </div>
    `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error("Failed to send verification status email:", error);
    return false;
  }
}

export async function sendSupportEmail(
  fromEmail: string,
  fromName: string,
  category: string,
  message: string
): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== SUPPORT EMAIL ==========`);
    console.log(`From: ${fromName} <${fromEmail}>`);
    console.log(`Category: ${category}`);
    console.log(`Message: ${message}`);
    console.log(`===================================\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: 'contact.rogueglobalsolutions@gmail.com',
      replyTo: fromEmail,
      subject: `[Help & Support] ${category} — from ${fromName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #15355E;">New Support Request</h2>
          <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px;"><strong>From:</strong> ${fromName}</p>
            <p style="margin: 0 0 8px;"><strong>Email:</strong> ${fromEmail}</p>
            <p style="margin: 0;"><strong>Category:</strong> ${category}</p>
          </div>
          <h3 style="color: #15355E;">Message:</h3>
          <div style="background: #f9fafb; border-left: 4px solid #15355E; padding: 12px 16px; border-radius: 4px;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Sent via Hans Mobile App — Help & Support
          </p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send support email:', error);
    return false;
  }
}

export interface InvoiceEmailData {
  to: string;
  customerName: string;
  orderNumber: string;
  items: { name: string; quantity: number; lineTotalUsd: number }[];
  shippingUsd: number;
  totalUsd: number;
  checkoutUrl: string;
  expiresAt: Date | null;
  senderName: string;
}

const usd = (value: number) => `$${value.toFixed(2)}`;

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Sends a medical professional the payment link for an order prepared by an admin or sales rep. */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<boolean> {
  const expires = data.expiresAt
    ? data.expiresAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC"
    : null;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`
========== INVOICE EMAIL ==========`);
    console.log(`To: ${data.to}`);
    console.log(`Order: ${data.orderNumber}  Total: ${usd(data.totalUsd)}`);
    console.log(`Pay: ${data.checkoutUrl}`);
    console.log(`===================================
`);
    return true;
  }

  const rows = data.items
    .map(
      (item) => `<tr><td style="padding:6px 0">${escapeEmailHtml(item.name)} × ${item.quantity}</td><td style="padding:6px 0;text-align:right">${usd(item.lineTotalUsd)}</td></tr>`,
    )
    .join("");

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: data.to,
      subject: `Your Hans Biomed order ${data.orderNumber} is ready for payment`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0e1a33;">
          <h2 style="color: #16305c;">Your order is ready</h2>
          <p>Hi ${escapeEmailHtml(data.customerName)},</p>
          <p>${escapeEmailHtml(data.senderName)} prepared order <strong>${escapeEmailHtml(data.orderNumber)}</strong> for you. Review it below and pay securely through Stripe.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border-top:1px solid #e1e5ec;border-bottom:1px solid #e1e5ec">
            ${rows}
            <tr><td style="padding:6px 0;color:#5f6b82">Shipping</td><td style="padding:6px 0;text-align:right">${usd(data.shippingUsd)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #e1e5ec">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;border-top:1px solid #e1e5ec">${usd(data.totalUsd)}</td></tr>
          </table>
          <p style="text-align:center;margin:24px 0">
            <a href="${data.checkoutUrl}" style="background:#c8102e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block">Pay ${usd(data.totalUsd)}</a>
          </p>
          ${expires ? `<p style="color:#5f6b82;font-size:13px">This link expires ${expires}. If it expires, reply to your Hans Biomed contact for a new one.</p>` : ""}
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return false;
  }
}
