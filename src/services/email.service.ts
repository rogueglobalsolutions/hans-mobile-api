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
  zoomLink: string
): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== APPOINTMENT APPROVAL EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Date: ${date} at ${time}`);
    console.log(`Zoom Link: ${zoomLink}`);
    console.log(`================================================\n`);
    return true;
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
            <p style="margin: 0 0 8px;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 0;"><strong>Meeting Link:</strong> <a href="${zoomLink}" style="color: #2563eb;">${zoomLink}</a></p>
          </div>
          <p>Please join the meeting using the link above at the scheduled time.</p>
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
  reason: string
): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n========== APPOINTMENT REJECTION EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Name: ${fullName}`);
    console.log(`Date: ${date} at ${time}`);
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
          <p>Unfortunately, your appointment request for <strong>${date} at ${time}</strong> was not approved.</p>
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
