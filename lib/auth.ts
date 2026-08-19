import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, testUtils } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { prismadb } from "@/lib/prisma";
import { ac, admin, manager, user } from "@/lib/auth-permissions";
import { newUserNotify } from "@/lib/new-user-notify";
import resendHelper from "@/lib/resend";
import sendEmail from "@/lib/sendmail";

const isDemo = process.env.NEXT_PUBLIC_APP_URL === "https://demo.nextcrm.io";

export const auth = betterAuth({
  database: prismaAdapter(prismadb, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "https://ernakcrm.filocentraldemando.site",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "",
    process.env.NEXT_PUBLIC_APP_URL || "",
    "https://ernakcrm.filocentraldemando.site",
    "http://localhost:3000",
    "http://localhost:3030",
  ].filter(Boolean),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,       // 7 days
    updateAge: 60 * 60 * 24,            // refresh every 24 hours
  },

  user: {
    modelName: "Users",
    fields: {
      createdAt: "created_on",
      updatedAt: "updated_at",
      image: "image",
    },
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      userStatus: {
        type: "string",
        defaultValue: isDemo ? "ACTIVE" : "PENDING",
        input: false,
      },
      userLanguage: {
        type: "string",
        defaultValue: "en",
        input: false,
      },
      avatar: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
          },
        }
      : {}),
  },

  emailAndPassword: {
    enabled: false,
  },

  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        try {
          if (process.env.EMAIL_HOST && process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD) {
            await sendEmail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
              to: email,
              subject: `Your verification code: ${otp}`,
              text: `Your one-time verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
            });
            return;
          }
          const resend = await resendHelper();
          await resend.emails.send({
            from: `${process.env.NEXT_PUBLIC_APP_NAME || "NextCRM"} <${process.env.EMAIL_FROM || "onboarding@resend.dev"}>`,
            to: email,
            subject: `Your verification code: ${otp}`,
            text: `Your one-time verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
          });
        } catch (e) {
          // In dev/test, email sending may fail — OTP is captured by testUtils plugin
          if (process.env.NODE_ENV !== "production") {
            console.log(`[Auth] OTP email send failed for ${email}, but captured by testUtils`);
          } else {
            throw e;
          }
        }
      },
    }),
    // testUtils captures OTPs for E2E testing — only enabled in non-production
    ...(process.env.NODE_ENV !== "production"
      ? [testUtils({ captureOTP: true })]
      : []),
    adminPlugin({
      ac,
      roles: { admin, manager, user },
      defaultRole: "user",
    }),
  ],

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  callbacks: {
    async onUserCreated(user: { id: string }) {
      const dbUser = await prismadb.users.findUnique({ where: { id: user.id } });
      const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_USER_EMAIL || "ernakproyectos@gmail.com";

      if (dbUser?.email && dbUser.email.toLowerCase() === adminEmail.toLowerCase()) {
        await prismadb.users.update({
          where: { id: user.id },
          data: { role: "admin", userStatus: "ACTIVE" },
        });
        return;
      }

      const count = await prismadb.users.count();
      if (count === 1) {
        await prismadb.users.update({
          where: { id: user.id },
          data: { role: "admin", userStatus: "ACTIVE" },
        });
      } else if (!isDemo && dbUser) {
        // Notify admins about new pending user
        await newUserNotify(dbUser);
      }
    },
  },
});

export type Session = typeof auth.$Infer.Session;
