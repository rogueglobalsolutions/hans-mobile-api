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