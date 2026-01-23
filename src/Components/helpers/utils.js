// ##############################################
// ##    HELPER FUNCTIONS FOR DISTANCE CALCULATION ##
// ##############################################

export const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ##############################################
// ##     BLINKING TAB HELPER FUNCTIONS        ##
// ##############################################
let blinkInterval = null;
let originalTitle = document.title;
export const NEXT_UP_TITLE = "!! YOU'RE UP NEXT !!"; 
export const TURN_TITLE = "!! IT'S YOUR TURN !!";

export const startBlinking = (newTitle) => { // <-- NOW ACCEPTS A TITLE
    if (blinkInterval) return;
    originalTitle = document.title;
    let isOriginalTitle = true;
    blinkInterval = setInterval(() => {
        document.title = isOriginalTitle ? newTitle : originalTitle; // <-- Uses newTitle
        isOriginalTitle = !isOriginalTitle;
    }, 1000);
}
export const stopBlinking = () => {
    if (!blinkInterval) return;
    clearInterval(blinkInterval);
    blinkInterval = null;
    document.title = originalTitle;
}
export const isIOsDevice = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+') 
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Helper function to play a sound, with error handling
 * for browser autoplay policies.
 */
export const playSound = (audioElement) => {
    if (!audioElement) return;
    audioElement.currentTime = 0;
    audioElement.play().catch(error => {
        console.warn("Sound notification was blocked by the browser:", error.message);
    });
};
export const stopSound = (audioElement) => {
    if (!audioElement) return;
    audioElement.pause();
    audioElement.currentTime = 0;
};

export const getTomorrowDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Move to tomorrow
    return date.toISOString().split('T')[0];
};