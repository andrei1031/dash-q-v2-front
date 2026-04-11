// src/Components/notifications/registerPushNotifications.js
import apiClient from '../http-commons';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY

export const registerPushNotifications = async (userId) => {
    // 2. Add this safety check to stop the function if the key is missing
    if (!VAPID_PUBLIC_KEY) {
        console.error("Push registration failed: REACT_APP_VAPID_PUBLIC_KEY is undefined. Check your .env file and RESTART your server.");
        return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Push notifications not supported on this browser.");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        await apiClient.post('/notifications/subscribe', {
            userId,
            subscription
        });

        console.log("Successfully subscribed to Dash-Q Push Notifications.");
    } catch (err) {
        console.error("Failed to register for push notifications:", err);
    }
};

// Helper function where the crash was happening
function urlBase64ToUint8Array(base64String) {
    // The error happened here because base64String was undefined
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}