/**
 * Device Fingerprint Utility
 * Generates a unique identifier for the user's device based on browser info
 */

export const getDeviceFingerprint = () => {
    // Create a fingerprint based on available browser properties
    const screenInfo = typeof window !== 'undefined' && window.screen ? {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth
    } : { width: 0, height: 0, colorDepth: 0 };
    
    const fingerprintData = [
        navigator.userAgent,
        navigator.language,
        screenInfo.width,
        screenInfo.height,
        screenInfo.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || '',
        navigator.deviceMemory || '',
        // Add platform info
        navigator.platform,
        // Canvas fingerprint (simplified)
        (function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = "top";
                ctx.font = "14px 'Arial'";
                ctx.textBaseline = "alphabetic";
                ctx.fillStyle = "#f60";
                ctx.fillRect(125,1,62,20);
                ctx.fillStyle = "#069";
                ctx.fillText("Dash-Q", 2, 15);
                ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
                ctx.fillText("Dash-Q", 4, 17);
                return canvas.toDataURL();
            } catch (e) {
                return 'no-canvas';
            }
        })()
    ];

    // Simple hash function to create a fingerprint string
    let hash = 0;
    const fingerprintString = fingerprintData.join('|');
    
    for (let i = 0; i < fingerprintString.length; i++) {
        const char = fingerprintString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to positive hex string
    const fingerprint = Math.abs(hash).toString(16) + '-' + 
        btoa(fingerprintString).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
    
    return fingerprint;
};

/**
 * Check if device is blocked before attempting login
 * @returns {Promise<{isBlocked: boolean, reason?: string}>}
 */
export const checkDeviceStatus = async (deviceFingerprint) => {
    try {
        const response = await fetch(
            `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/check-device?deviceFingerprint=${encodeURIComponent(deviceFingerprint)}`
        );
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error checking device status:', error);
        return { isBlocked: false }; // Allow on error
    }
};

