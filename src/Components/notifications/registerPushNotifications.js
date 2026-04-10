import axios from "axios";
import { urlBase64ToUint8Array } from "../helpers/utils";
import { API_URL } from "../http-commons";

export const registerPushNotifications = async (userId) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn("Notification permission denied");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        // 2. Subscribe
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
        });

        // 3. Send to Backend
        await axios.post(`${API_URL}/subscribe`, {
            subscription: subscription,
            userId: userId
        });

        console.log("✅ Successfully subscribed to Push Notifications");
    } catch (error) {
        console.error("❌ Push Registration Error:", error);
    }
};