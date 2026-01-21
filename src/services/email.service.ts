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
