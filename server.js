// server.js
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const mongoose = require('mongoose'); // Use Mongoose
const { ServerApiVersion } = require('mongodb'); // Keep for ServerApiVersion config

const app = express();

// Require your Mongoose User model
const User = require('./models/User');

// MongoDB Connection with Mongoose
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})
.then(() => console.log('Connected to MongoDB with Mongoose'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if database connection fails
});

// Serve static files from 'public' folder (your main site)
app.use(express.static(path.join(__dirname, 'public')));

// JSON and URL-encoded body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET, // Use the secret from your .env file
  resave: false,
  saveUninitialized: false, // Set to false for compliance with GDPR and CCPA
  cookie: { secure: 'auto' } // 'auto' works with both HTTP and HTTPS
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            // User exists, update their info if needed
            user.displayName = profile.displayName;
            user.email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : user.email;
            user.photos = profile.photos;
            await user.save();
            console.log(`Existing user logged in: ${user.displayName}`);
            done(null, user);
        } else {
            // New user, create them
            user = new User({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                photos: profile.photos,
                savedMovies: [], // Initialize empty arrays
                activityLog: []
            });
            await user.save();
            console.log(`New user created: ${user.displayName}`);
            done(null, user);
        }
    } catch (err) {
        console.error('Error in Google Strategy:', err);
        done(err);
    }
}));

// Serialize user by ID for session
passport.serializeUser((user, done) => {
    done(null, user.id); // Use Mongoose document ID
});

// Deserialize user by ID (fetch from database)
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user); // user will be available as req.user
    } catch (err) {
        console.error('Error deserializing user:', err);
        done(err);
    }
});

// --- Authentication Routes ---

// Google OAuth login route
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback route
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, req.user is set by deserializeUser
    res.redirect('/'); // Redirect to the main page
  });

// Logout route
app.get('/logout', (req, res) => {
    req.logout((err) => { // Passport's logout method
        if (err) { return next(err); }
        res.redirect('/'); // Redirect to home page after logout
    });
});


// --- Middleware to check if user is authenticated ---
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  // If not authenticated, send a JSON response with isAuthenticated: false
  res.status(401).json({ isAuthenticated: false, error: 'User not authenticated' });
}


// --- API Routes (Protected by isAuthenticated middleware) ---

// Add a movie to the user\'s list
app.post('/api/movies', isAuthenticated, async (req, res) => {
    const movieDetails = req.body;

    // Basic validation (ensure required fields are present)
    if (!movieDetails || !movieDetails.id || !movieDetails.title) {
        return res.status(400).json({ success: false, error: 'Invalid movie data provided' });
    }

    try {
        const user = req.user; // User object from deserializeUser

        // Prevent duplicates: Check if a movie with the same ID already exists
        const movieExists = user.savedMovies.some(movie => movie.id === movieDetails.id);
        if (movieExists) {
             return res.json({ success: false, message: 'Movie already in list' });
        }

        // Add the movie details to the savedMovies array
        user.savedMovies.push(movieDetails);

        // Save the updated user document
        await user.save();

        res.json({ success: true, message: 'Movie added successfully' });
    } catch (err) {
        console.error('Error adding movie:', err);
        res.status(500).json({ success: false, error: 'Failed to add movie to list' });
    }
});

// Get the user\'s movie list
app.get('/api/movies', isAuthenticated, async (req, res) => {
    try {
        const user = req.user; // User object from deserializeUser

        // Return the savedMovies array. If user exists but has no movies, return empty array.
        res.json({ movies: user.savedMovies || [] });
    } catch (err) {
        console.error('Error retrieving movies:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve movies' });
    }
});

// Track user activity (save this to the database)
app.post('/track-activity', isAuthenticated, async (req, res) => {
    const activityData = req.body; // Activity data from frontend

    // Basic validation
     if (!activityData || !activityData.action) {
         return res.status(400).json({ success: false, error: 'Invalid activity data provided' });
     }


    try {
        const user = req.user; // User object from deserializeUser

        // Add the activity data to the activityLog array
        user.activityLog.push(activityData);

        // Save the updated user document
        await user.save();

        console.log(`Activity tracked for user ${user.displayName}: ${activityData.action}`);
        res.json({ success: true, message: 'Activity tracked successfully' });

    } catch (err) {
        console.error('Error tracking activity:', err);
        res.status(500).json({ success: false, error: 'Failed to track activity' });
    }
});

// Check authentication status (Used by the frontend script)
app.get('/check-auth', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      isAuthenticated: true,
      user: { // Send a simplified user object for frontend
           id: req.user.id,
           displayName: req.user.displayName,
           email: req.user.email,
           photos: req.user.photos
           // Add other user properties needed on frontend
       }
    });
  } else {
    res.json({
      isAuthenticated: false
    });
  }
});

// Keep session alive (Used by the frontend script)
app.post('/refresh-session', (req, res) => {
  if (req.session) {
    console.log('Attempting to refresh session...');
    // With express-session, simply accessing the session might extend its life
    // if you have rolling sessions configured.
    res.json({ success: true, message: 'Session refresh attempt.' });
  } else {
    res.status(401).json({ success: false, message: 'No active session to refresh.' });
  }
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
