import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../http-commons';
import { supabase } from '../supabase';

// Enhanced Push Notifications Service
// Handles iOS, Android, and Desktop notifications
export const useEnhancedNotifications = (userId) => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState('default');
    const [isRegistered, setIsRegistered] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if notifications are supported
        const supported = 'Notification' in window || 'serviceWorker' in navigator;
        setIsSupported(supported);

        if (supported) {
            setPermission(Notification.permission);
        }
    }, []);

    // Request permission with iOS fallback
    const requestPermission = useCallback(async () => {
        if (!isSupported) {
            setError('Notifications not supported');
            return false;
        }

        try {
            // Try native push notifications first
            if ('Notification' in window) {
                const result = await Notification.requestPermission();
                setPermission(result);

                if (result === 'granted') {
                    await registerServiceWorker();
                    return true;
                } else if (result === 'denied') {
                    setError('Notification permission denied');
                    return false;
                }
            }

            // iOS Safari fallback - use local notifications via service worker
            if (isIOS()) {
                const registration = await navigator.serviceWorker.ready;
                if (registration) {
                    // iOS requires using the service worker for notifications
                    await registration.showNotification('Dash-Q', {
                        body: 'Notifications enabled!',
                        icon: '/logo192.png'
                    });
                    setPermission('granted');
                    return true;
                }
            }

            return false;
        } catch (err) {
            console.error('Error requesting notification permission:', err);
            setError(err.message);
            return false;
        }
    }, [isSupported]);

    // Register service worker for push
    // src/Components/notifications/EnhancedPushNotifications.js

    const registerServiceWorker = useCallback(async () => {
        if (!('serviceWorker' in navigator) || !navigator.onLine) return;

        try {
            // 1. Ensure the SW is fully active and ready
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            const readyReg = await navigator.serviceWorker.ready;
            
            const publicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
            if (!publicKey) {
                console.error("❌ PWA ERROR: REACT_APP_VAPID_PUBLIC_KEY is missing from environment variables.");
                return false;
            }

            // 2. Check for existing subscription first
            let subscription = await readyReg.pushManager.getSubscription();
            
            if (!subscription) {
                // 3. This is where AbortError usually happens. 
                // We add a tiny delay to ensure the push service is reachable.
                await new Promise(res => setTimeout(res, 100));
                
                subscription = await readyReg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
            }

            if (userId && subscription) {
                await axios.post(`${API_URL}/notifications/subscribe`, { userId, subscription });
            }
            setIsRegistered(true);
            return true;
        } catch (err) {
            console.error('Push Registration Error:', err.name, err.message);
            setError(err.message);
            return false;
        }
    }, [userId]);

    // Automatically trigger if permission is already granted
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'granted' && userId) {
            registerServiceWorker();
        }
    }, [userId, registerServiceWorker]);

    // Send local notification (works offline)
    const sendLocalNotification = useCallback(async (title, options = {}) => {
        if (permission !== 'granted') {
            console.warn('Notification permission not granted');
            return false;
        }

        try {
            // Try native notification first
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    vibrate: [100, 50, 100],
                    ...options
                });
                return true;
            }

            // Fallback to service worker
            const registration = await navigator.serviceWorker.ready;
            if (registration) {
                await registration.showNotification(title, {
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    vibrate: [100, 50, 100],
                    ...options
                });
                return true;
            }

            return false;
        } catch (err) {
            console.error('Error sending notification:', err);
            return false;
        }
    }, [permission]);

    // Play notification sound
    const playNotificationSound = useCallback((soundType = 'queue') => {
        try {
            const sounds = {
                queue: '/queue_sound.mp3',
                chat: '/chat_sound.mp3',
                complete: '/buzzer.mp3'
            };

            const audio = new Audio(sounds[soundType] || sounds.queue);
            audio.volume = 0.7;
            audio.play().catch(err => console.log('Audio play failed:', err));
        } catch (err) {
            console.log('Audio not available');
        }
    }, []);

    // Vibrate device
    const vibrate = useCallback((pattern = [100, 50, 100]) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }, []);

    // Subscribe to real-time notifications via Supabase
    const subscribeToRealTimeNotifications = useCallback(async (channelName, onNotification) => {
        if (!supabase) return null;

        const channel = supabase.channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                const notification = payload.new;
                if (notification.user_id === userId) {
                    onNotification(notification);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return {
        isSupported,
        permission,
        isRegistered,
        error,
        requestPermission,
        registerServiceWorker,
        sendLocalNotification,
        playNotificationSound,
        vibrate,
        subscribeToRealTimeNotifications
    };
};

// Helper function to convert VAPID key
// src/Components/notifications/EnhancedPushNotifications.js

function urlBase64ToUint8Array(base64String) {
    if (!base64String || typeof base64String !== 'string') return new Uint8Array();

    try {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    } catch (e) {
        console.error("VAPID Key conversion failed", e);
        return new Uint8Array();
    }
}

// Detect iOS device
function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

// Notification Permission Request Component
export const NotificationPermissionPrompt = ({ onPermissionGranted }) => {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Only show if not already granted or denied
        if ('Notification' in window) {
            setShowPrompt(Notification.permission === 'default');
        }
    }, []);

    const handleAllow = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted' && onPermissionGranted) {
                onPermissionGranted();
            }
        }
        setShowPrompt(false);
    };

    const handleDeny = () => {
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="notification-prompt" style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-color)',
            padding: '15px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 1000,
            maxWidth: '90%',
            textAlign: 'center'
        }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>
                🔔 Enable notifications to know when it's your turn!
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={handleDeny} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                    Not now
                </button>
                <button onClick={handleAllow} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                    Enable
                </button>
            </div>
        </div>
    );
};

export default useEnhancedNotifications;
