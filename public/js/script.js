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

    // Add to recently watched when modal opens
    addToRecentlyWatched(item);
}

function playMovie(item) {
    const id = item.id;
    videoIframe.src = `https://vidsrc.xyz/embed/${currentType}/${id}`;
    videoContainer.style.display = 'block';
    movieModalDetails.style.display = 'none';
    
    // Ensure this item is added to recently watched
    addToRecentlyWatched(item);
    
    // Track play event if user is logged in
    trackUserActivity('play', item.id, item.title || item.name);
}

function closeMovieModal() {
    movieModal.style.display = 'none';
    videoContainer.style.display = 'none';
    videoIframe.src = '';
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
function addToRecentlyWatched(item) {
    // Check if item already exists in recently watched
    const existingIndex = recentlyWatched.findIndex(i => i.id === item.id);
    if (existingIndex !== -1) {
        // Move to front if already exists
        recentlyWatched.splice(existingIndex, 1);
    }
    
    // Add new item to front of array
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
    
    // Trim list if it exceeds maximum
    if (recentlyWatched.length > MAX_RECENT_ITEMS) {
        recentlyWatched = recentlyWatched.slice(0, MAX_RECENT_ITEMS);
    }
    
    // Save to localStorage
    localStorage.setItem('recentlyWatched', JSON.stringify(recentlyWatched));
    
    // Update UI
    updateRecentlyWatchedUI();
    
    // Get recommendations based on recently watched
    if (recentlyWatched.length > 0) {
        getRecommendations(recentlyWatched[0].id, recentlyWatched[0].media_type);
    }
    
    // Track this item in user history if logged in
    trackUserActivity('view', item.id, item.title || item.name);
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

function clearRecentlyWatched() {
    recentlyWatched = [];
    localStorage.removeItem('recentlyWatched');
    updateRecentlyWatchedUI();
    recommendationsSection.style.display = 'none';
    
    // Track clear history action if logged in
    trackUserActivity('clear_history', null, null);
}

async function getRecommendations(movieId, mediaType) {
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
      let rowContainerDiv = movieContainer.querySelector(`.row-container[data-page="${page}"]`);
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
       <div class="search-result-details">
         <div class="search-result-title">${item.title || item.name}</div>
         <div class="search-result-type">${item.media_type === 'tv' ? 'TV Show' : 'Movie'}</div>
       </div>`;
     resultItem.addEventListener('click', () => {
         showMovieDetails(item); // Needs item object
         searchResults.style.display = 'none'; 
         searchInput.value = '';
     });
     searchResults.appendChild(resultItem);
   });
   searchResults.style.display = 'block';
}

function createRowNavButtons(rowContainer, row) {
    const navContainer = document.createElement('div'); 
    navContainer.className = 'row-nav';
    const leftBtn = document.createElement('button'); 
    leftBtn.innerHTML = '❮'; 
    leftBtn.className = 'nav-btn left-btn';
    const rightBtn = document.createElement('button'); 
    rightBtn.innerHTML = '❯'; 
    rightBtn.className = 'nav-btn right-btn';
    navContainer.appendChild(leftBtn); 
    navContainer.appendChild(rightBtn);
    rowContainer.appendChild(navContainer); // Append to container
    leftBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        scrollRow(row, -1); 
    });
    rightBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        scrollRow(row, 1); 
    });
}

function scrollRow(row, direction) {
    const scrollAmount = direction * (row.clientWidth * 0.8);
    row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

// --- Session Refresh ---
function refreshSession() {
    // Ping server to keep session alive
    fetch('/ping-session')
        .catch(err => console.error('Error refreshing session:', err));
}

// --- Event Listeners ---
movieCloseBtn.onclick = closeMovieModal;

signUpBtn.addEventListener('click', () => {
  signUpModal.style.display = 'block';
  preventScroll();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
});

signUpCloseBtn.onclick = function() {
  signUpModal.style.display = 'none';
  allowScroll();
};

clearHistoryBtn.addEventListener('click', clearRecentlyWatched);

restrictionCloseBtn.onclick = closeRestrictionModal;
restrictionAckBtn.onclick = closeRestrictionModal;

// Filter event listeners
genreFilter.addEventListener('change', handleFilterChange);
yearFilter.addEventListener('change', handleFilterChange);
languageFilter.addEventListener('change', handleFilterChange);
sortFilter.addEventListener('change', handleFilterChange);
sortOrderFilter.addEventListener('change', handleFilterChange);

browseOptions.forEach(option => {
  option.addEventListener('click', () => {
    browseOptions.forEach(btn => btn.classList.remove('active'));
    option.classList.add('active');
    let newType = option.dataset.type === 'all' ? 'movie' : option.dataset.type;
     if (newType !== currentType) {
        currentType = newType; 
        page = 1; 
        movieContainer.innerHTML = '';
        fetchGenres(); 
        fetchItems();
        
        // Track content type change
        trackUserActivity('change_type', null, newType);
    }
  });
});

window.addEventListener('scroll', handleScroll);

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = searchInput.value.trim();
    if (query.length > 2) { 
        searchItems(query); 
    } else { 
        searchResults.style.display = 'none'; 
    }
  }, 300);
});

searchInput.addEventListener('focus', () => {
     if (searchInput.value.trim().length > 2 && searchResults.children.length > 0) {
         searchResults.style.display = 'block';
     }
});

// Global click handler (for closing modals)
window.onclick = function(event) {
  if (event.target == movieModal) { closeMovieModal(); }
  if (event.target == signUpModal) { signUpModal.style.display = 'none'; allowScroll(); }
  if (event.target == restrictionModal) { closeRestrictionModal(); } 

   const searchContainer = document.querySelector('.search-container');
   if (searchContainer && !searchContainer.contains(event.target)) {
     searchResults.style.display = 'none';
   }
};

// --- Initial Load ---
function init() {
    document.querySelector(`.browse-option[data-type="all"]`)?.classList.add('active'); // Default 'All' active
    fetchGenres();
    populateYearFilter();
    fetchLanguages();
    fetchItems(); // Fetch initial items
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