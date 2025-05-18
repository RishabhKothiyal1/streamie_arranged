/**
 * Streamie Movie App JavaScript - Improved Version
 *
 * This file contains all the JavaScript functionality for the Streamie movie streaming application.
 * Key features include:
 * - Movie data fetching from TMDB API
 * - UI management and modal controls
 * - Recently watched tracking
 * - Movie recommendations
 * - Search functionality
 * - Filtering and browsing options
 * - Error handling
 */

// --- Constants and Globals ---
const API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Will be replaced with server-side API calls
let page = 1;
let isLoading = false;
let currentFilters = { sort_by: 'popularity.desc' };
let currentType = 'movie';
let heroBackgrounds = [];
let currentHeroIndex = 0;
let searchTimeout;
let heroInterval; // To store the interval ID
let recentlyWatched = JSON.parse(localStorage.getItem('recentlyWatched')) || [];
const MAX_RECENT_ITEMS = 10; // Maximum number of recently watched items to store
let retryCount = 0;
const MAX_RETRIES = 3;

// --- MongoDB User Movie Functions ---
document.addEventListener('DOMContentLoaded', () => {
  const movieList = document.getElementById('movie-list');
  const movieTitleInput = document.getElementById('movie-title');
  const addMovieBtn = document.getElementById('add-movie-btn');

  // Function to fetch and display movies (This is likely for a dedicated user movie list,
  // not the main browsing view handled by fetchItems)
  async function fetchAndDisplayMovies() {
    // Check authentication before fetching user-specific data
    const authCheckResponse = await fetch('/check-auth');
    const authData = await authCheckResponse.json();

    if (!authData.isAuthenticated) {
        console.log("User not authenticated. Cannot fetch user's movie list.");
        if (movieList) movieList.innerHTML = '<li>Please log in to see your saved movies.</li>';
        return;
    }


    try {
      const response = await fetch('/api/movies');
      const data = await response.json();

      if (response.ok) {
        if (movieList) { // Check if movieList element exists
            movieList.innerHTML = ''; // Clear current list
            if (data.movies && data.movies.length > 0) {
              data.movies.forEach(movie => {
                const li = document.createElement('li');
                li.textContent = movie.title; // Display movie title
                // Add more movie details here if you save them
                movieList.appendChild(li);
              });
            } else {
              const li = document.createElement('li');
              li.textContent = 'No movies saved yet.';
              movieList.appendChild(li);
            }
        }
      } else {
        console.error('Error fetching movies:', data.error);
        // Display an error message to the user
         if (movieList) {
             const li = document.createElement('li');
             li.textContent = 'Error loading movies.';
             movieList.appendChild(li);
         }
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
      // Display an error message to the user
       if (movieList) {
           const li = document.createElement('li');
           li.textContent = 'Error loading movies.';
           movieList.appendChild(li);
       }
    }
  }

  // Function to add a new movie (This function is for the manual input,
  // the automatic saving is handled in addToRecentlyWatched)
  // This function might be on a different page or a specific UI element
  // If you want to keep this manual add functionality on the main page,
  // ensure you have the #movie-list, #movie-title, and #add-movie-btn elements.
  if (addMovieBtn) { // Only add listener if the button exists
      addMovieBtn.addEventListener('click', addMovie);
  }

  // Fetch and display movies when the page loads, IF the user is authenticated
  // This call is now handled within checkAuthenticationAndRenderUI or after it confirms auth
  // fetchAndDisplayMovies();


  async function addMovie() {
    const title = movieTitleInput.value.trim();

    if (!title) {
      alert('Please enter a movie title.');
      return;
    }

    // Check authentication before adding
    const authCheckResponse = await fetch('/check-auth');
    const authData = await authCheckResponse.json();

    if (!authData.isAuthenticated) {
        alert('Please log in to save movies.');
        return;
    }


    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Movie added:', data.message);
        movieTitleInput.value = ''; // Clear input field
        fetchAndDisplayMovies(); // Refresh the movie list
      } else {
        console.error('Error adding movie:', data.error);
        alert('Failed to add movie.');
      }
    } catch (error) {
      console.error('Error adding movie:', error);
      alert('Failed to add movie.');
    }
  }
});


// --- DOM Elements ---
const movieContainer = document.getElementById('movieContainer');
const loader = document.querySelector('.loader');
const movieModal = document.getElementById('movieModal');
const movieModalContent = movieModal.querySelector('.modal-content');
const movieModalDetails = movieModal.querySelector('.modal-details');
const movieCloseBtn = movieModal.querySelector('.close');
const playBtn = movieModal.querySelector('.play-button');
const videoContainer = movieModal.querySelector('.video-container');
const videoIframe = videoContainer.querySelector('iframe');
const signUpModal = document.querySelector('.signup-modal');
const signUpCloseBtn = signUpModal.querySelector('.close');
const restrictionModal = document.getElementById('restrictionModal');
const restrictionCloseBtn = restrictionModal.querySelector('.close');
const restrictionAckBtn = document.getElementById('restrictionAckBtn');

const genreFilter = document.getElementById('genreFilter');
const yearFilter = document.getElementById('yearFilter');
const languageFilter = document.getElementById('languageFilter');
const sortFilter = document.getElementById('sortFilter');
const sortOrderFilter = document.getElementById('sortOrderFilter');
const browseOptions = document.querySelectorAll('.browse-option');
const hero = document.querySelector('.hero');
const searchInput = document.querySelector('.search-input');
const searchResults = document.querySelector('.search-results');
const signUpBtn = document.querySelector('.signup-btn');
const loginBtn = document.getElementById('loginBtn'); // Get the login button
const loginModal = document.getElementById('loginModal'); // Get the login modal

// Recently watched elements
const recentlyWatchedSection = document.getElementById('recentlyWatched');
const recentlyWatchedRow = document.getElementById('recentlyWatchedRow');
const clearHistoryBtn = document.querySelector('.clear-history');
const recommendationsSection = document.getElementById('recommendationsSection');
const recommendationsRow = document.getElementById('recommendationsRow');

// --- Error Handling Functions ---
function showErrorMessage(message, duration = 3000) {
    // Create error message element if it doesn't exist
    let errorDiv = document.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        document.body.appendChild(errorDiv);
    }

    // Set message and show
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Auto-hide after duration
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, duration);
}

// --- API Request Handler with Retry Logic ---
async function makeApiRequest(url, params, errorMessage = 'Error fetching data') {
    let currentRetry = 0;

    while (currentRetry < MAX_RETRIES) {
        try {
            const response = await axios.get(url, { params });
            return response.data;
        } catch (error) {
            currentRetry++;
            console.error(`${errorMessage} (Attempt ${currentRetry}/${MAX_RETRIES}):`, error);

            if (currentRetry >= MAX_RETRIES) {
                showErrorMessage(`${errorMessage}. Please try again later.`);
                throw error;
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
        }
    }
}

// --- Authentication Check and UI Rendering ---
async function checkAuthenticationAndRenderUI() {
    try {
        const response = await fetch('/check-auth');
        const data = await response.json();

        const authButtons = document.querySelector('.auth-buttons');
        const userProfile = document.getElementById('userProfile');
        const heroSection = document.querySelector('.hero');
        const recentlyWatchedSection = document.getElementById('recentlyWatched');
        const recommendationsSection = document.getElementById('recommendationsSection');
        const movieContainer = document.getElementById('movieContainer');
        const loginModal = document.getElementById('loginModal');

        if (data.isAuthenticated) {
            // User is logged in, show dashboard elements and hide login elements
            if (authButtons) authButtons.style.display = 'none';
            if (userProfile) userProfile.style.display = 'block';
            // Assuming hero, recently watched, recommendations, and movie container are part of the dashboard
            if (heroSection) heroSection.style.display = 'block'; // Or your desired display style
            // recentlyWatchedSection and recommendationsSection are already hidden by default, script.js will show them if there's content
            if (movieContainer) movieContainer.style.display = 'block'; // Or your desired display style

            // Hide the login modal if it's open
            if (loginModal) loginModal.style.display = 'none';

            // Populate user profile info if available in the auth check response
            if (data.user) {
                const userName = document.getElementById('userName');
                const userEmail = document.getElementById('userEmail');
                const userAvatar = document.getElementById('userAvatar');

                if (userName) userName.textContent = data.user.displayName || 'User Name';
                if (userEmail) userEmail.textContent = data.user.email || 'user@example.com';
                // Assuming data.user.photos[0].value contains the avatar URL
                if (userAvatar && data.user.photos && data.user.photos[0]) {
                     userAvatar.src = data.user.photos[0].value;
                 }
            }

            // Now that the user is authenticated, fetch and display their movies (if this is where you display user's saved movies)
            // fetchAndDisplayMovies(); // Uncomment if you want to display user's saved movies on the main page

        } else {
            // User is not logged in, show login elements and hide dashboard elements
            if (authButtons) authButtons.style.display = 'flex'; // Or your desired display style for auth buttons
            if (userProfile) userProfile.style.display = 'none';
            // Assuming hero, recently watched, recommendations, and movie container are part of the dashboard
            // You might want to show a different hero section or message for logged out users
             if (heroSection) heroSection.style.display = 'block'; // Or your desired display style
            if (recentlyWatchedSection) recentlyWatchedSection.style.display = 'none';
            if (recommendationsSection) recommendationsSection.style.display = 'none';
            if (movieContainer) movieContainer.style.display = 'none'; // Hide the main movie container

             // Optionally show the login modal or a login prompt
             // if (loginModal) loginModal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        // In case of an error, you might want to show an error message
        // or default to showing the login view.
        const authButtons = document.querySelector('.auth-buttons');
        const userProfile = document.getElementById('userProfile');
        const heroSection = document.querySelector('.hero');
        const recentlyWatchedSection = document.getElementById('recentlyWatched');
        const recommendationsSection = document.getElementById('recommendationsSection');
        const movieContainer = document.getElementById('movieContainer');

        if (authButtons) authButtons.style.display = 'flex'; // Or your desired display style
        if (userProfile) userProfile.style.display = 'none';
         if (heroSection) heroSection.style.display = 'block'; // Or your desired display style
        if (recentlyWatchedSection) recentlyWatchedSection.style.display = 'none';
        if (recommendationsSection) recommendationsSection.style.display = 'none';
        if (movieContainer) movieContainer.style.display = 'none'; // Hide the main movie container

        showErrorMessage('Could not verify login status. Please try again.');
    }
}

// --- UI Functions ---

function showLoader() { loader.style.display = 'block'; }
function hideLoader() { loader.style.display = 'none'; }

function preventScroll() { document.body.classList.add('modal-open'); }
function allowScroll() { document.body.classList.remove('modal-open'); }

function createMovieCard(item) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    const posterUrl = item.poster_path
         ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
         : 'https://via.placeholder.com/200x300.png?text=No+Image';
    const rating = (item.vote_average && typeof item.vote_average === 'number')
        ? item.vote_average.toFixed(1) : 'N/A';
    card.innerHTML = `
        <div class="movie-poster" style="background-image: url(${posterUrl})"></div>
        <div class="movie-info">
          <div class="movie-title">${item.title || item.name}</div>
          <div class="movie-rating">⭐ ${rating}</div>
        </div>`;
    card.addEventListener('click', () => showMovieDetails(item));
    return card;
}

function showMovieDetails(item) {
     const backdropUrl = item.backdrop_path
         ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
         : (item.poster_path ? `https://image.tmdb.org/t/p/original${item.poster_path}` : '');
     movieModalContent.style.backgroundImage = backdropUrl ? `url(${backdropUrl})` : 'none';
     movieModalContent.style.backgroundColor = backdropUrl ? 'transparent' : '#111';

    movieModal.querySelector('.modal-title').textContent = item.title || item.name;
    movieModal.querySelector('.modal-overview').textContent = item.overview || 'No overview available.';
     const rating = (item.vote_average && typeof item.vote_average === 'number') ? item.vote_average.toFixed(1) : 'N/A';
     const releaseDate = item.release_date || item.first_air_date || 'N/A';
     let infoHtml = '';
     if (rating !== 'N/A') infoHtml += `<span>⭐ ${rating}</span>`;
     if (releaseDate !== 'N/A') infoHtml += `<span>${releaseDate.substring(0, 4)}</span>`;
    movieModal.querySelector('.modal-info').innerHTML = infoHtml;

    playBtn.onclick = () => playMovie(item);
    movieModal.style.display = 'block';
    preventScroll();
    videoContainer.style.display = 'none';
    movieModalDetails.style.display = 'block';

    // Add to recently watched when modal opens (This will now also save to DB if logged in)
    addToRecentlyWatched(item);
}

async function playMovie(item) {
    const id = item.id;

    // Check if user is logged in before allowing playback
    const authCheckResponse = await fetch('/check-auth');
    const authData = await authCheckResponse.json();

    if (!authData.isAuthenticated) {
        // Show login modal or a message prompting login
        closeMovieModal(); // Close the details modal first
        if (loginModal) {
             loginModal.style.display = 'block';
             preventScroll();
             // You might want to add a message to the login modal
             // like "Log in to watch content."
         } else {
             alert('Please log in to watch movies and TV shows.');
         }
        // Track restricted access attempt
        trackUserActivity('play_restricted', item.id, item.title || item.name);
        return; // Stop playback
    }

    videoIframe.src = `https://vidsrc.xyz/embed/${item.media_type || currentType}/${id}`;
    videoContainer.style.display = 'block';
    movieModalDetails.style.display = 'none';

    // Ensure this item is added to recently watched (This will also save to DB)
    addToRecentlyWatched(item);

    // Track play event if user is logged in (redundant with check above, but good practice)
    trackUserActivity('play', item.id, item.title || item.name);
}

function closeMovieModal() {
    movieModal.style.display = 'none';
    videoContainer.style.display = 'none';
    videoIframe.src = ''; // Stop video playback
    allowScroll();
    movieModalDetails.style.display = 'block';
}

// --- User Activity Tracking ---
function trackUserActivity(action, itemId, itemTitle) {
    // Check if user is logged in first
    fetch('/check-auth')
        .then(response => response.json())
        .then(data => {
            if (data.isAuthenticated) {
                // Send activity to server
                fetch('/track-activity', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action,
                        itemId,
                        itemTitle,
                        timestamp: new Date().toISOString()
                    })
                }).catch(err => console.error('Error tracking activity:', err));
            }
        })
        .catch(error => {
            console.error('Error checking auth for activity tracking:', error);
        });
}

// --- Recently Watched Functions ---
async function addToRecentlyWatched(item) {
    // Check if user is logged in before saving to DB
    const authCheckResponse = await fetch('/check-auth');
    const authData = await authCheckResponse.json();
    const isAuthenticated = authData.isAuthenticated;

    // Update localStorage regardless of login status
    const existingIndex = recentlyWatched.findIndex(i => i.id === item.id);
    if (existingIndex !== -1) {
        recentlyWatched.splice(existingIndex, 1);
    }

    recentlyWatched.unshift({
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        vote_average: item.vote_average,
        release_date: item.release_date || item.first_air_date,
        overview: item.overview,
        media_type: item.media_type || currentType
    });

    if (recentlyWatched.length > MAX_RECENT_ITEMS) {
        recentlyWatched = recentlyWatched.slice(0, MAX_RECENT_ITEMS);
    }

    localStorage.setItem('recentlyWatched', JSON.stringify(recentlyWatched));
    updateRecentlyWatchedUI();

    // Get recommendations based on recently watched (only if logged in, as recommendations might be personalized)
    if (isAuthenticated && recentlyWatched.length > 0) {
        getRecommendations(recentlyWatched[0].id, recentlyWatched[0].media_type);
    } else if (!isAuthenticated) {
         // Hide recommendations section if not logged in
         recommendationsSection.style.display = 'none';
    }


    // Track this item in user history if logged in
    if (isAuthenticated) {
        trackUserActivity('view', item.id, item.title || item.name);
    }


    // *** Add movie to user's list in MongoDB only if authenticated ***
    if (isAuthenticated) {
        fetch('/api/movies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: item.id, // Include ID for potential future use (e.g., uniqueness)
                title: item.title || item.name,
                poster_path: item.poster_path,
                // Add other movie details you want to save
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Movie added to user\'s database list:', data.message);
                // Optionally update the displayed list on the dashboard if needed
                // fetchAndDisplayMovies();
            } else {
                console.error('Error adding movie to user\'s database list:', data.error);
            }
        })
        .catch(error => {
            console.error('Error adding movie to user\'s database list:', error);
        });
    }
    // ***********************************************
}

function updateRecentlyWatchedUI() {
    // Clear current list
    recentlyWatchedRow.innerHTML = '';

    // If no recently watched items, hide section
    if (recentlyWatched.length === 0) {
        recentlyWatchedSection.style.display = 'none';
        return;
    }

    // Show section and populate with items
    recentlyWatchedSection.style.display = 'block';
    recentlyWatched.forEach(item => {
        recentlyWatchedRow.appendChild(createMovieCard(item));
    });
}

async function clearRecentlyWatched() {
    // Check authentication before clearing history on server
    const authCheckResponse = await fetch('/check-auth');
    const authData = await authCheckResponse.json();
    const isAuthenticated = authData.isAuthenticated;

    recentlyWatched = [];
    localStorage.removeItem('recentlyWatched');
    updateRecentlyWatchedUI();
    recommendationsSection.style.display = 'none'; // Hide recommendations after clearing history

    // Track clear history action if logged in
    if (isAuthenticated) {
        trackUserActivity('clear_history', null, null);
        // Optionally send a request to the server to clear history in the DB as well
        // fetch('/api/clear-history', { method: 'POST' }); // You would need to implement this endpoint
    }
}

async function getRecommendations(movieId, mediaType) {
     // Only fetch recommendations if the user is logged in
    const authCheckResponse = await fetch('/check-auth');
    const authData = await authCheckResponse.json();

    if (!authData.isAuthenticated) {
         recommendationsSection.style.display = 'none';
         return;
    }

    try {
        const data = await makeApiRequest(
            `https://api.themoviedb.org/3/${mediaType}/${movieId}/recommendations`,
            { api_key: API_KEY, language: 'en-US', page: 1 },
            'Error fetching recommendations'
        );

        const recommendations = data.results;
        updateRecommendationsUI(recommendations);
    } catch (error) {
        console.error('Error in recommendations:', error);
        recommendationsSection.style.display = 'none';
    }
}

function updateRecommendationsUI(recommendations) {
    // Clear current recommendations
    recommendationsRow.innerHTML = '';

    // If no recommendations, hide section
    if (!recommendations || recommendations.length === 0) {
        recommendationsSection.style.display = 'none';
        return;
    }

    // Show section and populate with recommendations
    recommendationsSection.style.display = 'block';
    recommendations.forEach(item => {
        recommendationsRow.appendChild(createMovieCard(item));
    });
}

// --- Restriction Modal Logic ---
function showRestrictionModal() {
    const alreadyShown = sessionStorage.getItem('restrictionPopupShown');
    if (!alreadyShown) {
        restrictionModal.style.display = 'block';
        preventScroll();
    }
}

function closeRestrictionModal() {
    restrictionModal.style.display = 'none';
    allowScroll();
    sessionStorage.setItem('restrictionPopupShown', 'true'); // Mark as shown for this session
}

// --- Data Fetching & Display ---
async function fetchItems() {
   // Decide whether to fetch public content or user's saved/recommended content
   const authCheckResponse = await fetch('/check-auth');
   const authData = await authCheckResponse.json();

   if (authData.isAuthenticated) {
       // User is logged in, you might want to fetch user-specific content here
       // e.g., fetchAndDisplayMovies(); // If this function fetches the user's saved list
       // For now, we'll still fetch popular/trending for the main view
       console.log("User is authenticated. Fetching popular/trending content.");
   } else {
       // User is not logged in, fetch public content (popular/trending)
       console.log("User is not authenticated. Fetching public content.");
   }


   if (isLoading) return;
   isLoading = true;
   showLoader();

    const params = {
        api_key: API_KEY,
        page: page,
        language: 'en-US',
        sort_by: currentFilters.sort_by || 'popularity.desc'
    };

    if (currentFilters.with_genres) params.with_genres = currentFilters.with_genres;
    if (currentFilters.year) params.primary_release_year = currentFilters.year;
    if (currentFilters.with_original_language) params.with_original_language = currentFilters.with_original_language;

    if (sortOrderFilter && !params.sort_by.endsWith('.asc') && !params.sort_by.endsWith('.desc')) {
         params.sort_by += `.${sortOrderFilter.value}`;
    } else if (!params.sort_by.endsWith('.asc') && !params.sort_by.endsWith('.desc')) {
         params.sort_by += '.desc'; // Default desc if order filter not present or value invalid
    }

   try {
     const data = await makeApiRequest(
        `https://api.themoviedb.org/3/discover/${currentType}`,
        params,
        'Error loading content'
     );

     const items = data.results;

     if (page === 1) {
        movieContainer.innerHTML = ''; // Clear only on first page
        heroBackgrounds = items.filter(item => item.backdrop_path).slice(0, 5).map(item => item.backdrop_path);
        startHeroRotation(); // Start or restart rotation
     }

      const rowId = `page-${page}`;
      let rowContainerDiv = movieContainer.querySelector(`.row-container[data-page=\"${page}\"]`);
      let row;

       if (!rowContainerDiv) {
           rowContainerDiv = document.createElement('div');
           rowContainerDiv.className = 'row-container';
           rowContainerDiv.dataset.page = page;

           row = document.createElement('div');
           row.className = 'row';
           rowContainerDiv.appendChild(row);
           movieContainer.appendChild(rowContainerDiv);
           createRowNavButtons(rowContainerDiv, row); // Create nav buttons after appending
       } else {
           row = rowContainerDiv.querySelector('.row'); // Find existing row
       }

       if (items.length > 0) {
           items.forEach(item => {
               if (item.poster_path) { row.appendChild(createMovieCard(item)); }
           });
            page++; // Increment page only if results were found
       } else {
            console.log("No more items to load.");
       }

   } catch (error) {
       console.error('Error fetching items:', error);
   } finally {
       isLoading = false;
       hideLoader();
   }
}

function startHeroRotation() {
    clearInterval(heroInterval); // Clear existing interval if any
    if (heroBackgrounds.length > 0) {
        updateHeroBackground(); // Show first image immediately
        heroInterval = setInterval(updateHeroBackground, 5000); // Rotate every 5 seconds
    } else {
         // Optional: Set a default background if no images found
         hero.style.backgroundImage = 'url(/api/placeholder/1200/400)';
     }
}

function updateHeroBackground() {
   if (heroBackgrounds.length === 0) return;
   hero.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${heroBackgrounds[currentHeroIndex]})`;
   currentHeroIndex = (currentHeroIndex + 1) % heroBackgrounds.length;
}

async function fetchGenres() {
  try {
    const data = await makeApiRequest(
        `https://api.themoviedb.org/3/genre/${currentType}/list`,
        { api_key: API_KEY },
        'Error loading genres'
    );

    const genres = data.genres;
    genreFilter.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre.id; option.textContent = genre.name;
      genreFilter.appendChild(option);
    });
  } catch (error) {
      console.error('Error fetching genres:', error);
  }
}

function populateYearFilter() {
  const currentYear = new Date().getFullYear();
  yearFilter.innerHTML = '<option value="">All Years</option>';
  for (let year = currentYear; year >= 1900; year--) {
    const option = document.createElement('option');
    option.value = year; option.textContent = year;
    yearFilter.appendChild(option);
  }
}

async function fetchLanguages() {
  try {
    const data = await makeApiRequest(
        'https://api.themoviedb.org/3/configuration/languages',
        { api_key: API_KEY },
        'Error loading languages'
    );

    const languages = data;
    languageFilter.innerHTML = '<option value="">All Languages</option>';
    languages.sort((a, b) => a.english_name.localeCompare(b.english_name));
    languages.forEach(lang => {
        if (lang.english_name) {
            const opt = document.createElement('option');
            opt.value = lang.iso_639_1;
            opt.textContent = lang.english_name;
            languageFilter.appendChild(opt);
        }
    });
  } catch (error) {
      console.error('Error fetching languages:', error);
  }
}

function handleFilterChange() {
  currentFilters = { // Rebuild filters object
      with_genres: genreFilter.value || undefined,
      year: yearFilter.value || undefined,
      with_original_language: languageFilter.value || undefined,
      sort_by: sortFilter.value // Base sort field
  };
   // Add sort order
   if (sortOrderFilter) {
        const order = sortOrderFilter.value;
        if (currentFilters.sort_by && !currentFilters.sort_by.includes('.')) {
            currentFilters.sort_by += `.${order}`;
        } else if (currentFilters.sort_by) { // Handle cases where base sort might already have order?
             currentFilters.sort_by = currentFilters.sort_by.split('.')[0] + `.${order}`;
        }
   }
    // Clean undefined keys
    Object.keys(currentFilters).forEach(key => currentFilters[key] === undefined && delete currentFilters[key]);

  page = 1; movieContainer.innerHTML = '';
  fetchItems();

  // Track filter change if user is logged in
  const filterDescription = `${genreFilter.options[genreFilter.selectedIndex].text}, ${yearFilter.value || 'All Years'}, ${sortFilter.options[sortFilter.selectedIndex].text}`;
  trackUserActivity('filter', null, filterDescription);
}

function handleScroll() {
   const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500;
   if (nearBottom && !isLoading) { fetchItems(); }
}

async function searchItems(query) {
   try {
     const data = await makeApiRequest(
        'https://api.themoviedb.org/3/search/multi',
        { api_key: API_KEY, query: query, page: 1 },
        'Error searching'
     );

     const results = data.results.filter(item => item.media_type !== 'person').slice(0, 7);
     displaySearchResults(results);

     // Track search query if user is logged in
     if (query.length > 2) {
        trackUserActivity('search', null, query);
     }
   } catch (error) {
       console.error('Error searching items:', error);
       searchResults.style.display = 'none';
   }
}

function displaySearchResults(results) {
   searchResults.innerHTML = '';
   if (results.length === 0) {
       searchResults.innerHTML = '<div class="no-results">No results found</div>';
       searchResults.style.display = 'block';
       return;
   }

   results.forEach(item => {
     const resultItem = document.createElement('div');
     resultItem.className = 'search-result-item';
     const imgUrl = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : 'https://via.placeholder.com/40x60.png?text=N/A';
     resultItem.innerHTML = `
       <img src="${imgUrl}" alt="${item.title || item.name}">
       <span>${item.title || item.name} (${(item.release_date || item.first_air_date || '').substring(0, 4)})</span>
     `;
     resultItem.addEventListener('click', () => {
       showMovieDetails(item);
       searchResults.style.display = 'none'; // Hide results after selection
       searchInput.value = ''; // Clear search input
     });
     searchResults.appendChild(resultItem);
   });
   searchResults.style.display = 'block'; //
  }
  
  // --- Row Navigation Buttons ---
  function createRowNavButtons(rowContainerDiv, row) {
      // Prevent adding buttons multiple times to the same row container
      if (rowContainerDiv.querySelector('.nav-button')) {
          return;
      }
  
      const prevBtn = document.createElement('button');
      prevBtn.className = 'nav-button prev-button';
      prevBtn.innerHTML = '&#10094;'; // Left arrow
      prevBtn.addEventListener('click', () => scrollRow(row, 'left'));
      rowContainerDiv.appendChild(prevBtn);
  
      const nextBtn = document.createElement('button');
      nextBtn.className = 'nav-button next-button';
      nextBtn.innerHTML = '&#10095;'; // Right arrow
      nextBtn.addEventListener('click', () => scrollRow(row, 'right'));
      rowContainerDiv.appendChild(nextBtn);
  }
  
  function scrollRow(row, direction) {
      const scrollAmount = row.clientWidth * 0.8; // Scroll 80% of the row width
      if (direction === 'left') {
          row.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
          row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
  }
  
  // --- Session Management ---
  async function refreshSession() {
      try {
          const response = await fetch('/refresh-session', { method: 'POST' });
          const data = await response.json();
          if (data.success) {
              console.log('Session refreshed.');
          } else {
              console.warn('Session refresh failed:', data.message);
              // Optionally, prompt user to log in again if refresh fails repeatedly
          }
      } catch (error) {
          console.error('Error refreshing session:', error);
      }
  }
  
  
  // --- Event Listeners ---
  
  // Close modals
  movieCloseBtn.addEventListener('click', closeMovieModal);
  signUpCloseBtn.addEventListener('click', () => signUpModal.style.display = 'none');
  restrictionCloseBtn.addEventListener('click', closeRestrictionModal);
  restrictionAckBtn.addEventListener('click', closeRestrictionModal);
  
  window.addEventListener('click', (event) => {
      if (event.target === movieModal) { closeMovieModal(); }
      if (event.target === signUpModal) { signUpModal.style.display = 'none'; }
      if (event.target === restrictionModal) { closeRestrictionModal(); }
       if (event.target === loginModal) { loginModal.style.style.display = 'none'; allowScroll(); } // Close login modal
  });
  
  // Login Button Click
  if (loginBtn) { // Check if loginBtn exists
      loginBtn.addEventListener('click', () => {
          if (loginModal) { // Check if loginModal exists
              loginModal.style.display = 'block';
              preventScroll();
          }
      });
  }
  
  
  // Filter change listeners
  genreFilter.addEventListener('change', handleFilterChange);
  yearFilter.addEventListener('change', handleFilterChange);
  languageFilter.addEventListener('change', handleFilterChange);
  sortFilter.addEventListener('change', handleFilterChange);
  if (sortOrderFilter) { // Add listener only if element exists
      sortOrderFilter.addEventListener('change', handleFilterChange);
  }
  
  
  // Browse option listeners (Movie/TV)
  browseOptions.forEach(option => {
      option.addEventListener('click', () => {
          browseOptions.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
          currentType = option.dataset.type;
          page = 1; movieContainer.innerHTML = '';
          fetchGenres(); // Fetch genres for the selected type
          fetchItems(); // Fetch items for the selected type
      });
  });
  
  // Infinite scroll
  window.addEventListener('scroll', handleScroll);
  
  // Search input listener with debounce
  searchInput.addEventListener('input', (event) => {
      clearTimeout(searchTimeout);
      const query = event.target.value.trim();
      if (query.length > 2) { // Only search if query is at least 3 characters
          searchTimeout = setTimeout(() => {
              searchItems(query);
          }, 300); // Debounce search by 300ms
      } else {
          searchResults.innerHTML = '';
          searchResults.style.display = 'none';
      }
  });
  
  // Close search results when clicking outside
  document.addEventListener('click', (event) => {
      if (!searchResults.contains(event.target) && event.target !== searchInput) {
          searchResults.style.display = 'none';
      }
  });
  
  // Recently watched clear history button
  if (clearHistoryBtn) { // Check if button exists
      clearHistoryBtn.addEventListener('click', clearRecentlyWatched);
  }
  
  
  // --- Initialization ---
  function init() {
      // Initialize the application based on authentication status
      checkAuthenticationAndRenderUI();
  
      document.querySelector(`.browse-option[data-type=\"all\"]`)?.classList.add('active'); // Default 'All' active
      fetchGenres();
      populateYearFilter();
      fetchLanguages();
      // fetchItems(); // We will call fetchItems after checking auth status if needed for public content
      updateRecentlyWatchedUI(); // Initialize recently watched section
  
      // If there are recently watched items, get recommendations for the most recent one
      if (recentlyWatched.length > 0) {
          getRecommendations(recentlyWatched[0].id, recentlyWatched[0].media_type);
      }
  
      showRestrictionModal(); // Check if restriction modal should be shown
  
      // Set up session refresh interval (every 10 minutes)
      setInterval(refreshSession, 600000);
  }
  
  // Initialize the application
  init();
  