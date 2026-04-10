import { useCallback, useEffect, useRef, useState } from "react";
import { getDistanceInMeters, getTomorrowDate, isIOsDevice, NEXT_UP_TITLE, playSound, startBlinking, stopBlinking, stopSound, TURN_TITLE } from "./helpers/utils";
import { getDeviceFingerprint } from "./helpers/deviceFingerprint";
import { API_URL } from "./http-commons";
import { supabase } from "./supabase";
import { messageNotificationSound, queueNotificationSound } from "../App";
import { registerPushNotifications } from "./notifications/registerPushNotifications";
import { IconChat, IconCheck, IconNext, IconRefresh, IconUpload, IconX } from "./assets/Icon";
import { ChatWindow } from "./ChatWindow";
import { ReportModal } from "./modals/ReportModal";
import { MyReportsModal } from "./modals/MyReportsModal";
import axios from "axios";

export const CustomerView = ({ session }) => {
    
    // --- THE TIMEZONE KILLER HELPER ---
    // Safely reads "2026-04-01T11:00:00" and outputs "11:00 AM" without shifting timezones
    const formatNaiveTime = (timeStr) => {
        if (!timeStr) return "";
        if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
        try {
            const cleanStr = timeStr.split('Z')[0].split('+')[0].split('.')[0];
            const timePart = cleanStr.includes('T') ? cleanStr.split('T')[1] : cleanStr;
            let [hours, mins] = timePart.split(':');
            hours = parseInt(hours, 10);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${mins} ${ampm}`;
        } catch(e) { return timeStr; }
    };

    const [barbers, setBarbers] = useState([]);
    const [selectedBarberId, setSelectedBarberId] = useState('');
    
    const isGuest = session && session.user && session.user.is_guest === true;
    const [guestName, setGuestName] = useState(() => session?.user?.nickname || session?.user?.user_metadata?.full_name || '');
    const [guestEmail, setGuestEmail] = useState('');
    
    const [message, setMessage] = useState('');
    const [myQueueEntryId, setMyQueueEntryId] = useState(() => localStorage.getItem('myQueueEntryId') || null);
    const [joinedBarberId, setJoinedBarberId] = useState(() => localStorage.getItem('joinedBarberId') || null);
    const [liveQueue, setLiveQueue] = useState([]);
    const [queueMessage, setQueueMessage] = useState('');
    const [peopleWaiting, setPeopleWaiting] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalButtonDisabled, setIsModalButtonDisabled] = useState(false);
    const [modalCountdown, setModalCountdown] = useState(10);
    const [isQueueLoading, setIsQueueLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(() => {
        return localStorage.getItem('myQueueEntryId') ? true : false;
    });
    const [isServiceCompleteModalOpen, setIsServiceCompleteModalOpen] = useState(false);
    const [isCancelledModalOpen, setIsCancelledModalOpen] = useState(false);
    const [hasUnreadFromBarber, setHasUnreadFromBarber] = useState(() => localStorage.getItem('hasUnreadFromBarber') === 'true');
    const [chatMessagesFromBarber, setChatMessagesFromBarber] = useState([]);
    const [optimisticMessage, setOptimisticMessage] = useState(null);
    const [finishTime, setFinishTime] = useState(() => {
        const saved = localStorage.getItem('targetFinishTime');
        return saved ? parseInt(saved, 10) : 0;
    });

    const [travelDirection, setTravelDirection] = useState(null); 
    const [etaMinutes, setEtaMinutes] = useState(null);
    const [hasArrived, setHasArrived] = useState(false); 
    const lastDistanceRef = useRef(null);

    const [isTooFarModalOpen, setIsTooFarModalOpen] = useState(false);
    const [isOnCooldown, setIsOnCooldown] = useState(false);
    const locationWatchId = useRef(null);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const liveQueueRef = useRef([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [referenceImageUrl, setReferenceImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isVIPToggled, setIsVIPToggled] = useState(false);
    const [isVIPModalOpen, setIsVIPModalOpen] = useState(false);
    const [vipPrice, setVipPrice] = useState(0);
    const lastUploadTime = useRef(0);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    

    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [barberFeedback, setBarberFeedback] = useState([]);
    const [viewMode, setViewMode] = useState('join'); 
    const [loyaltyHistory, setLoyaltyHistory] = useState([]);
    const [loyaltyData, setLoyaltyData] = useState(null); 

    const nowServing = liveQueue.find(entry => entry.status === 'In Progress');
    const upNext = liveQueue.find(entry => entry.status === 'Up Next');
    const targetBarber = barbers.find(b => b.id === parseInt(joinedBarberId));
    const currentBarberName = targetBarber?.full_name || `Barber #${joinedBarberId}`;
    const currentChatTargetBarberUserId = targetBarber?.user_id;

    const myQueueEntry = liveQueue.find(e => e.id.toString() === myQueueEntryId);
    const [customerRating, setCustomerRating] = useState(0);
    const [joinMode, setJoinMode] = useState('now'); 

    const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [freeBarber, setFreeBarber] = useState(null);
    const [myAppointments, setMyAppointments] = useState([]);
    const [headCount, setHeadCount] = useState(1);
    const [showIOSPrompt, setShowIOSPrompt] = useState(true);
    const [isMyReportsOpen, setIsMyReportsOpen] = useState(false);
    const [viewProduct, setViewProduct] = useState(null);

    const customerName = isGuest ? guestName : (session?.user?.user_metadata?.full_name || '');
    const customerEmail = isGuest ? guestEmail : (session?.user?.email || '');

    const fetchMyAppointments = useCallback(async () => {
        if (!session?.user?.id) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/appointments/my/${session.user.id}`);
            setMyAppointments(response.data || []);
        } catch (err) {
            console.error("Failed to load appointments", err);
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    const fetchLoyaltyHistory = useCallback(async (userId) => {
        if (!userId) return;
        try {
            const response = await axios.get(`${API_URL}/customer/history/${userId}`);
            const data = response.data;
            if (data && data.history) {
                setLoyaltyHistory(data.history);
                if (data.loyalty) {
                    setLoyaltyData(data.loyalty);
                }
            } else {
                setLoyaltyHistory(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch loyalty history:', error);
        }
    }, []);

    const fetchChatHistory = useCallback(async (queueId) => {
        if (!queueId) return;
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('sender_id, message, created_at')
                .eq('queue_entry_id', queueId)
                .order('created_at', { ascending: true }); 
            
            if (error) throw error;
            
            if (data) {
                const formattedHistory = data.map(msg => ({
                    senderId: msg.sender_id,
                    message: msg.message,
                    created_at: msg.created_at
                }));
                setChatMessagesFromBarber(formattedHistory);
            }
        } catch (err) { 
            console.error("Error fetching customer chat history:", err); 
        }
    }, []);

    const handleCloseInstructions = () => {
        localStorage.setItem('hasSeenInstructions_v1', 'true');
        setIsInstructionsModalOpen(false);
    };

    const handleReturnToJoin = useCallback(async (userInitiated = false) => {
        if (userInitiated && myQueueEntryId) {
            setIsLoading(true);
            try {
                await axios.delete(`${API_URL}/queue/${myQueueEntryId}`, {
                    data: { userId: session?.user?.id || null }
                });
                setMessage("You left the queue.");
            }
            catch (error) { console.error("Failed to leave queue:", error); setMessage("Error leaving queue."); }
            finally { setIsLoading(false); }
        }
        setIsServiceCompleteModalOpen(false); setIsCancelledModalOpen(false);
        stopBlinking();
        localStorage.removeItem('myQueueEntryId'); 
        localStorage.removeItem('joinedBarberId');
        localStorage.removeItem('targetFinishTime'); 
        localStorage.removeItem('pendingFeedback');
        setMyQueueEntryId(null); setJoinedBarberId(null);
        setLiveQueue([]); setQueueMessage(''); setSelectedBarberId('');
        setSelectedServiceId(''); setMessage('');
        setIsChatOpen(false);
        setChatMessagesFromBarber([]);
        setReferenceImageUrl('');
        setSelectedFile(null);
        setIsUploading(false);

        setFeedbackText('');
        setFeedbackSubmitted(false);
        setBarberFeedback([]);
    }, [myQueueEntryId, session]);

    const fetchPublicQueue = useCallback(async (barberId) => {
        if (!barberId) {
            setLiveQueue([]);
            setIsQueueLoading(false);
            return;
        }
        setIsQueueLoading(true);
        
        try {
            const response = await axios.get(`${API_URL}/queue/public/${barberId}`);
            const queueData = response.data || [];
            setLiveQueue(queueData);
            liveQueueRef.current = queueData;

            const currentQueueId = localStorage.getItem('myQueueEntryId');
            
            if (currentQueueId) {
                const myEntry = queueData.find(e => e.id.toString() === currentQueueId);

                if (myEntry) {
                    if (myEntry.status === 'Up Next') {
                        if (myEntry.is_confirmed) {
                            stopBlinking(); 
                        } else {
                            const modalFlag = localStorage.getItem('stickyModal');
                            if (modalFlag !== 'yourTurn') {
                                playSound(queueNotificationSound);
                                startBlinking(NEXT_UP_TITLE);
                                localStorage.setItem('stickyModal', 'yourTurn');
                                if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                            }
                        }
                    } 
                    else if (myEntry.status === 'In Progress') {
                        const modalFlag = localStorage.getItem('stickyModal');
                        if (modalFlag !== 'yourTurn') {
                            playSound(queueNotificationSound);
                            startBlinking(TURN_TITLE);
                            localStorage.setItem('stickyModal', 'yourTurn');
                        }
                    } 
                    else if (myEntry.status === 'Waiting') {
                        stopBlinking();
                        if (localStorage.getItem('stickyModal') === 'yourTurn') {
                                localStorage.removeItem('stickyModal');
                        }
                    }
                }
            }
            if (currentQueueId) {
                const amIInActiveQueue = queueData.some(entry => entry.id.toString() === currentQueueId);

                if (!amIInActiveQueue && !isServiceCompleteModalOpen && !isCancelledModalOpen) {
    
                    const investigateDisappearance = async () => {
                        const { data: myEntry, error } = await supabase
                            .from('queue_entries')
                            .select('status, barber_id')
                            .eq('id', myQueueEntryId)
                            .maybeSingle();

                        if (error) { return; }

                        if (myEntry && ['Waiting', 'Up Next', 'In Progress'].includes(myEntry.status)) {
                            const currentStoredBarber = localStorage.getItem('joinedBarberId');
                            if (myEntry.barber_id.toString() !== currentStoredBarber) {
                                localStorage.setItem('joinedBarberId', myEntry.barber_id.toString());
                                setJoinedBarberId(myEntry.barber_id.toString());
                                setMessage("🔄 You have been transferred to another barber.");
                            }
                            return; 
                        }

                        const userId = session?.user?.id;
                        if (!userId) return;

                        try {
                            const response = await axios.get(`${API_URL}/missed-event/${userId}`);
                            const eventType = response.data.event;

                            if (eventType === 'Done') {
                                localStorage.setItem('pendingFeedback', JSON.stringify({
                                    barberId: joinedBarberId,
                                    queueId: myQueueEntryId, 
                                    timestamp: Date.now()
                                }));
                                setIsServiceCompleteModalOpen(true);
                                localStorage.removeItem('myQueueEntryId');
                                localStorage.removeItem('joinedBarberId');
                                localStorage.removeItem('stickyModal');
                            } else if (eventType === 'Cancelled') {
                                setIsCancelledModalOpen(true);
                                localStorage.removeItem('myQueueEntryId');
                                localStorage.removeItem('joinedBarberId');
                                localStorage.removeItem('stickyModal');
                            } else {
                                setQueueMessage("Your queue entry was removed.");
                                handleReturnToJoin(false); 
                            }
                        } catch (error) {
                            console.error("[Catcher] Error checking event:", error.message);
                        }
                    };
                    investigateDisappearance();
                }
            }

        } catch (error) {
        // NEW: Check if we are offline and have cached data
            if (!navigator.onLine) {
                console.log("Offline: Attempting to retrieve cached queue data.");
                setQueueMessage("⚠️ Offline Mode: Showing last known queue status.");
            } else {
                console.error("Failed fetch public queue:", error);
                setQueueMessage("Could not load fresh queue data.");
            }
        } finally {
            setIsQueueLoading(false);
        }
    }, [
    session, 
    isServiceCompleteModalOpen, 
    isCancelledModalOpen, 
    setLiveQueue, 
    setQueueMessage, 
    setIsServiceCompleteModalOpen, 
    setIsCancelledModalOpen, 
    setJoinedBarberId,
    handleReturnToJoin,
    myQueueEntryId,
    joinedBarberId
    ]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setSelectedFile(file);
        setReferenceImageUrl('');
    };

    const handleUploadPhoto = async (targetQueueId = myQueueEntryId) => {
        if (!selectedFile) { setMessage("Please select a file first."); return; }
        if (!targetQueueId && myQueueEntryId) { targetQueueId = myQueueEntryId; }

        setIsUploading(true);
        setMessage('Uploading photo...');

        try {
            const fileExtension = selectedFile.name.split('.').pop();
            const filePath = `${session?.user?.id || 'guest'}/${targetQueueId || 'new'}-${Date.now()}.${fileExtension}`;

            const { error: uploadError } = await supabase.storage
                .from('haircut_references')
                .upload(filePath, selectedFile, {
                    cacheControl: '3600',
                    upsert: true
                });
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('haircut_references')
                .getPublicUrl(filePath);

            if (!publicUrlData.publicUrl) throw new Error("Failed to get public URL.");

            const imageUrl = publicUrlData.publicUrl;

            if (!myQueueEntryId) {
                setReferenceImageUrl(imageUrl);
                setMessage('Photo uploaded. Ready to join queue.');
            } else {
                const updateResponse = await axios.put(`${API_URL}/queue/photo`, {
                    queueId: targetQueueId,
                    barberId: joinedBarberId,
                    referenceImageUrl: imageUrl
                });

                if (updateResponse.status !== 200) throw new Error("Failed to update queue entry.");
                setReferenceImageUrl(imageUrl);
                setMessage('Photo successfully updated!');
                fetchPublicQueue(joinedBarberId);
            }

            setSelectedFile(null);

        } catch (error) {
            console.error('Photo upload failed:', error);
            setMessage(`Photo upload failed: ${error.message || 'Server error.'}`);
            setReferenceImageUrl('');
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleVIPToggle = (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            setIsVIPModalOpen(true);
        } else {
            setIsVIPToggled(false);
        }
    };

    const confirmVIP = () => {
        setIsVIPToggled(true);
        setIsVIPModalOpen(false);
    };

    const cancelVIP = () => {
        setIsVIPToggled(false);
        setIsVIPModalOpen(false);
    };

    const handleJoinQueue = async (e) => {
        e.preventDefault();
        if (!selectedServiceId) {
            setMessage('⚠️ Please select a service before joining the queue.');
            return;
        }
        if (myQueueEntryId) { setMessage('You are already checked in!'); return; }
        if (selectedFile && !referenceImageUrl) { setMessage('Please click "Upload Photo" first!'); return; }

        setIsLoading(true); setMessage('Joining queue...');
        
        let deviceFingerprint = localStorage.getItem('deviceFingerprint');
        if (!deviceFingerprint) {
            deviceFingerprint = getDeviceFingerprint();
            localStorage.setItem('deviceFingerprint', deviceFingerprint);
        }

        const isGuestUser = isGuest;
        
        const requestData = isGuestUser ? {
            name: customerName,
            barberId: selectedBarberId,
            serviceId: selectedServiceId,
            headCount: headCount,
            referenceImageUrl: referenceImageUrl || null,
            guestId: localStorage.getItem('guestId') || null,
            deviceFingerprint: deviceFingerprint || null
        } : {
            customer_name: customerName,
            customer_email: customerEmail,
            barber_id: selectedBarberId,
            reference_image_url: referenceImageUrl || null,
            service_id: selectedServiceId,
            user_id: session?.user?.id || null,
            is_vip: isVIPToggled,
            head_count: headCount,
            deviceFingerprint: deviceFingerprint || null
        };

        let endpoint = isGuestUser ? `${API_URL}/guest/join` : `${API_URL}/queue`;

        try {
            let response;
            let newEntry;
            
            try {
                response = await axios.post(endpoint, requestData);
                newEntry = response.data.data || response.data;
            } catch (initialError) {
                if (isGuestUser && initialError.response && initialError.response.status === 404) {
                    endpoint = `${API_URL}/queue`;
                    response = await axios.post(endpoint, requestData);
                    newEntry = response.data;
                } else {
                    throw initialError;
                }
            }
            
            if (newEntry && newEntry.id) {
                setMessage(`Success! You are #${newEntry.id} in the queue.`);
                localStorage.setItem('myQueueEntryId', newEntry.id.toString());
                localStorage.setItem('joinedBarberId', newEntry.barber_id.toString());
                setMyQueueEntryId(newEntry.id.toString());
                setJoinedBarberId(newEntry.barber_id.toString());
                setIsChatOpen(true);
                setSelectedBarberId(''); setSelectedServiceId('');
                setReferenceImageUrl(newEntry.reference_image_url || '');
                fetchPublicQueue(newEntry.barber_id.toString());
                setIsVIPToggled(false);
            } else { throw new Error("Invalid response from server."); }
        } catch (error) {
        
        if (error.response && error.response.status === 409) {
            const existing = error.response.data.details;
            
            if (existing && existing.id && existing.barber_id) {
                setMessage(`⚠️ Found active booking! Recovering your spot (ID: #${existing.id})...`);
                
                localStorage.setItem('myQueueEntryId', existing.id.toString());
                localStorage.setItem('joinedBarberId', existing.barber_id.toString());

                setMyQueueEntryId(existing.id.toString());
                setJoinedBarberId(existing.barber_id.toString());
                setIsChatOpen(true);
                
                setSelectedBarberId('');
                setSelectedServiceId('');
                setReferenceImageUrl(existing.reference_image_url || '');

                fetchPublicQueue(existing.barber_id.toString());
            } else {
                const errorMsg = error.response.data.error || "A conflict occurred.";
                setMessage(`Error: ${errorMsg}`);
            }
        }
        else {
            const errorMessage = error.response?.data?.error || error.message;
            setMessage(errorMessage.includes('unavailable') ? errorMessage : 'Failed to join. Try again.');
        }
    } finally { 
        setIsLoading(false); 
    }
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!customerName || !selectedBarberId || !selectedServiceId || !selectedSlot) { 
            setMessage('All fields including a Time Slot are required.'); 
            return; 
        }

        setIsLoading(true);
        setMessage('Booking appointment...');

        try {
            await axios.post(`${API_URL}/appointments/book`, {
                customer_name: customerName,
                customer_email: customerEmail,
                user_id: session?.user?.id,
                barber_id: selectedBarberId,
                service_id: selectedServiceId,
                scheduled_time: selectedSlot
            });

            // 🟢 APPLYING THE FIX TO SUCCESS MESSAGE 🟢
            setMessage(`Success! Appointment confirmed for ${formatNaiveTime(selectedSlot)}.`);
            
            setSelectedSlot(null);
            setAvailableSlots([]);
            setTimeout(() => {
                setMessage('');
                setViewMode('history'); 
            }, 3000);

        } catch (error) {
            setMessage(error.response?.data?.error || 'Booking failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const AD_INVENTORY = [
        {
            id: 'sea-salt',
            title: "Sea Salt Spray",
            description: "Achieve that messy, beach-vibes texture instantly.",
            price: "₱200.00",
            badge: "BEST SELLER",
            image: "/IMG_0616.PNG", 
            theme: { 
                background: 'linear-gradient(135deg, #fffbeb 0%, #fff3cd 100%)', 
                text: '#856404', 
                border: '#ffeeba',
                badgeBg: '#ff3b30' 
            }
        },
        {
            id: 'pomade',
            title: "Pomade Water Based/Oil Based",
            description: "Slick back style with high shine and all-day control.",
            price: "₱200.00",
            badge: "BARBER'S CHOICE",
            image: "/IMG_0614.PNG", 
            theme: { 
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', 
                text: '#0d47a1', 
                border: '#90caf9',
                badgeBg: '#2962ff' 
            }
        },
        {
            id: 'powder',
            title: "Textured Powder",
            description: "Instant Volume & Stronghold matte finish.",
            price: "₱100.00",
            badge: "NEW ARRIVAL",
            image: "/IMG_0615.PNG", 
            theme: { 
                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', 
                text: '#1b5e20', 
                border: '#a5d6a7',
                badgeBg: '#2e7d32' 
            }
        }
    ];

    const CAFE_AD = {
        name: "Safehouse Cafe",
        pitch: "Tired of standing? Wait here instead! nearby cafe",
        perks: "☕ Free WiFi  •   ₱159 Buy1Take1 Milktea  •  Board Games",
        image: "/safehouselogo.jpg",
        locationLink: "https://maps.app.goo.gl/ETUu5bxPA6t2yuSs6" 
    };

    useEffect(() => {
    if (!myQueueEntryId || !joinedBarberId) return;

        const checkOpportunities = async () => {
            try {
                const res = await axios.get(`${API_URL}/barbers`); 
                const allBarbers = res.data;

                const currentBarberIdStr = joinedBarberId.toString();
                
                const opportunity = allBarbers.find(b => 
                    b.id.toString() !== currentBarberIdStr && 
                    b.is_active && 
                    b.is_available 
                );

                if (opportunity) {
                    setFreeBarber(opportunity);
                } else {
                    setFreeBarber(null);
                }
            } catch (e) {}
        };

        const interval = setInterval(checkOpportunities, 10000); 
        return () => clearInterval(interval);
    }, [myQueueEntryId, joinedBarberId]);

    const handleConfirmAttendance = async () => {
        try {
            await axios.put(`${API_URL}/queue/confirm`, { queueId: myQueueEntryId });
            stopSound(queueNotificationSound); 
            stopBlinking();
            if (navigator.vibrate) navigator.vibrate(0);
            
            setOptimisticMessage("✅ Confirmed! Welcome to the shop.");
            setTimeout(() => setOptimisticMessage(null), 3000);
        } catch (e) { 
            setMessage("Failed to confirm. Please try again.");
        }
    };

    const handleSelfTransfer = async () => {
        if (!freeBarber) return;
        if (!window.confirm(`Switch to ${freeBarber.full_name}? You will lose your spot with your current barber.`)) return;

        setIsLoading(true);
        try {
            await axios.delete(`${API_URL}/queue/${myQueueEntryId}`, { data: { userId: session?.user?.id || null } }); 
            
            await axios.post(`${API_URL}/queue`, {
                customer_name: customerName,
                customer_email: customerEmail,
                barber_id: freeBarber.id,
                service_id: selectedServiceId || 1, 
                user_id: session?.user?.id || null,
                is_vip: false 
            });

            alert(`Switched to ${freeBarber.full_name}!`);
            window.location.reload(); 
            
        } catch (e) {
            alert("Failed to switch.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'appointments') {
            fetchMyAppointments();
        }
    }, [viewMode, fetchMyAppointments]);

    useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}, []);

    useEffect(() => {
        const restoreSession = async () => {
            if (!myQueueEntryId && session?.user?.id) {
                try {
                    const { data: activeEntry, error } = await supabase
                        .from('queue_entries')
                        .select('id, barber_id, reference_image_url')
                        .eq('user_id', session.user.id)
                        .in('status', ['Waiting', 'Up Next', 'In Progress'])
                        .maybeSingle();

                    if (!error && activeEntry) {
                        localStorage.setItem('myQueueEntryId', activeEntry.id.toString());
                        localStorage.setItem('joinedBarberId', activeEntry.barber_id.toString());
                        setMyQueueEntryId(activeEntry.id.toString());
                        setJoinedBarberId(activeEntry.barber_id.toString());
                        setReferenceImageUrl(activeEntry.reference_image_url || '');
                        setIsChatOpen(true);
                        fetchPublicQueue(activeEntry.barber_id.toString());
                    }
                } catch (err) {}
            }
        };
        restoreSession();
    }, [session, myQueueEntryId, fetchPublicQueue]);
    
    useEffect(() => {
        const restoreGuestSession = async () => {
            if (isGuest && !myQueueEntryId) {
                const storedGuestId = localStorage.getItem('guestId');
                if (storedGuestId) {
                    try {
                        const response = await axios.post(`${API_URL}/guest_login`, { guestId: storedGuestId });
                        if (response.data && response.data.activeQueueEntry) {
                            const entry = response.data.activeQueueEntry;
                            
                            localStorage.setItem('myQueueEntryId', entry.id.toString());
                            localStorage.setItem('joinedBarberId', entry.barber_id.toString());
                            
                            setMyQueueEntryId(entry.id.toString());
                            setJoinedBarberId(entry.barber_id.toString());
                            setReferenceImageUrl(entry.reference_image_url || '');
                            setIsChatOpen(true);
                            
                            if (entry.customer_name) setGuestName(entry.customer_name);
                            if (entry.customer_email) setGuestEmail(entry.customer_email);

                            fetchPublicQueue(entry.barber_id.toString());
                        }
                    } catch (err) {}
                }
            }
        };
        restoreGuestSession();
    }, [isGuest, myQueueEntryId, fetchPublicQueue]);

    useEffect(() => {
        if (joinMode === 'later' && selectedBarberId && selectedServiceId && selectedDate) {
            setAvailableSlots([]); 
            axios.get(`${API_URL}/appointments/slots`, {
                params: { barberId: selectedBarberId, serviceId: selectedServiceId, date: selectedDate }
            })
            .then(res => setAvailableSlots(res.data))
            .catch(err => console.error(err));
        }
    }, [joinMode, selectedBarberId, selectedServiceId, selectedDate]);

    useEffect(() => {
        if (viewMode === 'history' && session?.user?.id) {
            fetchLoyaltyHistory(session.user.id);
        }
    }, [viewMode, session?.user?.id, fetchLoyaltyHistory]);
    
    useEffect(() => { 
        const BARBERSHOP_LAT = 16.414830; 
        const BARBERSHOP_LON = 120.597122;
        
        const WARNING_DISTANCE = 300; 
        const ARRIVAL_DISTANCE = 30;  
        const WALKING_SPEED_MPM = 80; 

        if (!myQueueEntryId || !('geolocation' in navigator) || isGuest) return;

        const onPositionUpdate = (position) => {
            const { latitude, longitude } = position.coords;
            const currentDist = getDistanceInMeters(latitude, longitude, BARBERSHOP_LAT, BARBERSHOP_LON);
            const prevDist = lastDistanceRef.current;

            if (prevDist !== null) {
                if (Math.abs(currentDist - prevDist) > 3) {
                    if (currentDist < prevDist) setTravelDirection('closing'); 
                    else setTravelDirection('away'); 
                }
            }
            lastDistanceRef.current = currentDist;

            const estimatedMins = Math.ceil(currentDist / WALKING_SPEED_MPM);
            setEtaMinutes(estimatedMins);

            if (currentDist <= ARRIVAL_DISTANCE) {
                if (!hasArrived) {
                    setHasArrived(true); 
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
                }
            } else {
                setHasArrived(false);
            }

            const now = Date.now();
            if (now - lastUploadTime.current > 60000) { 
                axios.put(`${API_URL}/queue/location`, {
                    queueId: myQueueEntryId,
                    distance: currentDist
                }).catch(e => console.error("Loc upload fail"));
                lastUploadTime.current = now;
            }

            const myEntry = liveQueueRef.current.find(e => e.id.toString() === myQueueEntryId);
            if (myEntry && myEntry.status === 'Up Next' && currentDist > WARNING_DISTANCE) {
                if (!isTooFarModalOpen && !isOnCooldown) {
                    localStorage.setItem('stickyModal', 'tooFar');
                    setIsTooFarModalOpen(true);
                    setIsOnCooldown(true);
                }
            }
        };

        const onError = (err) => console.warn("GPS Error:", err);
        
        locationWatchId.current = navigator.geolocation.watchPosition(onPositionUpdate, onError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        });

        return () => {
            if (locationWatchId.current) navigator.geolocation.clearWatch(locationWatchId.current);
        };
    }, [myQueueEntryId, isTooFarModalOpen, isOnCooldown, hasArrived, isGuest]);

    useEffect(() => { 
        const pendingFeedback = localStorage.getItem('pendingFeedback');
        if (pendingFeedback) {
            const data = JSON.parse(pendingFeedback);
            setJoinedBarberId(data.barberId);
            if (data.queueId) setMyQueueEntryId(data.queueId); 
            setIsServiceCompleteModalOpen(true);
        }
    }, []);
    
    useEffect(() => {
        const modalFlag = localStorage.getItem('stickyModal');
        if (modalFlag === 'tooFar') {
            setIsTooFarModalOpen(true);
        }
    }, []);
    
    useEffect(() => { 
        const fetchServices = async () => {
            try { 
                const response = await axios.get(`${API_URL}/services`); 
                setServices(response.data || []); 
            } catch (error) {
                if (!navigator.onLine) {
                    console.log("Offline: Services are being served from cache.");
                } else {
                    console.error("Error fetching services:", error);
                }
            }
        };
        fetchServices();
    }, []);

    useEffect(() => {
        const fetchVipPrice = async () => {
            try {
                const response = await axios.get(`${API_URL}/settings/vip-price`);
                setVipPrice(response.data.vip_price || 100);
            } catch (error) {
                if (!navigator.onLine) {
                    console.log("Offline: Using last known VIP price from cache.");
                }
            }
        };
        fetchVipPrice();
    }, []);

    useEffect(() => { 
        const loadBarbers = async () => {
            try { 
                const response = await axios.get(`${API_URL}/barbers`); 
                setBarbers(response.data || []); 
            } catch (error) {
                if (!navigator.onLine) {
                    console.log("Offline: Barber list is being served from cache.");
                } else {
                    setBarbers([]); 
                }
            }
        };
        loadBarbers();
        const intervalId = setInterval(() => {
            if (navigator.onLine) loadBarbers(); // Only auto-refresh if online
        }, 15000);
        return () => clearInterval(intervalId);
    }, []);
    
    useEffect(() => { 
        const handleFocus = () => stopBlinking();
        
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                stopBlinking();
                
                const hasUnread = localStorage.getItem('hasUnreadFromBarber') === 'true';
                setHasUnreadFromBarber(hasUnread);

                const currentBarber = localStorage.getItem('joinedBarberId');
                if (currentBarber) {
                    fetchPublicQueue(currentBarber);
                }
            }
        };
        
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        
        return () => { 
            window.removeEventListener("focus", handleFocus); 
            document.removeEventListener("visibilitychange", handleVisibility); 
            stopBlinking(); 
        };
    }, [fetchPublicQueue]); 

    useEffect(() => { 
        if (joinedBarberId) { fetchPublicQueue(joinedBarberId); } else { setLiveQueue([]); setIsQueueLoading(false); }
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); }
        let queueChannel = null; let refreshInterval = null;
        if (joinedBarberId && myQueueEntryId && supabase?.channel) {
            queueChannel = supabase.channel(`public_queue_${joinedBarberId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${joinedBarberId}` }, (payload) => {
                    
                    if (payload.eventType === 'UPDATE' && payload.new.id.toString() === myQueueEntryId) {
                        const newStatus = payload.new.status;
                        const isConfirmed = payload.new.is_confirmed; 
                        
                        if (newStatus === 'Up Next') {
                            if (isConfirmed) {
                                stopBlinking();
                            } else {
                                playSound(queueNotificationSound);
                                startBlinking(NEXT_UP_TITLE);
                                localStorage.setItem('stickyModal', 'yourTurn');
                                if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                            }
                        }
                        else if (newStatus === 'In Progress') { 
                            playSound(queueNotificationSound);
                            startBlinking(TURN_TITLE);
                            localStorage.setItem('stickyModal', 'yourTurn');
                            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
                        }
                        else if (newStatus === 'Done') { 
                            localStorage.setItem('pendingFeedback', JSON.stringify({
                            barberId: joinedBarberId,
                            timestamp: Date.now()
                        }));
                        setIsServiceCompleteModalOpen(true); 
                        stopBlinking();
                        }
                        else if (newStatus === 'Cancelled') { 
                            setIsCancelledModalOpen(true); 
                            stopBlinking(); 
                        }
                    }
                    fetchPublicQueue(joinedBarberId);
                })
                .subscribe();
            refreshInterval = setInterval(() => { fetchPublicQueue(joinedBarberId); }, 15000);
        }
        return () => {
            if (queueChannel && supabase?.removeChannel) { supabase.removeChannel(queueChannel).catch(err => {}); }
            if (refreshInterval) { clearInterval(refreshInterval); }
        };
    }, [joinedBarberId, myQueueEntryId, fetchPublicQueue]);

    useEffect(() => { 
        if (selectedBarberId) {
            setBarberFeedback([]);
            const fetchFeedback = async () => {
                try {
                    const response = await axios.get(`${API_URL}/feedback/${selectedBarberId}`);
                    setBarberFeedback(response.data || []);
                } catch (err) {}
            };
            fetchFeedback();
        } else {
            setBarberFeedback([]);
        }
    }, [selectedBarberId]);

    useEffect(() => { 
        if (!session?.user?.id || !joinedBarberId || !myQueueEntryId) return;
        fetchChatHistory(myQueueEntryId);

        const chatChannel = supabase.channel(`customer_chat_fix_${myQueueEntryId}`) 
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'chat_messages', 
                    filter: `queue_entry_id=eq.${myQueueEntryId}` 
                }, 
                (payload) => {
                    const newMsg = payload.new;

                    if (newMsg.sender_id !== session.user.id) {
                        setChatMessagesFromBarber(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.message === newMsg.message && lastMsg.senderId === newMsg.sender_id) {
                                return prev;
                            }
                            
                            return [...prev, { 
                                senderId: newMsg.sender_id, 
                                message: newMsg.message,
                                created_at: newMsg.created_at
                            }];
                        });
                        
                        playSound(messageNotificationSound);
                        
                        if (!isChatOpen) {
                            setHasUnreadFromBarber(true);
                            localStorage.setItem('hasUnreadFromBarber', 'true');
                        } else {
                            axios.put(`${API_URL}/chat/read`, { queueId: myQueueEntryId, readerId: session.user.id });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [session, joinedBarberId, myQueueEntryId, fetchChatHistory, isChatOpen]); 

    const sendCustomerMessage = async (recipientId, messageText) => {
        if (!messageText.trim()) return;
        
        const tempMsg = { senderId: session.user.id, message: messageText, created_at: new Date().toISOString() };
        setChatMessagesFromBarber(prev => [...prev, tempMsg]);

        try {
            await axios.post(`${API_URL}/chat/send`, {
                senderId: session.user.id,
                queueId: myQueueEntryId,
                message: messageText
            });
        } catch (error) {
            setMessage("Failed to send message. Profanity?");
        }
    };

    useEffect(() => { 
        if (selectedBarberId) {
            setLiveQueue([]); 
            liveQueueRef.current = [];
            setPeopleWaiting(0); 
            setFinishTime(0);    
            setIsQueueLoading(true); 
            fetchPublicQueue(selectedBarberId);
        } else {
            setLiveQueue([]);
            liveQueueRef.current = [];
            setPeopleWaiting(0);
            setIsQueueLoading(false); 
        }
    }, [selectedBarberId, fetchPublicQueue]);

    useEffect(() => { 
        const calculateWaitTime = () => {
            const newQueue = liveQueue;
            const myIndexNew = newQueue.findIndex(e => e.id.toString() === myQueueEntryId);
            
            const peopleAheadNew = myIndexNew !== -1 ? newQueue.slice(0, myIndexNew) : newQueue;
            
            const relevantEntries = newQueue.filter(e => e.status === 'Waiting' || e.status === 'Up Next');
            setPeopleWaiting(relevantEntries.length);

            const now = Date.now();

            const dbWaitMinutes = peopleAheadNew.reduce((sum, entry) => {
            const duration = entry.services?.duration_minutes || 30;
            const heads = entry.head_count || 1; 
            const totalDuration = duration * heads; 

            if (entry.status === 'In Progress' && entry.updated_at) {
                const startTime = new Date(entry.updated_at).getTime();
                const minutesElapsed = (now - startTime) / 60000;
                const minutesRemaining = Math.max(5, totalDuration - minutesElapsed);
                return sum + minutesRemaining;
            }

            return sum + totalDuration;
        }, 0);

            const calculatedTarget = now + (dbWaitMinutes * 60000);

            if (!myQueueEntryId) {
                setFinishTime(calculatedTarget);
            } 
            else {
                const storedTarget = localStorage.getItem('targetFinishTime');
                let currentTarget = storedTarget ? parseInt(storedTarget, 10) : 0;

                if (!currentTarget || currentTarget < now || calculatedTarget < currentTarget) {
                    currentTarget = calculatedTarget;
                    localStorage.setItem('targetFinishTime', currentTarget.toString());
                    setFinishTime(currentTarget);
                }
            }
            
        };
        
        if (liveQueue.length > 0 || myQueueEntryId) {
            calculateWaitTime();
        }
    }, [liveQueue, myQueueEntryId]);
    
    useEffect(() => { 
        let timerId = null;
        let countdownInterval = null;

        if (isServiceCompleteModalOpen || isCancelledModalOpen || isTooFarModalOpen) {
            setIsModalButtonDisabled(true);
            setModalCountdown(5); 

            timerId = setTimeout(() => {
                setIsModalButtonDisabled(false);
            }, 5000); 

            countdownInterval = setInterval(() => {
                setModalCountdown(prevCount => {
                    if (prevCount <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prevCount - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerId) clearTimeout(timerId);
            if (countdownInterval) clearInterval(countdownInterval);
        };
    }, [isServiceCompleteModalOpen, isCancelledModalOpen, isTooFarModalOpen]); 

    return (
        <div className="card">
            {/* OFFLINE BADGE */}
            {isOffline && (
                <div style={{
                    backgroundColor: 'var(--error-color)',
                    color: 'white',
                    textAlign: 'center',
                    padding: '5px',
                    fontSize: '0.8rem',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: 'bold'
                }}>
                    📴 You are offline. Showing cached information.
                </div>
            )}
            
            <div className="modal-overlay" style={{ display: isInstructionsModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content instructions-modal">
                    <div className="modal-body">
                        <h2>How to Join</h2>
                        <ol className="instructions-list">
                            <li>Select your <strong>Service</strong>.</li>
                            <li>Choose an <strong>Available Barber</strong>.</li>
                            <li>Click <strong>"Join Queue"</strong> and wait!</li>
                        </ol>
                    </div>
                    <div className="modal-footer">
                        <button onClick={handleCloseInstructions} className="btn btn-primary">Got It!</button>
                    </div>
                </div>
            </div>
            
            <div className="modal-overlay" style={{ display: isServiceCompleteModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    {!feedbackSubmitted ? (
                        <form className="feedback-form" onSubmit={async (e) => {
                            e.preventDefault();
                            if (customerRating === 0) { 
                                setMessage('Please select a star rating.'); 
                                return; 
                            }
                            if (feedbackText.trim().length < 1) { 
                                setMessage('Please leave a short comment.'); 
                                return; 
                            }
                            
                            try { 
                                await axios.post(`${API_URL}/feedback`, { 
                                    barber_id: joinedBarberId, 
                                    customer_name: customerName, 
                                    comments: feedbackText.trim(), 
                                    rating: customerRating,
                                    queue_id: myQueueEntryId
                                }); 
                                
                                // 🟢 MOVE THESE INSIDE THE TRY BLOCK 🟢
                                setFeedbackSubmitted(true);
                                setMessage(''); 
                                
                            } catch (err) { 
                                console.error("Feedback error:", err);
                                setMessage('Error: ' + (err.response?.data?.error || err.message || 'Failed to connect.'));
                                return;
                            }
                        }}>
                            <div className="modal-body">
                                <h2>Service Complete!</h2>
                                <p>Thank you! Please rate your experience with {currentBarberName}:</p>
                                
                                <div className="star-rating-input" style={{fontSize: '2rem', marginBottom: '15px'}}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <span 
                                            key={star}
                                            style={{cursor: 'pointer', color: star <= customerRating ? '#FFD700' : 'var(--text-secondary)'}}
                                            onClick={() => setCustomerRating(star)}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>

                                <div style={{
                                    margin: '20px 0',
                                    padding: '12px',
                                    background: 'rgb(30,30,30) ',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    textAlign: 'center',
                                    boxShadow: 'rgb(30,30,30)'
                                }}>
                                    <div style={{fontSize: '1rem', marginBottom: '10px', color: 'var(--text-primary)'}}>
                                        🔥 <strong>Maintain your fresh look!</strong>
                                    </div>

                                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                        {AD_INVENTORY.map((product) => (
                                            <div 
                                                key={product.id} 
                                                onClick={() => setViewProduct(product)} 
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    background: product.theme.background,
                                                    border: `1px solid ${product.theme.border}`,
                                                    borderRadius: '8px',
                                                    padding: '8px',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer', 
                                                    transition: 'transform 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                <div style={{
                                                    position: 'absolute', top: 0, right: 0,
                                                    background: product.theme.badgeBg, color: 'white',
                                                    fontSize: '0.55rem', fontWeight: 'bold', padding: '2px 6px',
                                                    borderBottomLeftRadius: '6px'
                                                }}>
                                                    {product.badge}
                                                </div>

                                                <img 
                                                    src={product.image} 
                                                    alt={product.title}
                                                    style={{
                                                        width: '50px', height: '50px', borderRadius: '6px', 
                                                        objectFit: 'cover', border: '1px solid rgba(0,0,0,0.1)', 
                                                        flexShrink: 0, backgroundColor: '#fff'
                                                    }} 
                                                />

                                                <div style={{marginLeft: '12px', textAlign: 'left', flex: 1}}>
                                                    <div style={{fontSize: '0.9rem', fontWeight: 'bold', color: product.theme.text, lineHeight: '1.2'}}>
                                                        {product.title}
                                                    </div>
                                                    <div style={{fontSize: '0.75rem', color: 'black', opacity: 0.8}}>
                                                        Click for details...
                                                    </div>
                                                </div>

                                                <div style={{fontWeight: '800', fontSize: '0.95rem', color: product.theme.text, marginLeft: '8px'}}>
                                                    {product.price}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{margin: '10px 0 0 0', fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)'}}>
                                        Tap a product to view details
                                    </p>
                                </div>

                                <textarea 
                                    value={feedbackText} 
                                    onChange={(e) => setFeedbackText(e.target.value)} 
                                    placeholder="How was your cut? (Optional - e.g. 'Great fade!')"
                                    style={{
                                        width: '100%',
                                        minHeight: '120px', 
                                        padding: '15px',
                                        marginTop: '15px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-dark)', 
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem',
                                        lineHeight: '1.5',
                                        resize: 'none', 
                                        fontFamily: 'inherit',
                                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)', 
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--primary-orange)';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(255, 149, 0, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border-color)';
                                        e.target.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.2)';
                                    }}
                                />
                                {message && <p className="message error small">{message}</p>}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => { setFeedbackSubmitted(true); setCustomerRating(0); }} 
                                >
                                    Skip
                                </button>
                                <button type="submit" 
                                    className="btn btn-primary" 
                                    disabled={customerRating === 0 || feedbackText.trim().length < 5}>
                                    Submit Rating
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="modal-body"><h2>Feedback Sent!</h2><p>Thank you for visiting!</p></div>
                            <div className="modal-footer">
                                <button id="close-complete-modal-btn" onClick={() => handleReturnToJoin(false)} disabled={isModalButtonDisabled} className="btn btn-primary">
                                    {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="modal-overlay" style={{ display: isCancelledModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <div className="modal-body"><h2>Appointment Cancelled</h2><p>Your queue entry was cancelled.</p></div>
                    <div className="modal-footer">
                        <button id="close-cancel-modal-btn" onClick={() => handleReturnToJoin(false)} disabled={isModalButtonDisabled} className="btn btn-primary">
                            {isModalButtonDisabled ? `Please wait (${modalCountdown})...` : 'Okay'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="modal-overlay" style={{ display: isTooFarModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <div className="modal-body">
                        <h2 style={{color: 'var(--error-color)'}}>⚠️ You are drifting away!</h2>
                        <p>You are moving further from the shop.</p>
                        <p><strong>ETA to return: ~{etaMinutes} mins</strong></p>
                        <p>Please head back so you don't lose your spot!</p>
                    </div>
                    <div className="modal-footer">
                        <button onClick={() => {
                            setIsTooFarModalOpen(false);
                            localStorage.removeItem('stickyModal');
                            setIsOnCooldown(true);
                            setTimeout(() => setIsOnCooldown(false), 300000);
                        }} className="btn btn-primary">
                            I'm Turning Back 🏃‍♂️
                        </button>
                    </div>
                </div>
            </div>

            <div className="modal-overlay" style={{ display: isVIPModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    <div className="modal-body">
                        <h2>Priority Service Confirmation</h2>
                        <p>You are booking for <strong>{headCount} person(s)</strong>.</p>
                        <p>VIP priority incurs an additional <strong>₱{vipPrice} per head</strong> fee.</p>
                        <div style={{background:'rgba(255, 149, 0, 0.1)', padding:'10px', borderRadius:'8px', marginTop:'10px'}}>
                            <strong>Total VIP Surcharge: ₱{vipPrice * headCount}</strong>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button onClick={cancelVIP} className="btn btn-secondary">Cancel VIP</button>
                        <button onClick={confirmVIP} disabled={!selectedServiceId} className="btn btn-primary">
                            Confirm (+₱{vipPrice * headCount})
                        </button>
                    </div>
                </div>
            </div>
            
            {'Notification' in window && Notification.permission === 'default' && !isGuest && (
                <div className="message warning small" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span>Enable notifications for "Up Next" alerts?</span>
                    <button 
                        onClick={() => {
                            Notification.requestPermission().then(perm => {
                                if (perm === 'granted') {
                                    registerPushNotifications(session.user.id);
                                    alert("Notifications Enabled!");
                                }
                            });
                        }} 
                        className="btn btn-primary"
                        style={{fontSize: '0.8rem', padding: '4px 8px'}}
                    >
                        Enable
                    </button>
                </div>
            )}

            <div className="card-header customer-view-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                <button className={viewMode === 'join' ? 'active' : ''} onClick={() => setViewMode('join')} style={{ flex: '1 1 auto' }}>
                    Join Queue
                </button>
                {!isGuest && <button className={viewMode === 'appointments' ? 'active' : ''} onClick={() => setViewMode('appointments')} style={{ flex: '1 1 auto' }}>
                    Appointments
                </button>}
                {!isGuest && <button className={viewMode === 'history' ? 'active' : ''} onClick={() => setViewMode('history')} style={{ flex: '1 1 auto' }}>
                    My History
                </button>}
            </div>

            {viewMode === 'join' && !myQueueEntryId && (
                <div className="card-body">
                    <div className="customer-view-tabs" style={{marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                        <button 
                            className={joinMode === 'now' ? 'active' : ''} 
                            onClick={() => setJoinMode('now')}
                            style={{flex: '1 1 auto', textAlign: 'center'}}
                        >
                            ⚡ Join Queue Now
                        </button>
                            {!isGuest && <button 
                                className={joinMode === 'later' ? 'active' : ''} 
                                onClick={() => setJoinMode('later')}
                                style={{flex: '1 1 auto', textAlign: 'center'}}
                            >
                                📅 Book Appointment
                            </button>}
                    </div>

                    <div className="form-group">
                        <label>Your Name:</label>
                        <input 
                            type="text" 
                            value={customerName} 
                            onChange={(e) => isGuest && setGuestName(e.target.value)}
                            required 
                            readOnly={!isGuest} 
                            className={isGuest ? "form-control" : "prefilled-input"} 
                            placeholder={isGuest ? "Enter your name" : ""}
                        />
                    </div>

                    {joinMode === 'now' && (
                        <form onSubmit={handleJoinQueue}>
                            <div className="form-group"><label>Select Service:</label><select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}><option value="">-- Choose service --</option>{services.map((service) => (<option key={service.id} value={service.id}>{service.name} ({service.duration_minutes} min / ₱{service.price_php})</option>))}</select></div>
                            <div className="form-group">
                                <label>Group Size (Number of Heads):</label>
                                
                                <div className="stepper-wrapper">
                                    <button 
                                        type="button" 
                                        className="btn-stepper"
                                        onClick={() => setHeadCount(prev => Math.max(1, prev - 1))}
                                    >
                                        −
                                    </button>
                                    <span className="stepper-count">{headCount}</span>
                                    <button 
                                        type="button" 
                                        className="btn-stepper"
                                        onClick={() => setHeadCount(prev => prev + 1)}
                                    >
                                        +
                                    </button>
                                </div>
                                
                                <div style={{marginTop: '10px'}}>
                                    {headCount > 1 ? (
                                        <div className="message warning small" style={{textAlign:'left'}}>
                                            <strong style={{display:'block', marginBottom:'4px'}}>👥 Group Details:</strong>
                                            <ul style={{margin:0, paddingLeft:'20px'}}>
                                                <li>This will book <strong>{headCount} slots</strong> back-to-back.</li>
                                                <li>
                                                    Total Duration: <strong>
                                                        {services.find(s => s.id.toString() === selectedServiceId)?.duration_minutes * headCount || 0} mins
                                                    </strong>.
                                                </li>
                                                <li style={{color: 'var(--error-color)', fontWeight: 'bold', marginTop:'5px'}}>
                                                    Note: Everyone must get the same service. 
                                                    <span style={{fontWeight:'normal', color:'var(--text-primary)'}}> If guests want different services, please join the queue individually.</span>
                                                </li>
                                            </ul>
                                        </div>
                                    ) : (
                                        <p className="message small">For 1 person.</p>
                                    )}
                                </div>
                            </div>
                            
                            {selectedServiceId && !isGuest && (
                                <div className="form-group vip-toggle-group">
                                    <label>Service Priority:</label>
                                    <div className="priority-toggle-control">
                                        <button type="button" className={`priority-option ${!isVIPToggled ? 'active' : ''}`} onClick={() => setIsVIPToggled(false)}>No Priority</button>
                                        <button type="button" className={`priority-option ${isVIPToggled ? 'active vip' : ''}`} onClick={() => handleVIPToggle({ target: { checked: true } })} disabled={isVIPToggled}>VIP Priority (+₱{vipPrice})</button>
                                    </div>
                                    {isVIPToggled && (<p className="success-message small">VIP Priority is active. You will be placed Up Next.</p>)}
                                </div>
                            )}
                            
{!isGuest && (
                                <div className="form-group photo-upload-group">
                                    <label>Desired Haircut Photo (Optional):</label>
                                    <p className="message small">Upload anytime before joining or after. Optional but helpful for barbers!</p>
                                    <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} id="file-upload" className="file-upload-input" />
                                    <label htmlFor="file-upload" className="btn btn-secondary btn-icon-label file-upload-label"><IconUpload />{selectedFile ? selectedFile.name : 'Choose a file...'}</label>
                                    <button type="button" onClick={() => handleUploadPhoto(null)} disabled={!selectedFile || isUploading || referenceImageUrl} className="btn btn-secondary btn-icon-label">
                                        <IconUpload />
                                        {isUploading ? 'Uploading...' : (referenceImageUrl ? 'Photo Attached' : 'Upload Photo')}
                                    </button>
                                    {referenceImageUrl && <p className="success-message small">Photo ready. <a href={referenceImageUrl} target="_blank" rel="noopener noreferrer">View Photo</a></p>}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Select Available Barber:</label>
                                {barbers.length > 0 ? (
                                    <div className="barber-selection-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                                        {barbers.map((barber) => (
                                            <button type="button" key={barber.id} className={`barber-card ${selectedBarberId === barber.id.toString() ? 'selected' : ''}`} onClick={() => setSelectedBarberId(barber.id.toString())} style={{ transition: 'all 0.2s ease', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                                <span className="barber-name">{barber.full_name}</span>
                                                <div className="barber-rating">
                                                    <span className="star-icon">⭐</span>
                                                    <span className="score-text">{parseFloat(barber.average_score).toFixed(1)}</span>
                                                    <span className="review-count">({barber.review_count})</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (<p className="empty-text">No barbers are available right now.</p>)}
                                <input type="hidden" value={selectedBarberId} required />
                            </div>

                            {selectedBarberId && (<div className="feedback-list-container customer-feedback">
                            <h3 className="feedback-subtitle">Recent Feedback</h3>
                            <ul className="feedback-list">
                                {barberFeedback.length > 0 ? (barberFeedback.map((item, index) => (
                                    <li key={index} className="feedback-item">
                                        <div className="feedback-header">
                                            <span className="feedback-score" style={{fontSize: '1.2rem', lineHeight: '1'}}>
                                                <span style={{color: '#FFD700'}}>
                                                    {'★'.repeat(Math.round(Math.max(0, Math.min(5, item.score || 0))))}
                                                </span>
                                                <span style={{color: 'var(--text-secondary)'}}>
                                                    {'☆'.repeat(5 - Math.round(Math.max(0, Math.min(5, item.score || 0))))}
                                                </span>
                                            </span>
                                            <span className="feedback-customer">
                                                {item.customer_name || 'Customer'}
                                            </span>
                                        </div>
                                        {item.comments && <p className="feedback-comment">"{item.comments}"</p>}
                                    </li>
                            ))) : (<p className="empty-text">No feedback yet for this barber.</p>)}</ul></div>)}

                            {isQueueLoading && selectedBarberId ? (<div className="ewt-container"><p style={{margin:0, textAlign:'center', width:'100%', color:'var(--text-secondary)'}}>Loading estimates...</p></div>) : (selectedBarberId && (<div className="ewt-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <div className="ewt-item" style={{ flex: '1 1 140px' }}><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div>
                                <div className="ewt-item" style={{ flex: '1 1 140px' }}><span>Expected Time</span><strong>{finishTime > 0 ? new Date(finishTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Calculating...'}</strong></div>
                            </div>))}

                            {isIOsDevice() && showIOSPrompt && (
                                <div className="message warning small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <span>
                                        <b>iPhone Users:</b> Push alerts/sounds are not supported. Please keep this tab open!
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowIOSPrompt(false)}
                                        style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                            
                            <button type="submit" disabled={isLoading || !selectedBarberId || barbers.length === 0 || isUploading} className="btn btn-primary btn-full-width" style={{marginTop: '20px'}}>
                                {isLoading ? 'Joining...' : 'Join Queue Now'}
                            </button>
                        </form>
                    )}

                    {joinMode === 'later' && !isGuest && (
                        <form onSubmit={handleBooking}>
                            <div className="form-group"><label>Select Service:</label><select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} required><option value="">-- Choose service --</option>{services.map((service) => (<option key={service.id} value={service.id}>{service.name} ({service.duration_minutes} min / ₱{service.price_php})</option>))}</select></div>

                            <div className="form-group">
                                <label>Select Barber:</label>
                                <select value={selectedBarberId} onChange={(e) => setSelectedBarberId(e.target.value)} required>
                                    <option value="">-- Choose Barber --</option>
                                    {barbers.map(b => (
                                        <option key={b.id} value={b.id}>{b.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Select Date:</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    min={getTomorrowDate()}   
                                    onChange={e => setSelectedDate(e.target.value)} 
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Available Time Slots:</label>
                                {!selectedBarberId || !selectedServiceId ? (
                                    <p className="message small">Select a Service and Barber to see times.</p>
                                ) : (
                                    <div className="slots-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '10px'}}>
                                        
                                        {/* 🟢 THE TIMEZONE FIX FOR SLOTS 🟢 */}
                                        {availableSlots.length > 0 ? availableSlots.map(slot => (
                                            <button 
                                                type="button" 
                                                key={slot} 
                                                className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => setSelectedSlot(slot)}
                                                style={{fontSize: '0.8rem', padding: '8px'}}
                                            >
                                                {formatNaiveTime(slot)}
                                            </button>
                                        )) : (
                                            <p className="empty-text" style={{gridColumn: '1/-1'}}>No slots available for this date.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedServiceId && (
                                <div style={{
                                    marginTop: '15px',
                                    padding: '12px',
                                    background: 'rgba(255, 149, 0, 0.1)', 
                                    border: '1px solid var(--primary-orange)',
                                    borderRadius: '8px',
                                    color: 'var(--primary-orange)',
                                    fontSize: '0.9rem',
                                    textAlign: 'center'
                                }}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                                        <span>Service Price:</span>
                                        <strong>₱{services.find(s => s.id.toString() === selectedServiceId)?.price_php}</strong>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                                    <span>Appointment Fee:</span>
                                    <strong>+ ₱{vipPrice}.00</strong>
                                    </div>
                                    <hr style={{borderColor: 'rgba(255, 149, 0, 0.3)', margin: '5px 0'}} />
                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem'}}>
                                        <strong>Total Estimate:</strong>
                                        <strong>
                                            ₱{(parseFloat(services.find(s => s.id.toString() === selectedServiceId)?.price_php || 0) + vipPrice).toFixed(2)}
                                        </strong>
                                    </div>
                                    <p style={{margin: '8px 0 0 0', fontSize: '0.75rem', opacity: 0.8}}>
                                        *Fee guarantees your time slot. Payable at the shop.
                                    </p>
                                </div>
                            )}
                            <button type="submit" disabled={isLoading || !selectedSlot} className="btn btn-primary btn-full-width" style={{marginTop: '20px'}}>
                                {isLoading ? 'Booking...' : 'Confirm Booking'}
                            </button>
                        </form>
                    )}
                    
                    {message && (
                        <p className={`message ${
                            message.toLowerCase().includes('success') ? 'success' : 
                            /failed|error|required|taken|invalid|missing|please|cannot/i.test(message) ? 'error' : 'success'
                        }`}>
                            {message}
                        </p>
                    )}
                </div>
            )}

            {viewMode === 'join' && myQueueEntryId && (
                <div className="live-queue-view card-body">
                    {myQueueEntry?.status === 'In Progress' && (<div className="status-banner in-progress-banner"><h2><IconCheck /> It's Your Turn!</h2><p>The barber is calling you now.</p></div>)}
                    {myQueueEntry?.status === 'Up Next' && (
                        <div className={`status-banner up-next-banner ${myQueueEntry.is_confirmed ? 'confirmed-pulse' : ''}`}>
                            <h2><IconNext /> You're Up Next!</h2>
                            
                            {optimisticMessage ? (
                                <p className="success-message small" style={{textAlign: 'center'}}>{optimisticMessage}</p>
                            ) : myQueueEntry.is_confirmed ? (
                                <p><strong>✅ Confirmed!</strong> Please sit in the waiting area.</p>
                            ) : (
                                <>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'0.9rem', color:'var(--text-secondary)'}}>
                                        <span>
                                            {travelDirection === 'closing' ? '⬇️ Closing in...' : travelDirection === 'away' ? '⬆️ Moving away...' : '📍 Location active'}
                                        </span>
                                        <span>
                                            Est. Arrival: <strong>{etaMinutes !== null ? `${etaMinutes} min` : 'Calc...'}</strong>
                                        </span>
                                    </div>

                                    {hasArrived ? (
                                        <div style={{animation: 'pulse-border 2s infinite', borderRadius:'6px'}}>
                                            <p style={{color: 'var(--success-color)', fontWeight:'bold', margin:'5px 0'}}>
                                                🎯 You have arrived!
                                            </p>
                                            <button onClick={handleConfirmAttendance} className="btn btn-success btn-full-width">
                                                Tap to Check-In ✅
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{opacity: 0.8}}>
                                            <p style={{fontSize:'0.85rem', margin:'0 0 10px 0'}}>
                                                Please move closer to the shop to check in.
                                            </p>
                                            <button disabled className="btn btn-secondary btn-full-width">
                                                🔒 Moving Closer... ({lastDistanceRef.current ? Math.round(lastDistanceRef.current) : '?'}m)
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {freeBarber && (
                        <div style={{
                            background: 'linear-gradient(45deg, #ff9500, #ffcc00)',
                            color: 'black',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            boxShadow: '0 4px 15px rgba(255, 149, 0, 0.3)',
                            animation: 'pulse-border 2s infinite' 
                        }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px'}}>
                                <span style={{fontSize: '1.5rem'}}>⚡</span>
                                <h3 style={{margin: 0, fontSize: '1.1rem', fontWeight: '800'}}>Faster Seat Available!</h3>
                            </div>
                            <p style={{margin: '0 0 10px 0', fontSize: '0.9rem'}}>
                                <strong>{freeBarber.full_name}</strong> is free right now.
                            </p>
                            <button 
                                onClick={handleSelfTransfer}
                                className="btn"
                                style={{
                                    background: 'black',
                                    color: '#ff9500',
                                    border: 'none',
                                    fontWeight: 'bold',
                                    width: '100%'
                                }}
                            >
                                Switch to {freeBarber.full_name}
                            </button>
                        </div>
                    )}
                    <h2>Live Queue for {joinedBarberId ? currentBarberName : '...'}</h2>
                    <div className="queue-number-display">
                        Your Queue Number is: 
                        <strong>#{liveQueue.find(e => e.id.toString() === myQueueEntryId)?.daily_number || myQueueEntryId}</strong>
                    </div>
                    <div className="current-serving-display">
                        <div className="serving-item now-serving"><span>Now Serving</span><strong>{nowServing ? `Customer #${nowServing.id}` : '---'}</strong></div>
                        <div className="serving-item up-next"><span>Up Next</span><strong>{upNext ? `Customer #${upNext.id}` : '---'}</strong></div>
                    </div>
                    {queueMessage && <p className="message warning">{queueMessage}</p>}
                    <div className="ewt-container">
                        <div className="ewt-item"><span>Currently waiting</span><strong>{peopleWaiting} {peopleWaiting === 1 ? 'person' : 'people'}</strong></div>
                        <div className="ewt-item"><span>Expected Time</span><strong>{finishTime > 0 ? new Date(finishTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Calculating...'}</strong></div>
                    </div>
                    <div 
                        onClick={() => window.open(CAFE_AD.locationLink, '_blank')}
                        style={{
                            margin: '15px 0',
                            background: 'linear-gradient(to right, #3e2723, #5d4037)', 
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            border: '1px solid #795548',
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            position: 'absolute', top: 10, right: 10,
                            background: '#ffc107', color: 'black',
                            fontSize: '0.65rem', fontWeight: 'bold',
                            padding: '2px 6px', borderRadius: '4px',
                            zIndex: 2
                        }}>
                            WAITING AREA PARTNER
                        </div>

                        <div style={{display: 'flex', alignItems: 'center'}}>
                            <div style={{
                                width: '100px', 
                                height: '100px', 
                                background: `url(${CAFE_AD.image}) center/cover no-repeat`,
                                flexShrink: 0
                            }}></div>

                            <div style={{padding: '10px 15px', textAlign: 'left', flex: 1}}>
                                <h4 style={{
                                    margin: '0 0 4px 0', 
                                    color: '#fff', 
                                    fontSize: '1.4rem', 
                                    fontFamily: 'Blanka, sans-serif', 
                                    letterSpacing: '2px', 
                                    textTransform: 'uppercase'
                                }}>
                                    ☕ {CAFE_AD.name}
                                </h4>
                                <p style={{margin: 0, fontSize: '0.8rem', color: '#d7ccc8', lineHeight: '1.3'}}>
                                    {CAFE_AD.pitch}
                                </p>
                                <div style={{
                                    marginTop: '6px', 
                                    fontSize: '0.7rem', 
                                    color: '#ffc107', 
                                    fontWeight: '600'
                                }}>
                                    {CAFE_AD.perks}
                                </div>
                                
                                <div style={{
                                    marginTop: '8px', 
                                    display: 'inline-block',
                                    background: 'rgba(255,255,255,0.2)', 
                                    padding: '4px 8px', 
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    color: 'white'
                                }}>
                                    📍 Tap for Location
                                </div>
                            </div>
                        </div>
                    </div>
                    <ul className="queue-list live">
                        {isQueueLoading ? (
                            <li className="empty-text">Loading queue...</li>
                        ) : (!isQueueLoading && liveQueue.length === 0 && !queueMessage ? (
                            <li className="empty-text">Queue is empty.</li>
                        ) : (
                            liveQueue.map((entry, index) => {
                                if (entry.is_ghost) {
                                    return (
                                        <li key={entry.id} className="queue-item ghost-slot" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 10px'}}>
                                            <div className="queue-item-info">
                                                <span style={{color:'var(--text-secondary)', marginRight:'5px'}}>{index + 1}.</span>
                                                
                                                {/* 🟢 THE GHOST SLOT TIMEZONE FIX 🟢 */}
                                                <strong style={{color:'var(--text-secondary)'}}>📅 {formatNaiveTime(entry.display_time)} - Reserved</strong>
                                            </div>
                                            <span className="status-badge" style={{
                                                background:'rgba(128, 128, 128, 0.1)', 
                                                color:'var(--text-secondary)', 
                                                border:'1px solid var(--border-color)',
                                                fontSize:'0.75rem',
                                                padding:'2px 8px',
                                                borderRadius:'4px'
                                            }}>
                                                Booked
                                            </span>
                                        </li>
                                    );
                                }

                                return (
                                    <li key={entry.id} className={`${entry.id.toString() === myQueueEntryId ? 'my-position' : ''} ${entry.status === 'Up Next' ? 'up-next-public' : ''} ${entry.status === 'In Progress' ? 'in-progress-public' : ''} ${entry.is_vip ? 'vip-entry' : ''}`}>
                                        <div className="queue-item-info">
                                            <span>{index + 1}. </span>
                                            {entry.id.toString() === myQueueEntryId ? (
                                                <strong>You ({entry.customer_name})</strong>
                                            ) : (
                                                <span>{entry.customer_name}</span>
                                            )}
                                        </div>
                                        <span className="public-queue-status">{entry.status}</span>
                                    </li>
                                );
                            })
                        ))}
                    </ul>
                    <div className="live-queue-actions">
{!isGuest && myQueueEntryId && (<div className="form-group photo-upload-group live-update-group">
                            <label>Update Haircut Photo ({myQueueEntry?.daily_number || '#' + myQueueEntryId}):</label>
                            <p className="message small">Already in queue? Update your photo anytime.</p>
                            <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} id="file-upload-update" className="file-upload-input" />
                            <label htmlFor="file-upload-update" className="btn btn-secondary btn-icon-label file-upload-label"><IconUpload />{selectedFile ? selectedFile.name : 'Choose a file...'}</label>
                            <button type="button" onClick={() => handleUploadPhoto(myQueueEntryId)} disabled={!selectedFile || isUploading} className="btn btn-secondary btn-icon-label">
                                <IconUpload />
                                {isUploading ? 'Uploading...' : 'Replace Photo'}
                            </button>
                            {myQueueEntry?.reference_image_url && <p className="success-message small">Current Photo: <a href={myQueueEntry.reference_image_url} target="_blank" rel="noopener noreferrer">View</a></p>}
                            {referenceImageUrl && referenceImageUrl !== myQueueEntry?.reference_image_url && <p className="success-message small">New photo uploaded.</p>}
                        </div>)}
                        <div className="chat-section">
                            {!isChatOpen && myQueueEntryId && !isGuest && (<button onClick={() => {
                                if (currentChatTargetBarberUserId) {
                                    fetchChatHistory(myQueueEntryId);
                                    setIsChatOpen(true);
                                    setHasUnreadFromBarber(false);
                                    axios.put(`${API_URL}/chat/read`, { queueId: myQueueEntryId, readerId: session.user.id });
                                } else { console.error("Barber user ID missing."); setMessage("Cannot initiate chat."); }
                            }} className="btn btn-secondary btn-full-width btn-icon-label chat-toggle-button">
                                <IconChat />Chat with Barber{hasUnreadFromBarber && (<span className="notification-badge"></span>)}</button>)}
                            {isChatOpen && currentChatTargetBarberUserId && !isGuest && (
                                <div className="chat-window-container">
                                    <div className="chat-window-header">
                                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                            <h4>Chat with {currentBarberName}</h4>

                                            <button
                                            onClick={() => setReportModalOpen(true)} 
                                                className="btn btn-danger btn-icon" 
                                                title="Report Issue / Help"
                                                style={{padding: '2px', width: '24px', height: '24px'}} 
                                            >
                                                ❓
                                            </button>
                                        </div>

                                        <button onClick={() => setIsChatOpen(false)} className="btn btn-icon btn-close-chat" title="Close Chat">
                                            <IconX />
                                        </button>
                                    </div>

                                    <ChatWindow 
                                        currentUser_id={session.user.id} 
                                        otherUser_id={currentChatTargetBarberUserId} 
                                        messages={chatMessagesFromBarber} 
                                        onSendMessage={sendCustomerMessage} 
                                    />

                                    <ReportModal 
                                        isOpen={isReportModalOpen} 
                                        onClose={() => setReportModalOpen(false)}
                                        reporterId={session.user.id}
                                        reportedId={currentChatTargetBarberUserId}
                                        userRole="customer" 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="danger-zone">
                        <button 
                            onClick={() => {
                                if (window.confirm("Are you sure? You will lose your spot in line and have to start over!")) {
                                    handleReturnToJoin(true);
                                }
                            }} 
                            disabled={isLoading} 
                            className='btn btn-danger btn-full-width'
                        >
                            {isLoading ? 'Leaving...' : 'Leave Queue / Join Another'}
                        </button>
                    </div>
                </div>
            )}

            {/* C. HISTORY VIEW - Hidden for guests */}
            {viewMode === 'history' && !isGuest && (
                <div className="card-body history-view">
                    {loyaltyData && (
                        <div style={{
                            marginBottom: '20px',
                            padding: '15px',
                            background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.15), rgba(255, 149, 0, 0.05))',
                            borderRadius: '12px',
                            border: '1px solid var(--primary-orange)'
                        }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                <h3 style={{margin: 0, color: 'var(--primary-orange)', fontSize: '1.1rem'}}>🎉 Your Loyalty Stats</h3>
                                <span style={{
                                    background: 'var(--primary-orange)',
                                    color: '#000',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                }}>
                                    {loyaltyData.current_tier || 'bronze'}
                                </span>
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                <div style={{textAlign: 'center'}}>
                                    <span style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Total Spent</span>
                                    <span style={{display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)'}}>
                                        ₱{(parseFloat(loyaltyData.total_spent) || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div style={{textAlign: 'center'}}>
                                    <span style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Total Visits</span>
                                    <span style={{display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)'}}>
                                        {loyaltyData.total_visits || 0}
                                    </span>
                                </div>
                                <div style={{textAlign: 'center'}}>
                                    <span style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Points</span>
                                    <span style={{display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-orange)'}}>
                                        {loyaltyData.total_points || 0}
                                    </span>
                                </div>
                                <div style={{textAlign: 'center'}}>
                                    <span style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Lifetime Points</span>
                                    <span style={{display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)'}}>
                                        {loyaltyData.lifetime_points || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
                        <h2 style={{margin: 0}}>My Past Services</h2>
                        <button 
                            onClick={() => setIsMyReportsOpen(true)} 
                            className="btn btn-secondary" 
                            style={{fontSize:'0.85rem', padding:'6px 12px'}}
                        >
                            ⚠️ My Reports
                        </button>
                    </div>
                    {loyaltyHistory.length === 0 ? (
                        <p className="empty-text">No past services found. Book your first cut!</p>
                    ) : (
                        <ul className="history-list">
                            {loyaltyHistory.map((entry, index) => {
                                const statusClass = entry.status === 'Done' ? 'done' : 'cancelled';
                                const barberName = entry.barber_profiles?.full_name || 'Unrecorded Barber';

                                const basePrice = parseFloat(entry.services?.price_php || 0);
                                const heads = entry.head_count || 1; 
                                const vipFee = entry.is_vip ? 100 : 0;
                                
                                const tip = entry.tip_amount ? parseFloat(entry.tip_amount) : 0;

                                const totalCost = (basePrice * heads) + (vipFee * heads) + tip;

                                return (
                                    <li key={index} className={`history-item ${statusClass}`}>
                                        <div className="history-details">
                                            <span className="date">
                                                {new Date(entry.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="service">
                                                {entry.services?.name || 'Unknown Service'}
                                            </span>
                                            
                                            {entry.is_vip && (
                                                <span className="status-badge" style={{ 
                                                    backgroundColor: 'rgba(255, 149, 0, 0.3)', 
                                                    color: 'var(--primary-orange)', 
                                                    border: '1px solid var(--primary-orange)', 
                                                    marginLeft: '8px'
                                                }}>
                                                    VIP
                                                </span>
                                            )}
                                            <span className="status-badge">
                                                {entry.status}
                                            </span>
                                        </div>
                                        
                                        {entry.comments && entry.comments.trim().length > 0 && (
                                            <p className="feedback-comment" style={{paddingLeft: '0', fontStyle: 'normal', marginTop: '5px', color: 'var(--text-primary)'}}>
                                                Comment: "{entry.comments}"
                                            </p>
                                        )}
                                        
                                        <div className="history-meta">
                                            <span className="barber-name">
                                                {barberName}
                                            </span>
                                            
                                            <span className="amount" style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                                                <span style={{fontWeight:'bold'}}>₱{totalCost.toFixed(2)}</span>
                                                
                                                {(heads > 1 || tip > 0) && (
                                                    <small style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>
                                                        {heads > 1 ? `(${heads} pax)` : ''} 
                                                        {tip > 0 ? ` + ₱${tip} tip` : ''}
                                                    </small>
                                                )}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
            
            {/* D. APPOINTMENTS VIEW - Hidden for guests */}
            {viewMode === 'appointments' && !isGuest && (
                <div className="card-body">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                        <h2 style={{margin:0}}>My Bookings</h2>
                        <button onClick={fetchMyAppointments} className="btn btn-secondary btn-icon" title="Refresh">
                            <IconRefresh />
                        </button>
                    </div>

                    {myAppointments.length === 0 ? (
                        <p className="empty-text">No upcoming appointments found.</p>
                    ) : (
                        <ul className="queue-list">
                            {myAppointments.map((appt) => {
                                
                                const safeDateString = appt.scheduled_time ? appt.scheduled_time.split('T')[0] : '';
                                const dateObj = new Date(safeDateString + 'T00:00:00');
                                
                                const isPast = dateObj < new Date();
                                const displayDate = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                                
                                // 🟢 THE TIMEZONE FIX FOR MY BOOKINGS 🟢
                                const displayTime = appt.formatted_time || formatNaiveTime(appt.scheduled_time);
                                
                                let statusColor = 'var(--text-secondary)';
                                let statusBg = 'rgba(0,0,0,0.05)';
                                let statusText = appt.status;

                                if (appt.is_converted_to_queue) {
                                    statusColor = '#007aff'; 
                                    statusBg = 'rgba(0,122,255,0.1)';
                                    statusText = 'Live in Queue';
                                } else if (appt.status === 'confirmed') {
                                    statusColor = 'var(--success-color)';
                                    statusBg = 'rgba(52,199,89,0.1)';
                                    statusText = 'CONFIRMED'; 
                                } else if (appt.status === 'pending') {
                                    statusColor = '#FFD700'; 
                                    statusBg = 'rgba(255, 215, 0, 0.1)';
                                    statusText = 'WAITING FOR RESPONSE'; 
                                } else if (appt.status === 'cancelled') {
                                    statusColor = 'var(--error-color)';
                                    statusBg = 'rgba(255,59,48,0.1)';
                                    statusText = 'DECLINED';
                                }

                                return (
                                    <li key={appt.id} style={{
                                        opacity: isPast && !appt.is_converted_to_queue ? 0.6 : 1, 
                                        borderLeft: `4px solid ${statusColor}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '5px'
                                    }}>
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                            <strong style={{fontSize:'1.1rem'}}>
                                                {displayDate}
                                            </strong>
                                            <span style={{
                                                color: statusColor, 
                                                background: statusBg, 
                                                padding: '2px 8px', 
                                                borderRadius: '4px', 
                                                fontSize: '0.8rem', 
                                                fontWeight:'bold',
                                                textTransform: 'uppercase'
                                            }}>
                                                {statusText}
                                            </span>
                                        </div>
                                        
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.95rem'}}>
                                            <span>🕒 {displayTime}</span>
                                            <span>✂️ {appt.services?.name || 'Service'}</span>
                                        </div>
                                        
                                        <div style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>
                                            Barber: <strong>{appt.barber_profiles?.full_name || 'Any'}</strong>
                                        </div>

                                        {appt.is_converted_to_queue && (
                                            <small style={{color: 'var(--link-color)', marginTop:'5px'}}>
                                                * This booking has been moved to the Live Queue.
                                            </small>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
            
            <MyReportsModal 
                isOpen={isMyReportsOpen} 
                onClose={() => setIsMyReportsOpen(false)} 
                userId={session?.user?.id} 
            />
            {/* --- PRODUCT DETAIL MODAL --- */}
            {viewProduct && (
                <div className="modal-overlay" style={{zIndex: 2000}} onClick={() => setViewProduct(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '350px'}}>
                        
                        <div style={{
                            background: viewProduct.theme.background, 
                            padding: '20px', 
                            textAlign: 'center',
                            borderBottom: `1px solid ${viewProduct.theme.border}`,
                            borderTopLeftRadius: '12px',
                            borderTopRightRadius: '12px'
                        }}>
                            <img 
                                src={viewProduct.image} 
                                alt={viewProduct.title} 
                                style={{
                                    width: '120px', 
                                    height: '120px', 
                                    borderRadius: '10px', 
                                    objectFit: 'cover', 
                                    border: '4px solid white',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                    backgroundColor: '#fff'
                                }} 
                            />
                            <h2 style={{
                                margin: '15px 0 5px 0', 
                                color: viewProduct.theme.text,
                                fontSize: '1.5rem'
                            }}>
                                {viewProduct.title}
                            </h2>
                            <span style={{
                                background: viewProduct.theme.badgeBg,
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold'
                            }}>
                                {viewProduct.badge}
                            </span>
                        </div>

                        <div className="modal-body" style={{textAlign: 'left', padding: '20px'}}>
                            <p style={{fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-primary)'}}>
                                {viewProduct.description}
                            </p>
                            
                            <div style={{
                                marginTop: '20px', 
                                padding: '15px', 
                                background: 'var(--bg-dark)', 
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{color: 'var(--text-secondary)'}}>Price:</span>
                                <strong style={{fontSize: '1.4rem', color: 'var(--primary-orange)'}}>
                                    {viewProduct.price}
                                </strong>
                            </div>
                            
                            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '15px', textAlign: 'center'}}>
                                To buy this, simply show this screen to the barber at the counter.
                            </p>
                        </div>

                        <div className="modal-footer single-action">
                            <button onClick={() => setViewProduct(null)} className="btn btn-primary btn-full-width">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}