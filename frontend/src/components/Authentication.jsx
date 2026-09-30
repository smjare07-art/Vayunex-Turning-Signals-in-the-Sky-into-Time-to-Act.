import React from "react";
import { useNavigate } from "react-router-dom";
import "./Authentication.css";


const Authentication = () => {
  const navigate = useNavigate();

  const [formState, setFormState] = React.useState(0);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("user");

  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // ==========================================
  // ROLE BASED DASHBOARD REDIRECT
  // ==========================================
  const redirectByRole = (userRole) => {

    console.log("USER ROLE:", userRole);

    if (userRole === "admin") {
      navigate("/admin");
    }

    else if (userRole === "rescue") {
      navigate("/rescue/dashboard");
    }

    else if (userRole === "user") {
      navigate("/dashboard");
    }

    else {
      setError("Invalid user role");
    }
  };


  // ==========================================
  // LOGIN / REGISTER
  // ==========================================
  const handleAuth = async (e) => {

    e.preventDefault();

    setError("");
    setMessage("");

    // =========================
    // VALIDATION
    // =========================

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    if (formState === 1 && !role) {
      setError("Please select your role");
      return;
    }


    try {

      setLoading(true);


      // ==========================================
      // LOGIN
      // ==========================================

      if (formState === 0) {

        const response = await fetch(
          "http://localhost:8081/login",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              username: username,
              password: password,
            }),
          }
        );


        const data = await response.json();

        console.log("LOGIN RESPONSE:", data);


        if (!response.ok) {

          setError(
            data.message || "Invalid username or password"
          );

          return;
        }


        // =========================
        // SAVE LOGIN DATA
        // =========================

        localStorage.setItem(
          "token",
          data.token
        );

        localStorage.setItem(
          "username",
          data.username || username
        );

        localStorage.setItem(
          "role",
          data.role
        );


        // =========================
        // ROLE BASED REDIRECT
        // =========================

        redirectByRole(data.role);
      }



      // ==========================================
      // REGISTER
      // ==========================================

      if (formState === 1) {

        const response = await fetch(
          "http://localhost:8081/register",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              username: username,
              password: password,
              role: role,
            }),
          }
        );


        const data = await response.json();

        console.log("REGISTER RESPONSE:", data);


        if (!response.ok) {

          setError(
            data.message || "Registration failed"
          );

          return;
        }


        // ==========================================
        // AUTO LOGIN AFTER REGISTRATION
        // ==========================================

        localStorage.setItem(
          "token",
          data.token
        );

        localStorage.setItem(
          "username",
          data.user.username
        );

        localStorage.setItem(
          "role",
          data.user.role
        );


        setMessage(
          "Registration successful! Redirecting..."
        );


        // ==========================================
        // DIRECT DASHBOARD
        // ==========================================

        setTimeout(() => {

          redirectByRole(
            data.user.role
          );

        }, 500);

      }


    } catch (err) {

      console.error(
        "Authentication Error:",
        err
      );

      setError(
        "Unable to connect to server"
      );

    } finally {

      setLoading(false);

    }

  };


  return (

    <div className="auth-page">

      <div className="auth-bg"></div>


      <div className="auth-container">


        {/* =================================
            LEFT SIDE
        ================================= */}

        <div className="auth-left">

          <div className="auth-logo">
            V
          </div>


          <h1>
            VEEYOM
          </h1>


          <p className="auth-tagline">
            Smarter Alerts. Safer Communities.
          </p>


          <p className="auth-description">

            AI-powered severe weather nowcasting and
            hyper-local early warning system designed
            to help communities prepare before disaster strikes.

          </p>


          <div className="auth-features">


            <div className="feature-item">

              <span>
                ✓
              </span>

              <p>
                Real-time weather monitoring
              </p>

            </div>


            <div className="feature-item">

              <span>
                ✓
              </span>

              <p>
                AI-powered risk prediction
              </p>

            </div>


            <div className="feature-item">

              <span>
                ✓
              </span>

              <p>
                Hyper-local early warnings
              </p>

            </div>


            <div className="feature-item">

              <span>
                ✓
              </span>

              <p>
                Emergency alert management
              </p>

            </div>


          </div>

        </div>



        {/* =================================
            RIGHT SIDE
        ================================= */}

        <div className="auth-right">

          <div className="auth-card">


            {/* HEADER */}

            <div className="auth-header">

              <span className="auth-eyebrow">
                VEEYOM ADMIN
              </span>


              <h2>

                {formState === 0
                  ? "Welcome Back"
                  : "Create Account"}

              </h2>


              <p>

                {formState === 0
                  ? "Sign in to access the administration panel"
                  : "Create your VEEYOM account"}

              </p>

            </div>



            {/* =================================
                SIGN IN / SIGN UP TOGGLE
            ================================= */}

            <div className="auth-toggle">


              <button
                type="button"

                className={
                  formState === 0
                    ? "active"
                    : ""
                }

                onClick={() => {

                  setFormState(0);

                  setError("");

                  setMessage("");

                }}
              >
                Sign In
              </button>



              <button
                type="button"

                className={
                  formState === 1
                    ? "active"
                    : ""
                }

                onClick={() => {

                  setFormState(1);

                  setError("");

                  setMessage("");

                }}
              >
                Sign Up
              </button>


            </div>



            {/* ERROR */}

            {error && (

              <div className="auth-error">

                ⚠ {error}

              </div>

            )}



            {/* SUCCESS */}

            {message && (

              <div className="auth-success">

                ✓ {message}

              </div>

            )}



            {/* =================================
                FORM
            ================================= */}

            <form onSubmit={handleAuth}>


              {/* USERNAME */}

              <div className="auth-input-group">

                <label>
                  Username
                </label>


                <div className="auth-input-wrapper">

                  <span>
                    👤
                  </span>


                  <input

                    type="text"

                    placeholder="Enter your username"

                    value={username}

                    onChange={(e) =>
                      setUsername(e.target.value)
                    }

                    autoComplete="username"

                  />

                </div>

              </div>



              {/* PASSWORD */}

              <div className="auth-input-group">

                <label>
                  Password
                </label>


                <div className="auth-input-wrapper">

                  <span>
                    🔒
                  </span>


                  <input

                    type="password"

                    placeholder="Enter your password"

                    value={password}

                    onChange={(e) =>
                      setPassword(e.target.value)
                    }

                    autoComplete={
                      formState === 0
                        ? "current-password"
                        : "new-password"
                    }

                  />

                </div>

              </div>



              {/* =================================
                  ROLE - ONLY SIGN UP
              ================================= */}

              {formState === 1 && (

                <div className="auth-input-group">

                  <label>
                    Select Role
                  </label>


                  <div className="auth-input-wrapper">

                    <span>
                      🛡️
                    </span>


                    <select

                      value={role}

                      onChange={(e) =>
                        setRole(e.target.value)
                      }

                    >

                      <option value="user">
                        User
                      </option>


                      <option value="admin">
                        Admin
                      </option>


                      <option value="rescue">
                        Rescue Team
                      </option>

                    </select>


                  </div>

                </div>

              )}



              {/* =================================
                  LOGIN OPTIONS
              ================================= */}

              {formState === 0 && (

                <div className="auth-options">


                  <label>

                    <input type="checkbox" />

                    Remember me

                  </label>



                  <button

                    type="button"

                    onClick={() =>
                      navigate("/forgot-password")
                    }

                  >
                    Forgot Password?
                  </button>


                </div>

              )}



              {/* SUBMIT */}

              <button

                type="submit"

                className="auth-submit"

                disabled={loading}

              >

                {loading

                  ? "Please wait..."

                  : formState === 0

                  ? "Sign In →"

                  : "Create Account →"

                }

              </button>


            </form>



            {/* SWITCH */}

            <div className="auth-switch">


              {formState === 0 ? (

                <>

                  Don't have an account?


                  <button

                    type="button"

                    onClick={() => {

                      setFormState(1);

                      setError("");

                      setMessage("");

                    }}

                  >
                    Create Account
                  </button>

                </>

              ) : (

                <>

                  Already have an account?


                  <button

                    type="button"

                    onClick={() => {

                      setFormState(0);

                      setError("");

                      setMessage("");

                    }}

                  >
                    Sign In
                  </button>

                </>

              )}


            </div>



            {/* FOOTER */}

            <div className="auth-footer">

              <span></span>

              VEEYOM monitoring system online

            </div>


          </div>

        </div>

      </div>

    </div>

  );

};

export default Authentication;
