// Global variables
let map;
let markers = [];
let locations = [];

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Leaflet to load before initializing
    if (typeof L !== 'undefined') {
        initializeMap();
        loadLocations();
        setupEventListeners();
    } else {
        // Wait for Leaflet script to load
        const checkLeaflet = setInterval(() => {
            if (typeof L !== 'undefined') {
                clearInterval(checkLeaflet);
                initializeMap();
                loadLocations();
                setupEventListeners();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            if (typeof L === 'undefined') {
                console.error('Leaflet failed to load after 10 seconds');
                showErrorMessage('Map library failed to load. Please refresh the page.');
            }
        }, 10000);
    }
});

// Initialize Leaflet map
function initializeMap() {
    try {
        console.log('Initializing map...');
        
        // Check if map container exists
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }
        
        // Create map centered on California
        map = L.map('map').setView([36.7783, -119.4179], 6);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);
        
        // Custom map styling
        map.getContainer().style.background = '#f8f9fa';
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        showErrorMessage('Failed to initialize map. Please refresh the page.');
    }
}

// Load locations from JSON file
async function loadLocations() {
    try {
        const response = await fetch('locations.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        locations = await response.json();
        
        // Add markers to map
        addMarkersToMap();
        
        // Populate locations grid
        populateLocationsGrid();
        
        // Update location counter
        updateLocationCounter();
        
    } catch (error) {
        console.error('Error loading locations:', error);
        showErrorMessage('Failed to load locations. Please try again later.');
    }
}

// Add markers to map for all locations
function addMarkersToMap() {
    if (!map) {
        console.error('Map not initialized, cannot add markers');
        return;
    }
    
    // Clear existing markers
    markers.forEach(markerData => {
        map.removeLayer(markerData.marker);
    });
    markers = [];
    
    locations.forEach((location, index) => {
        
        // Create custom icon
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-pin">
                    <div class="marker-icon">📍</div>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });
        
        // Create marker
        const marker = L.marker([location.coordinates.lat, location.coordinates.lng], {
            icon: customIcon
        }).addTo(map);
        
        // Add popup
        const popupContent = `
            <div class="map-popup">
                <h4>${location.name}</h4>
                <p><strong>${location.city}, ${location.country}</strong></p>
                <p class="popup-status">${location.status} - ${location.expectedLaunch}</p>
                <button onclick="openLocationModal(${location.id})" class="popup-btn">View Details</button>
            </div>
        `;
        
        marker.bindPopup(popupContent, {
            maxWidth: 250,
            className: 'custom-popup'
        });
        
        // Store marker reference
        markers.push({ marker, location });
        
        // Add click event to open modal
        marker.on('click', () => {
            setTimeout(() => openLocationModal(location.id), 100);
        });
    });
    
    // Add custom CSS for markers
    addMarkerStyles();
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers.map(m => m.marker));
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Add custom styles for markers
function addMarkerStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .custom-marker {
            background: transparent;
            border: none;
        }
        
        .marker-pin {
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--accent-color);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        }
        
        .marker-pin:hover {
            transform: rotate(-45deg) scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        
        .marker-icon {
            transform: rotate(45deg);
            font-size: 16px;
            color: white;
        }
        
        .custom-popup .leaflet-popup-content {
            margin: 12px;
        }
        
        .map-popup h4 {
            margin: 0 0 8px 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-dark);
        }
        
        .map-popup p {
            margin: 4px 0;
            font-size: 0.9rem;
            color: var(--text-light);
        }
        
        .popup-status {
            color: var(--accent-color) !important;
            font-weight: 500;
        }
        
        .popup-btn {
            background: var(--accent-color);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            margin-top: 8px;
            transition: all 0.3s ease;
        }
        
        .popup-btn:hover {
            background: #0051d5;
            transform: translateY(-1px);
        }
    `;
    document.head.appendChild(style);
}

// Populate locations grid
function populateLocationsGrid() {
    const grid = document.getElementById('locations-grid');
    grid.innerHTML = '';
    
    locations.forEach(location => {
        const card = createLocationCard(location);
        grid.appendChild(card);
    });
}

// Create location card element
function createLocationCard(location) {
    const card = document.createElement('div');
    card.className = 'location-card';
    card.onclick = () => openLocationModal(location.id);
    
    const amenitiesHtml = location.amenities.map(amenity => 
        `<span class="amenity-tag">${amenity}</span>`
    ).join('');
    
    card.innerHTML = `
        <h3>${location.name}</h3>
        <div class="location-address">${location.address}</div>
        <div class="location-status">${location.status}</div>
        <div class="location-launch">Expected Launch: ${location.expectedLaunch}</div>
        <div class="location-amenities">${amenitiesHtml}</div>
    `;
    
    return card;
}

// Update location counter
function updateLocationCounter() {
    const counter = document.getElementById('location-count');
    counter.textContent = locations.length;
}

// Setup event listeners
function setupEventListeners() {
    // Reset view button
    document.getElementById('reset-view').addEventListener('click', resetMapView);
    
    // Modal close events
    const modal = document.getElementById('location-modal');
    const closeBtn = document.querySelector('.close-modal');
    
    closeBtn.addEventListener('click', closeLocationModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeLocationModal();
        }
    });
    
    // Modal action buttons removed
    
    // Escape key to close modal
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeLocationModal();
        }
    });
}

// Reset map view to show all locations
function resetMapView() {
    if (markers.length > 0) {
        const group = new L.featureGroup(markers.map(m => m.marker));
        map.fitBounds(group.getBounds().pad(0.1));
    } else {
        map.setView([20, 0], 2);
    }
}

// Open location modal
function openLocationModal(locationId) {
    const location = locations.find(l => l.id === locationId);
    if (!location) return;
    
    // Populate modal content
    document.getElementById('modal-title').textContent = location.name;
    document.getElementById('modal-address').textContent = location.address;
    document.getElementById('modal-status').textContent = location.status;
    document.getElementById('modal-launch').textContent = location.expectedLaunch;
    document.getElementById('modal-description').textContent = location.description;
    
    // Populate amenities
    const amenitiesList = document.getElementById('modal-amenities');
    amenitiesList.innerHTML = location.amenities.map(amenity => 
        `<span class="amenity-tag">${amenity}</span>`
    ).join('');
    
    // Store current location for actions
    window.currentLocation = location;
    
    // Show modal
    document.getElementById('location-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Close location modal
function closeLocationModal() {
    document.getElementById('location-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    window.currentLocation = null;
}



// Show error message
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.parentElement.remove()">Close</button>
        </div>
    `;
    
    // Add error styles
    errorDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
    `;
    
    const errorContent = errorDiv.querySelector('.error-content');
    errorContent.style.cssText = `
        background: white;
        padding: 32px;
        border-radius: 16px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(errorDiv);
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Show error message
function showErrorMessage(message) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <p class="error-message">${message}</p>
                <button onclick="location.reload()" class="retry-btn">Retry</button>
            </div>
        `;
        
        // Add error styles
        const style = document.createElement('style');
        style.textContent = `
            .error-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: var(--text-light);
                text-align: center;
                padding: 40px;
            }
            
            .error-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .error-message {
                font-size: 1.1rem;
                margin-bottom: 24px;
                color: var(--text-dark);
            }
            
            .retry-btn {
                background: var(--accent-color);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .retry-btn:hover {
                background: #0051d5;
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }
}

// Add loading animation
function showLoadingAnimation() {
    const mapContainer = document.getElementById('map');
    mapContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading locations...</p>
        </div>
    `;
    
    // Add loading styles
    const style = document.createElement('style');
    style.textContent = `
        .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-light);
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--bg-light);
            border-top: 3px solid var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}