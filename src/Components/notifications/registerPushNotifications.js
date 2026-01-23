import axios from "axios";
import { urlBase64ToUint8Array } from "../helpers/utils";
import { API_URL } from "../http-commons";

export const registerPushNotifications = async (userId) => {
    if (!('serviceWorker' in navigator)) return;

    try {
        // 1. Register Service Worker
        const register = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });

        // 2. Wait for it to be ready
        await navigator.serviceWorker.ready;

        // 3. Subscribe
        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
        });

        // 4. Send to Backend
        await axios.post(`${API_URL}/subscribe`, {
            subscription: subscription,
            userId: userId
        });

        console.log("Push Notification Subscribed!");
    } catch (error) {
        console.error("Push Registration Error:", error);
    }
}