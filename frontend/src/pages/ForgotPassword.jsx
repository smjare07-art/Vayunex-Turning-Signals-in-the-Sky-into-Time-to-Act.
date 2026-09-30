import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your Email ID.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid Email ID.");
      return;
    }

    /*
      Frontend demo:
      In the real backend flow, the server
      will send the reset email.
    */

    localStorage.setItem(
      "veeyomResetEmail",
      email
    );

    setSuccess(
      "Reset link sent successfully. Please check your email."
    );

    setTimeout(() => {
      navigate("/reset-password");
    }, 1500);
  };

  return (
    <main className="login-page">

      <div className="login-card forgot-card">

        {/* HEADER */}

        <div className="login-heading">

          <div className="forgot-icon">
            🔐
          </div>

          <h1>
            Forgot Password?
          </h1>

          <p>
            Enter your email to reset your password
          </p>

        </div>


        {/* FORM */}

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >

          <div className="login-field">

            <label htmlFor="forgot-email">
              Email ID
            </label>

            <div className="login-input-wrapper">

              <span className="login-input-icon">
                ✉
              </span>

              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your registered email"
                autoComplete="email"
              />

            </div>

          </div>


          {/* ERROR */}

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}


          {/* SUCCESS */}

          {success && (
            <div className="login-success">
              {success}
            </div>
          )}


          {/* SEND BUTTON */}

          <button
            type="submit"
            className="login-submit"
          >

            <span>
              Send Reset Link
            </span>

            <span className="login-arrow">
              →
            </span>

          </button>

        </form>


        {/* BACK TO LOGIN */}

        <div className="back-login">

          <Link to="/login">
            ← Back to Login
          </Link>

        </div>


        <div className="login-footer">

          <span>
            VEEYOM Weather Intelligence
          </span>

          <span className="login-footer-dot">
            •
          </span>

          <span>
            Secure Access
          </span>

        </div>

      </div>

    </main>
  );
}

export default ForgotPassword;