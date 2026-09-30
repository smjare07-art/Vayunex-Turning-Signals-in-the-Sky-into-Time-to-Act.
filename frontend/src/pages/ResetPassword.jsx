import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  const handleReset = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");


    if (!password.trim()) {
      setError("Please enter a new password.");
      return;
    }


    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }


    if (!confirmPassword.trim()) {
      setError(
        "Please confirm your new password."
      );
      return;
    }


    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }


    localStorage.setItem(
      "veeyomPassword",
      password
    );


    setSuccess(
      "Password updated successfully."
    );


    setTimeout(() => {
      navigate("/login");
    }, 1500);
  };


  return (
    <main className="login-page">

      <div className="login-card forgot-card">

        {/* HEADER */}

        <div className="login-heading">

          <div className="forgot-icon">
            🔑
          </div>

          <h1>
            Reset Password
          </h1>

          <p>
            Create a new password for your account
          </p>

        </div>


        {/* FORM */}

        <form
          className="login-form"
          onSubmit={handleReset}
        >

          {/* NEW PASSWORD */}

          <div className="login-field">

            <label htmlFor="new-password">
              New Password
            </label>

            <div className="login-input-wrapper">

              <span className="login-input-icon">
                🔒
              </span>

              <input
                id="new-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter new password"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
              >
                {showPassword ? "◉" : "○"}
              </button>

            </div>

          </div>


          {/* CONFIRM PASSWORD */}

          <div className="login-field">

            <label htmlFor="confirm-password">
              Confirm Password
            </label>

            <div className="login-input-wrapper">

              <span className="login-input-icon">
                🔒
              </span>

              <input
                id="confirm-password"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Confirm new password"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) => !current
                  )
                }
              >
                {showConfirmPassword
                  ? "◉"
                  : "○"}
              </button>

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


          {/* RESET BUTTON */}

          <button
            type="submit"
            className="login-submit"
          >

            <span>
              Update Password
            </span>

            <span className="login-arrow">
              →
            </span>

          </button>

        </form>


        {/* BACK */}

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

export default ResetPassword;