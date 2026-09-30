const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const pool = require("../config/db");

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const result = await pool.query(
            "SELECT id, email FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                message:
                    "If this email exists, a password reset link has been sent."
            });
        }

        const user = result.rows[0];

        const resetToken =
            crypto.randomBytes(32).toString("hex");

        const hashedToken =
            crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");

        const expires =
            new Date(Date.now() + 15 * 60 * 1000);

        await pool.query(
            `UPDATE users
             SET reset_password_token = $1,
                 reset_password_expires = $2
             WHERE id = $3`,
            [
                hashedToken,
                expires,
                user.id
            ]
        );

        const resetUrl =
            `http://localhost:5173/reset-password/${resetToken}`;

        const transporter =
            nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Reset Your Password",

            html: `
                <h2>Password Reset</h2>

                <p>You requested to reset your password.</p>

                <p>Click the button below to reset it.</p>

                <a
                    href="${resetUrl}"
                    style="
                        display:inline-block;
                        padding:12px 20px;
                        background:#2563eb;
                        color:white;
                        text-decoration:none;
                        border-radius:6px;
                    "
                >
                    Reset Password
                </a>

                <p>This link will expire in 15 minutes.</p>
            `
        });

        return res.json({
            success: true,
            message:
                "If this email exists, a password reset link has been sent."
        });

    } catch (error) {
        console.error(
            "Forgot Password Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// ========================================
// RESET PASSWORD
// ========================================

const resetPassword = async (req, res) => {
    try {

        const { token } = req.params;
        const { password } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Reset token is required"
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "New password is required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // Hash received token
        const hashedToken =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

        // Find valid token
        const result = await pool.query(
            `SELECT id
             FROM users
             WHERE reset_password_token = $1
             AND reset_password_expires > NOW()`,
            [hashedToken]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token"
            });
        }

        const userId = result.rows[0].id;

        // Hash new password
        const hashedPassword =
            await bcrypt.hash(password, 12);

        // Update password and remove reset token
        await pool.query(
            `UPDATE users
             SET password = $1,
                 reset_password_token = NULL,
                 reset_password_expires = NULL
             WHERE id = $2`,
            [
                hashedPassword,
                userId
            ]
        );

        return res.json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error) {

        console.error(
            "Reset Password Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// ========================================
// EXPORTS
// ========================================

module.exports = {
    forgotPassword,
    resetPassword
};