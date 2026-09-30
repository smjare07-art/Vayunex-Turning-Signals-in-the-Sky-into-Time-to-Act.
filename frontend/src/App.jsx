import { useState } from 'react';
import heroImg from './assets/hero.png';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import Home from './pages/Home';
import Login from './pages/Login';
import About from './pages/About';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from "./pages/Dashboard.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Authentication from "./components/Authentication.jsx"
import './App.css'

function App() {
  

  return (
    <>
       <BrowserRouter>
      <div className="veeyom-app">
        <Routes>

          {/* Login */}
           <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<Authentication/>} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Home />} />

          {/* Admin Route */}
          <Route path="/admin" element={<Dashboard />} />

          {/* About */}
          <Route path="/about" element={<About />} />

          {/* Wrong URL → Login */}
        

        </Routes>
      </div>
    </BrowserRouter>
    </>
  )
}

export default App
