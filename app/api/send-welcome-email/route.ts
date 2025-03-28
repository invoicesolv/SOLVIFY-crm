import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import nodemailer from "nodemailer";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No authenticated user found" },
        { status: 401 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "info@solvify.se",
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Email content
    const mailOptions = {
      from: "Solvify <info@solvify.se>",
      to: session.user.email,
      subject: "Welcome to Solvify Premium! 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to Solvify Premium! 🎉</h1>
          
          <p>We're thrilled to have you on board! Your premium subscription is now active, and we can't wait to help you achieve your goals.</p>
          
          <h2 style="color: #4F46E5;">Getting Started</h2>
          <ul>
            <li>Explore your new premium features</li>
            <li>Set up your first project</li>
            <li>Check out our tutorials</li>
          </ul>
          
          <p>If you need any help or have questions, don't hesitate to reach out to our support team.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>The Solvify Team</p>
        </div>
      `,
    };

    // Send email
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return NextResponse.json(
      { error: "Failed to send welcome email" },
      { status: 500 }
    );
  }
} 