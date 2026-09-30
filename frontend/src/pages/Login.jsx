import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your Email ID.");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your Password.");
      return;
    }

    navigate("/dashboard");
  };

  return (
    <main className="login-page">

      <div className="login-card">

        {/* =========================
            LOGIN HEADING
        ========================== */}

        <div className="login-heading">

          <h1>
            Welcome back!
          </h1>

          <p>
            Log in to your account
          </p>

        </div>


        {/* =========================
            LOGIN FORM
        ========================== */}

        <form
          className="login-form"
          onSubmit={handleLogin}
        >

          {/* EMAIL */}

          <div className="login-field">

            <label htmlFor="login-email">
              Email ID
            </label>

            <div className="login-input-wrapper">

              <span className="login-input-icon">
                ✉
              </span>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email ID"
                autoComplete="email"
              />

            </div>

          </div>


          {/* PASSWORD */}

          <div className="login-field">

            <label htmlFor="login-password">
              Password
            </label>

            <div className="login-input-wrapper">

              <span className="login-input-icon">
                🔒
              </span>

              <input
                id="login-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "◉" : "○"}
              </button>

            </div>

          </div>


          {/* =========================
              FORGOT PASSWORD
          ========================== */}

          <div className="login-forgot-row">

            <Link
              to="/forgot-password"
              className="forgot-password"
            >
              Forgot Password?
            </Link>

          </div>


          {/* ERROR */}

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}


          {/* LOGIN BUTTON */}

          <button
            type="submit"
            className="login-submit"
          >

            <span>
              Login
            </span>

            <span className="login-arrow">
              →
            </span>

          </button>

        </form>


        {/* FOOTER */}

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

export default Login;
