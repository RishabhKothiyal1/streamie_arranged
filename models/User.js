// models/User.js
const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    title: { type: String, required: true },
    poster_path: String,
    backdrop_path: String,
    vote_average: Number,
    release_date: String,
    overview: String,
    media_type: String,
    // Add other movie details you want to save
});

const activitySchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., 'view', 'play', 'search'
    itemId: Number, // ID of the movie/show
    itemTitle: String, // Title of the movie/show
    timestamp: { type: Date, default: Date.now },
    // Add other relevant activity data
});

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true }, // Google user ID
    displayName: String,
    email: String,
    photos: [{ value: String }], // Array of photo URLs
    savedMovies: [movieSchema], // Array of movies saved by the user
    activityLog: [activitySchema] // Array of user activities
});

module.exports = mongoose.model('User', userSchema);