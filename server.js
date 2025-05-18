// server.js
require('dotenv').config();
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

const app = express();

// Serve static files from 'public' folder (your main site)
app.use(express.static(path.join(__dirname, 'public')));

// JSON body parser middleware
app.use(express.json());

// Session middleware
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Auth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard'));

// Dashboard (protected)
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
        <h1>Hello, ${req.user.displayName}</h1>
        <a href="/logout"><button>Logout</button></a>
      </body>
    </html>
  `);
});

// Check authentication status
app.get('/check-auth', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      isAuthenticated: true,
      user: req.user
    });
  } else {
    res.json({
      isAuthenticated: false
    });
  }
});

// Track user activity
app.post('/track-activity', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  // Log the activity (in a real app, you would store this in a database)
  console.log('User Activity:', {
    userId: req.user.id,
    userName: req.user.displayName,
    ...req.body
  });
  
  res.json({ success: true });
});

// Keep session alive
app.get('/ping-session', (req, res) => {
  res.json({ success: true });
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));