import { useCallback, useEffect, useState } from "react";
import { API_URL } from "./http-commons";
import { supabase } from "./supabase";
import { DistanceBadge } from "./Partials/DistanceBadge";
import { ChatWindow } from "./ChatWindow";
import { ReportModal } from "./modals/ReportModal";
import { 
    IconCamera,
    IconCheck,
    IconX,
    IconNext,
    IconChat,
    IconRefresh,

} from "./assets/Icon";
import { playSound } from "./helpers/utils";
import { messageNotificationSound } from "../App";
import axios from "axios";

export const BarberDashboard = ({ barberId, barberName, onCutComplete, session, onQueueUpdate }) => {

    const [queueDetails, setQueueDetails] = useState({ waiting: [], inProgress: null, upNext: null });
    const [error, setError] = useState('');
    const [fetchError, setFetchError] = useState('');
    const [chatMessages, setChatMessages] = useState({});
    const [openChatCustomerId, setOpenChatCustomerId] = useState(null);
    const [openChatQueueId, setOpenChatQueueId] = useState(null);

    const [modalState, setModalState] = useState({ type: null, data: null });
    const [viewImageModalUrl, setViewImageModalUrl] = useState(null);
    const [tipInput, setTipInput] = useState('');
    const [modalError, setModalError] = useState('');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportTargetId, setReportTargetId] = useState(null);
    const [isApptListOpen, setIsApptListOpen] = useState(false);
    const [barberAppointments, setBarberAppointments] = useState([]);
    const [loadingAppts, setLoadingAppts] = useState(false);
    
    const upNext = queueDetails.upNext;
    const isHighRisk = upNext && (upNext.current_distance_meters > 500); // Risk if > 500m

    const fetchBarberAppointments = async () => {
        setLoadingAppts(true);
        try {
            const res = await axios.get(`${API_URL}/appointments/barber/${barberId}`);
            setBarberAppointments(res.data || []);
            setIsApptListOpen(true);
        } catch (err) {
            alert("Failed to load appointments.");
        } finally {
            setLoadingAppts(false);
        }
    };
    const handleRejectAppointment = async (apptId) => {
        const reason = prompt("Reason for cancellation? (e.g., Emergency, Shop Closed)");
        if (!reason) return; // Stop if they cancel the prompt

        try {
            await axios.put(`${API_URL}/appointments/reject`, {
                appointmentId: apptId,
                reason: reason
            });
            alert("Appointment cancelled. Customer has been notified.");
            fetchBarberAppointments(); // Refresh the list
        } catch (err) {
            alert("Failed to cancel appointment.");
        }
    };
    const handleLoyaltyCheck = async (customer) => {
        if (!customer.customer_email) {
            setModalState({ 
                type: 'alert', 
                data: { title: 'Loyalty Check Failed', message: `Customer ${customer.customer_name} joined as a guest (no email recorded).` } 
            });
            return;
        }

        setModalState({ type: 'loyaltyLoading', data: { name: customer.customer_name } });

        try {
            const response = await axios.get(`${API_URL}/barber/customer-loyalty/${customer.customer_email}`);

            setModalState({ 
                type: 'loyaltyResult', 
                data: { 
                    name: customer.customer_name,
                    email: customer.customer_email,
                    count: response.data.count,
                    history: response.data.history
                } 
            });

        } catch (err) {
            console.error('Failed loyalty check:', err);
            setModalState({ 
                type: 'alert', 
                data: { title: 'Loyalty Check Error', message: err.response?.data?.error || 'Failed to retrieve history from server.' } 
            });
        }
    };

     // --- FIND THIS FUNCTION INSIDE BarberDashboard ---
    const fetchQueueDetails = useCallback(async () => {
        if (!barberId) return;
        setFetchError('');
        try {
            const response = await axios.get(`${API_URL}/queue/details/${barberId}`);
            let data = response.data;

            // --- 🟢 FIX START: Force Badge to 0 if Chat is Open ---
            // This prevents the "Badge Reappearing" bug caused by server lag
            if (openChatQueueId) {
                const clearBadge = (entry) => {
                    // If this customer matches the chat I have open...
                    if (entry && entry.id === openChatQueueId) {
                        return { ...entry, unread_count: 0 }; // ...force badge to 0 locally.
                    }
                    return entry;
                };

                // Apply this fix to all lists
                if (data.inProgress) data.inProgress = clearBadge(data.inProgress);
                if (data.upNext) data.upNext = clearBadge(data.upNext);
                if (data.waiting) data.waiting = data.waiting.map(clearBadge);
            }
            // --- 🟢 FIX END ---

            setQueueDetails(data);
        } catch (err) {
            console.error('[BarberDashboard] Queue fetch error:', err);
        }
    }, [barberId, openChatQueueId]); // <--- CRITICAL: Add openChatQueueId to dependency array// <--- CRITICAL: Depends on openChatQueueId// <--- Added openChatQueueId so it updates when you open/close chats

    useEffect(() => {
        if (!openChatQueueId) return;

        console.log(`[Barber] Subscribing to chat for Queue #${openChatQueueId}`);
        
        const chatChannel = supabase.channel(`barber_chat_${openChatQueueId}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'chat_messages', 
                    filter: `queue_entry_id=eq.${openChatQueueId}` 
                }, 
                (payload) => {
                    const newMsg = payload.new;
                    
                    // --- THE FIX IS HERE ---
                    // Only update state if the message is NOT from me (the Barber).
                    // This prevents the "Double Bubble" because sendBarberMessage already added it.
                    if (newMsg.sender_id !== session.user.id) {
                        setChatMessages(prev => {
                            const customerId = openChatCustomerId; 
                            const msgs = prev[customerId] || [];
                            return { ...prev, [customerId]: [...msgs, { senderId: newMsg.sender_id, message: newMsg.message, created_at: newMsg.created_at }] };
                        });

                        playSound(messageNotificationSound);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [openChatQueueId, openChatCustomerId, session]);

    useEffect(() => {
        if (!barberId || !supabase) return;

        console.log("🎧 Listening for incoming customer messages...");

        const chatChannel = supabase.channel(`barber_global_chat_listener`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                (payload) => {
                    const newMsg = payload.new;

                    // 1. Ignore messages sent by ME (the barber)
                    if (newMsg.sender_id === session.user.id) return;

                    // 2. Ignore if I already have this specific chat window OPEN
                    if (openChatQueueId === newMsg.queue_entry_id) {
                        // Optional: Mark as read immediately since we are looking at it
                        axios.put(`${API_URL}/chat/read`, { 
                            queueId: newMsg.queue_entry_id, 
                            readerId: session.user.id 
                        });
                        return;
                    }

                    // 3. Find the customer in the queue and increment their badge
                    setQueueDetails(prev => {
                        const incrementBadge = (entry) => {
                            if (entry && entry.id === newMsg.queue_entry_id) {
                                console.log(`🔔 New message from ${entry.customer_name}! Incrementing badge.`);
                                return { ...entry, unread_count: (entry.unread_count || 0) + 1 };
                            }
                            return entry;
                        };

                        // Check all lists
                        return {
                            ...prev,
                            inProgress: incrementBadge(prev.inProgress),
                            upNext: incrementBadge(prev.upNext),
                            waiting: prev.waiting.map(incrementBadge)
                        };
                    });

                    // 4. Alert Sound
                    playSound(messageNotificationSound);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(chatChannel); };
    }, [barberId, openChatQueueId, session.user.id]);

    // --- UPDATE SEND FUNCTION ---
    const sendBarberMessage = async (recipientId, messageText) => {
        if (!messageText.trim() || !openChatQueueId) return;

        // Optimistic UI Update
        setChatMessages(prev => {
            const msgs = prev[recipientId] || [];
            return { ...prev, [recipientId]: [...msgs, { senderId: session.user.id, message: messageText, created_at: new Date().toISOString() }] };
        });

        try {
            await axios.post(`${API_URL}/chat/send`, {
                senderId: session.user.id,
                queueId: openChatQueueId,
                message: messageText
            });
        } catch (error) {
            console.error("Failed to send:", error);
            // Handle error (toast notification?)
        }
    };
    // UseEffect for initial load and realtime subscription
    useEffect(() => {
        if (!barberId || !supabase?.channel) return;
        let dashboardRefreshInterval = null;
        fetchQueueDetails();
        const channel = supabase.channel(`barber_queue_${barberId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `barber_id=eq.${barberId}` }, (payload) => {
                console.log('Barber dashboard received queue update (via Realtime):', payload);
                fetchQueueDetails();
                if (onQueueUpdate) onQueueUpdate();
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Barber dashboard subscribed to queue ${barberId}`);
                } else if (status === 'CLOSED') {
                    // This is normal cleanup, just log it as info
                    console.log(`Barber dashboard subscription disconnected cleanly.`);
                } else {
                    // Only log actual errors (like CHANNEL_ERROR or TIMED_OUT)
                    console.error(`Barber dashboard subscription error: ${status}`, err);
                }
            });

        // --- START OF FIX ---
        dashboardRefreshInterval = setInterval(() => { 
            console.log('Dashboard periodic refresh...'); 
            fetchQueueDetails(); 
            
            if (onQueueUpdate) onQueueUpdate(); 
        }, 15000);
        // --- END OF FIX ---

        return () => {
            if (channel) supabase.removeChannel(channel);
            if (dashboardRefreshInterval) clearInterval(dashboardRefreshInterval);
        };
    }, [barberId, fetchQueueDetails, onQueueUpdate]); // <-- Add setUnreadMessages here

    // --- Handlers ---
    const closeModal = () => {
        setModalState({ type: null, data: null });
        setTipInput('');
        setModalError('');
    };
    const handleNextCustomer = async () => {
        // --- 1. NEW SAFETY GAP CHECK ---
        const nextAppt = queueDetails.nextAppointment; 
        if (nextAppt) {
            const apptTime = new Date(nextAppt.scheduled_time);
            const now = new Date();
            const diffInMinutes = Math.floor((apptTime - now) / 60000);

            // Warn if appointment is within 30 minutes
            if (diffInMinutes <= 30 && diffInMinutes >= -10) {
                const confirmMsg = `⚠️ SAFETY WARNING ⚠️\n\nYou have an appointment with ${nextAppt.customer_name} at ${apptTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (in ${diffInMinutes} mins).\n\nTaking a walk-in now might make you late. Are you sure?`;
                if (!window.confirm(confirmMsg)) return; 
            }
        }
        // -------------------------------

        const next = queueDetails.upNext || (queueDetails.waiting.length > 0 ? queueDetails.waiting[0] : null);
        if (!next) {
            setModalState({ type: 'alert', data: { title: 'Queue Empty', message: 'There are no customers waiting to be called.' } });
            return;
        }
        if (queueDetails.inProgress) {
            setModalState({ type: 'alert', data: { title: 'Action Required', message: `Please complete ${queueDetails.inProgress.customer_name} first before calling the next customer.` } });
            return;
        }
        setError('');
        try { await axios.put(`${API_URL}/queue/next`, { queue_id: next.id, barber_id: barberId }); }
        catch (err) { console.error('Failed next customer:', err); setError(err.response?.data?.error || 'Failed call next.'); }
    };
    const handleCompleteCut = async () => {
        if (!queueDetails.inProgress) return;
        setModalState({ type: 'tipPrompt', data: queueDetails.inProgress });
        setModalError('');
        setTipInput('');
    };
    const handleSubmitTipForm = async (e) => {
        e.preventDefault();
        const entry = modalState.data;
        if (!entry) return;

        // --- GROUP & VIP LOGIC UPDATE ---
        const queueId = entry.id;
        const heads = entry.head_count || 1; 
        const servicePrice = parseFloat(entry.services?.price_php) || 0;
        
        // 1. Calculate Base Service Total (Price x Heads)
        const baseTotal = servicePrice * heads;
        
        // 2. Calculate VIP Charge (100 x Heads)
        const isVIP = entry.is_vip === true;
        const vipCharge = isVIP ? (100 * heads) : 0; // <--- CHANGED HERE
        
        // 3. Total before tip
        const subtotalDue = baseTotal + vipCharge;
        
        const parsedTip = parseInt(tipInput || '0');

        if (isNaN(parsedTip) || parsedTip < 0) {
            setModalError('Invalid tip. Please enter 0 or more.');
            return;
        }

        const finalLoggedProfit = subtotalDue + parsedTip;
        setError('');
        
        try {
            await axios.post(`${API_URL}/queue/complete`, {
                queue_id: queueId,
                barber_id: barberId,
                tip_amount: parsedTip,
                vip_charge: vipCharge, // Sends the full multiplied amount (e.g., 400)
            });
            onCutComplete();
            setModalState({ 
                type: 'alert', 
                data: { 
                    title: 'Cut Completed!', 
                    message: `Total logged profit: ₱${finalLoggedProfit.toFixed(2)} (Group of ${heads})` 
                } 
            });
        } catch (err) {
            console.error('Failed complete cut:', err);
            setError(err.response?.data?.error || 'Failed to complete cut.');
            closeModal();
        }
    };
    const handleCancel = async (customerToCancel) => {
        if (!customerToCancel) return;
        setModalState({ type: 'confirmCancel', data: customerToCancel });
    };
    const handleConfirmCancel = async () => {
        const customerToCancel = modalState.data;
        if (!customerToCancel) return;
        console.log("[handleCancel] Sending PUT request to /api/queue/cancel", { queue_id: customerToCancel.id, barber_id: barberId });
        setError('');
        try {
            await axios.put(`${API_URL}/queue/cancel`, {
                queue_id: customerToCancel.id,
                barber_id: barberId
            });
        } catch (err) {
            console.error('[handleCancel] Failed to cancel customer:', err.response?.data || err.message);
            setError(err.response?.data?.error || 'Failed to mark as cancelled.');
        } finally {
            closeModal();
        }
    };

    const openChat = async (customer) => {
        const customerUserId = customer?.profiles?.id;
        const queueId = customer?.id;

        if (customerUserId && queueId) {
            console.log(`[openChat] Opening chat for ${customerUserId} on queue ${queueId}`);
            setOpenChatCustomerId(customerUserId);
            setOpenChatQueueId(queueId);

            // 1. SERVER: Mark messages as Read
            axios.put(`${API_URL}/chat/read`, { 
                queueId: queueId, 
                readerId: session.user.id 
            }).catch(err => console.error("Failed to mark messages as read:", err));

            // 2. LOCAL UI: Remove Badge Immediately (Optimistic Update)
            setQueueDetails(prev => {
                const updateEntry = (entry) => {
                    if (entry && entry.id === queueId) {
                        return { ...entry, unread_count: 0 };
                    }
                    return entry;
                };

                return {
                    ...prev,
                    inProgress: updateEntry(prev.inProgress),
                    upNext: updateEntry(prev.upNext),
                    waiting: prev.waiting.map(updateEntry)
                };
            });

            // 3. DATA: Fetch Chat History
            const fetchHistory = async () => {
                try {
                    const { data, error } = await supabase
                        .from('chat_messages')
                        .select('sender_id, message, created_at')
                        .eq('queue_entry_id', queueId)
                        .order('created_at', { ascending: true });
                    
                    if (error) throw error;

                    const formattedHistory = data.map(msg => ({ 
                        senderId: msg.sender_id, 
                        message: msg.message,
                        created_at: msg.created_at
                    }));
                    
                    setChatMessages(prev => ({ 
                        ...prev, 
                        [customerUserId]: formattedHistory 
                    }));
                } catch (err) { 
                    console.error("Barber failed to fetch history:", err); 
                }
            };
            fetchHistory();

        } else { 
            console.error("Cannot open chat: Customer user ID or Queue ID missing.", customer); 
            setError("Could not get customer details."); 
        }
    };

    const closeChat = () => { setOpenChatCustomerId(null); setOpenChatQueueId(null); };

    // REPLACE the old PhotoDisplay component with this:
    const PhotoDisplay = ({ entry, label }) => {
        if (!entry?.reference_image_url) return null;
        return (
            <div className="barber-photo-display">
                <button 
                    type="button" 
                    onClick={() => setViewImageModalUrl(entry.reference_image_url)}
                    className="btn-link-style"
                >
                    <IconCamera /> {label} Photo
                </button>
            </div>
        );
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2>My Queue ({barberName || '...'})</h2>
            </div>
            <div className="card-body">
                {fetchError && <p className="error-message large">Error loading queue: {fetchError}</p>}
                {!fetchError && (
                    <>
                        <div className="current-serving-display" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            <div className="serving-item now-serving" style={{ flex: '1 1 150px' }}><span>Now Serving</span><strong>{queueDetails.inProgress ? `Customer #${queueDetails.inProgress.id}` : '---'}</strong></div>
                            <div className="serving-item up-next" style={{ flex: '1 1 150px' }}><span>Up Next</span><strong>{queueDetails.upNext ? `Customer #${queueDetails.upNext.id}` : '---'}</strong></div>
                        </div>
                        {error && !fetchError && <p className="error-message">{error}</p>}
                        
                        <div className="action-buttons-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                            {queueDetails.inProgress ? (
                                <>
                                    <button onClick={handleCompleteCut} className="btn btn-success btn-full-width btn-icon-label">
                                        <IconCheck /> Complete: #{queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}
                                    </button>
                                    <button onClick={() => handleCancel(queueDetails.inProgress)} className="btn btn-danger btn-full-width btn-icon-label">
                                        <IconX /> Cancel / No-Show
                                    </button>
                                </>
                            ) : queueDetails.upNext ? (
                                <button onClick={handleNextCustomer} className="btn btn-primary btn-full-width btn-icon-label">
                                    <IconNext /> Call: #{queueDetails.upNext.id} - {queueDetails.upNext.customer_name}
                                </button>
                            ) : queueDetails.waiting.length > 0 ? (
                                <button onClick={handleNextCustomer} className="btn btn-primary btn-full-width btn-icon-label">
                                    <IconNext /> Call: #{queueDetails.waiting[0].id} - {queueDetails.waiting[0].customer_name}
                                </button>
                            ) : (<button onClick={handleNextCustomer} className="btn btn-primary btn-full-width btn-icon-label">
                                <IconNext /> Call Next Customer
                                </button>
                            )}
                        </div>

                        <h3 className="queue-subtitle">In Chair</h3>
                        {queueDetails.inProgress ? (
                            <ul className="queue-list">
                                <li className={`in-progress ${queueDetails.inProgress.is_vip ? 'vip-entry' : ''}`}>
                                    <div className="queue-item-info">
                                        <strong>#{queueDetails.inProgress.daily_number || queueDetails.inProgress.id} - {queueDetails.inProgress.customer_name}</strong>

                                        <DistanceBadge meters={queueDetails.inProgress.current_distance_meters} />
                                        <PhotoDisplay entry={queueDetails.inProgress} label="In Chair" />
                                        <button 
                                            onClick={() => handleLoyaltyCheck(queueDetails.inProgress)} 
                                            className="btn btn-link-style" 
                                            title="Check Customer Loyalty History"
                                            style={{padding: '5px 0'}}
                                        >
                                            ⭐ Check Loyalty
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => openChat(queueDetails.inProgress)} 
                                        className="btn btn-icon" 
                                        title="Chat"
                                        disabled={!queueDetails.inProgress.profiles?.id}
                                        style={{position: 'relative'}}
                                    >
                                        <IconChat />
                                        {/* BADGE LOGIC */}
                                        {queueDetails.inProgress.unread_count > 0 && (
                                            <span className="notification-badge">
                                                {queueDetails.inProgress.unread_count}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            </ul>
                        ) : (<p className="empty-text">Chair empty</p>)}

                        <h3 className="queue-subtitle">Up Next</h3>
                        {upNext ? (
                            <ul className="queue-list">
                                <li 
                                    className={`up-next ${upNext.is_vip ? 'vip-entry' : ''}`}
                                    style={{
                                        // DYNAMIC STYLING: Red border/bg if high risk, Orange (default) otherwise
                                        borderLeft: isHighRisk ? '5px solid #ff3b30' : '5px solid var(--primary-orange)',
                                        background: isHighRisk ? 'rgba(255, 59, 48, 0.05)' : 'var(--bg-dark)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="queue-item-info">
                                        <strong>#{upNext.id} - {upNext.customer_name}</strong>
                                        
                                        {/* --- ⚠️ THE RISK BADGE (Only shows if > 500m) --- */}
                                        {isHighRisk && (
                                            <div style={{
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: '5px',
                                                color: '#ff3b30', 
                                                fontWeight: 'bold', 
                                                fontSize: '0.8rem',
                                                marginTop: '4px', 
                                                background: 'rgba(255, 59, 48, 0.1)',
                                                padding: '2px 6px', 
                                                borderRadius: '4px',
                                                border: '1px solid rgba(255, 59, 48, 0.3)'
                                            }}>
                                                ⚠️ FAR AWAY ({upNext.current_distance_meters}m)
                                            </div>
                                        )}
                                        
                                        {/* Show standard Green/Orange badge ONLY if they are safe */}
                                        {!isHighRisk && <DistanceBadge meters={upNext.current_distance_meters} />}
                                        
                                        {/* Confirmation Status */}
                                        {upNext.is_confirmed ? (
                                            <span className="badge-confirmed">✅ CONFIRMED</span>
                                        ) : (
                                            <span className="badge-waiting">⏳ Waiting for confirm...</span>
                                        )}
                                        
                                        <PhotoDisplay entry={upNext} label="Up Next" />
                                    </div>
                                    
                                    {/* Chat Button */}
                                    <button 
                                        onClick={() => openChat(upNext)} 
                                        className="btn btn-icon" 
                                        title={upNext.profiles?.id ? "Chat" : "Guest"} 
                                        disabled={!upNext.profiles?.id}
                                    >
                                        <IconChat />
                                        {upNext.profiles?.id && upNext.unread_count > 0 && (
                                            <span className="notification-badge">
                                                {upNext.unread_count}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            </ul>
                        ) : (
                            <p className="empty-text">Nobody Up Next</p>
                        )}

                        <h3 className="queue-subtitle">Waiting</h3>
                        <ul className="queue-list">{queueDetails.waiting.length === 0 ? (<li className="empty-text">Waiting queue empty.</li>) : (queueDetails.waiting.map(c => (
                            <li key={c.id} className={c.is_vip ? 'vip-entry' : ''}>
                                <div className="queue-item-info">
                                    <span>#{c.id} - {c.customer_name}</span>
                                    {(c.head_count && c.head_count > 1) && (
                                    <span className="badge-confirmed" style={{background: '#7c4dff', color: 'white', border: 'none'}}>
                                        👥 Group of {c.head_count}
                                    </span>
    )}
                                    <DistanceBadge meters={c.current_distance_meters} />
                                    {c.reference_image_url && <PhotoDisplay entry={c} label="Waiting" />}
                                </div>
                                {/* REPLACE the Chat Button in "Waiting" loop with this: */}
                                <button 
                                    onClick={() => openChat(c)} 
                                    className="btn btn-icon" 
                                    title="Chat" 
                                    disabled={!c.profiles?.id}
                                    style={{position: 'relative'}}
                                >
                                    <IconChat />
                                    {/* BADGE LOGIC */}
                                    {c.unread_count > 0 && (
                                        <span className="notification-badge">
                                            {c.unread_count}
                                        </span>
                                    )}
                                </button>
                            </li>
                        )))}</ul>

                        {/* REPLACEMENT FOR CHAT SECTION */}
                        {openChatCustomerId && (
                            <div className="barber-chat-container">
                                {/* Header with Report Button */}
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', borderBottom:'1px solid var(--border-color)', background:'var(--surface-color)'}}>
                                    <h4 style={{margin:0}}>Chat with Customer</h4>
                                    <button 
                                        onClick={() => {
                                            setReportTargetId(openChatCustomerId); // <--- Uses reportTargetId
                                            setIsReportModalOpen(true);            // <--- Uses isReportModalOpen
                                        }}
                                        className="btn btn-danger btn-icon" 
                                        title="Report Customer"
                                        style={{padding: '4px', height:'30px', width:'30px'}}
                                    >
                                        ⚠️
                                    </button>
                                </div>

                                <p className="chat-warning">Hey there! Just a friendly nudge to keep the chat open even when your phone’s screen is off.</p>
                                <ChatWindow
                                    currentUser_id={session.user.id}
                                    otherUser_id={openChatCustomerId}
                                    messages={chatMessages[openChatCustomerId] || []}
                                    onSendMessage={sendBarberMessage}
                                    isVisible={!!openChatCustomerId}
                                />
                                <button onClick={closeChat} className="btn btn-secondary btn-full-width">Close Chat</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="card-footer" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                <button onClick={fetchBarberAppointments} className="btn btn-primary btn-icon-label" disabled={loadingAppts}>
                    {/* OLD: {loadingAppts ? <Spinner /> : '📅 Bookings'} */}
                    {/* NEW: Static Text */}
                    📅 Bookings
                </button>
                <button onClick={fetchQueueDetails} className="btn btn-secondary btn-icon-label">
                    <IconRefresh /> Refresh
                </button>
            </div>

            {/* --- MODALS --- */}
            {modalState.type === 'alert' && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-body">
                            <h2>{modalState.data?.title || 'Alert'}</h2>
                            <p>{modalState.data?.message || 'An error occurred.'}</p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeModal} className="btn btn-primary">
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalState.type === 'confirmCancel' && modalState.data && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-body">
                            <h2>Confirm Cancellation</h2>
                            <p>Are you sure you want to mark Customer #{modalState.data.id} ({modalState.data.customer_name}) as Cancelled/No-Show? This will not log earnings.</p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeModal} className="btn btn-secondary">
                                Back
                            </button>
                            <button onClick={handleConfirmCancel} className="btn btn-danger">
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalState.type === 'tipPrompt' && modalState.data && (
                <div className="modal-overlay">
                    <div className="modal-content modal-form">
                        <form onSubmit={handleSubmitTipForm}>
                            <div className="modal-body">
                                <h2>Complete Cut</h2>
                                <p className="modal-form-details">
                                    <strong>Customer:</strong> {modalState.data.customer_name} (#{modalState.data.id})<br/>
                                    
                                    {/* --- NEW: GROUP DISPLAY --- */}
                                    <strong>Heads:</strong> {modalState.data.head_count || 1}<br/> 
                                    
                                    <strong>Service:</strong> {modalState.data.services?.name || 'Service'} 
                                    {' '}(₱{parseFloat(modalState.data.services?.price_php || 0).toFixed(2)} x {modalState.data.head_count || 1})<br/>

                                    {modalState.data.is_vip && (
                                        <>
                                            <div style={{display:'flex', justifyContent:'space-between', color:'var(--primary-orange)'}}>
                                                <span>VIP Fee (₱100 x {modalState.data.head_count || 1}):</span>
                                                {/* SHOW MULTIPLIED VIP FEE */}
                                                <span>+ ₱{(100 * (modalState.data.head_count || 1)).toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}

                                    <hr style={{borderColor:'var(--border-color)', margin:'10px 0'}} />

                                    {/* Total Due Calculation */}
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize: '1.2rem', fontWeight:'bold'}}>
                                        <span>Total Due:</span>
                                        <span style={{color: 'var(--success-color)'}}>
                                            ₱{(
                                                ((parseFloat(modalState.data.services?.price_php || 0)) * (modalState.data.head_count || 1)) + 
                                                (modalState.data.is_vip ? (100 * (modalState.data.head_count || 1)) : 0) // <--- CHANGED HERE
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                </p>
                                
                                <div className="form-group">
                                    <label htmlFor="tipAmount">Enter TIP Amount (Optional):</label>
                                    <input
                                        type="number"
                                        id="tipAmount"
                                        value={tipInput}
                                        onChange={(e) => setTipInput(e.target.value)}
                                        placeholder="e.g., 50"
                                        autoFocus
                                    />
                                </div>
                                {modalError && <p className="message error">{modalError}</p>}
                            </div>
                            
                            <div className="modal-footer">
                                <button onClick={closeModal} type="button" className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Complete & Log Profit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {viewImageModalUrl && (
            <div className="modal-overlay" onClick={() => setViewImageModalUrl(null)}>
                <div 
                    className="modal-content image-modal-content" 
                    onClick={(e) => e.stopPropagation()} /* Prevents modal from closing when clicking the image */
                >
                    <img 
                        src={viewImageModalUrl} 
                        alt="Reference" 
                        className="image-modal-img" 
                    />
                    <div className="modal-footer single-action">
                        <button 
                            onClick={() => setViewImageModalUrl(null)} 
                            className="btn btn-secondary"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Loyalty Loading Modal --- */}
        {modalState.type === 'loyaltyLoading' && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-body">
                        <h2>Loyalty Check</h2>
                        <p>Fetching history for {modalState.data?.name || 'Customer'}...</p>
                    </div>
                    <div className="modal-footer single-action">
                        <button onClick={closeModal} className="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Loyalty Result Modal --- */}
        {modalState.type === 'loyaltyResult' && modalState.data && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-body" style={{textAlign: 'left'}}>
                        <h2>⭐ Loyalty Status</h2>
                        <p>
                            Customer: {modalState.data.name}<br/>
                            Email: {modalState.data.email}
                        </p>

                        <h3 style={{color: modalState.data.count >= 10 ? 'var(--success-color)' : 'var(--primary-orange)', marginTop: '15px'}}>
                            Completed Cuts: {modalState.data.count}
                        </h3>

                        {modalState.data.count >= 10 && (
                            <p className="success-message">
                                Loyalty Achieved! This customer qualifies for a discount.
                            </p>
                        )}

                        <h4 className="queue-subtitle">Past Services:</h4>
                        <ul className="history-list" style={{maxHeight: '200px', overflowY: 'auto'}}>
                            {modalState.data.history.length > 0 ? (
                                modalState.data.history.map((entry, index) => (
                                    <li key={index} className={`history-item ${entry.status === 'Done' ? 'done' : 'cancelled'}`} style={{padding: '10px', marginBottom: '8px'}}>
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
                                        <span 
                                            className="status-badge" 
                                            style={{ margin: '0 10px' }} // Add some spacing
                                        >
                                            {entry.status}
                                        </span>
                                        <span className="date" style={{marginLeft: 'auto'}}>
                                            {new Date(entry.created_at).toLocaleDateString()}
                                        </span>
                                    </li>
                                ))
                            ) : (
                                <p className="empty-text">No service history found.</p>
                            )}
                        </ul>
                    </div>
                    <div className="modal-footer single-action">
                        <button onClick={closeModal} className="btn btn-primary">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
            <ReportModal 
                isOpen={isReportModalOpen}          // <--- Uses isReportModalOpen
                onClose={() => setIsReportModalOpen(false)}
                reporterId={session.user.id}
                reportedId={reportTargetId}         // <--- Uses reportTargetId
                userRole="barber"
            />
            {isApptListOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px'}}>
                            <h2 style={{margin:0}}>📅 Upcoming Bookings</h2>
                            <button onClick={() => setIsApptListOpen(false)} className="btn btn-icon"><IconX /></button>
                        </div>
                        
                        <div className="modal-body" style={{textAlign:'left', maxHeight: '60vh', overflowY: 'auto'}}>
                            {barberAppointments.length === 0 ? (
                                <p className="empty-text">No upcoming appointments found.</p>
                            ) : (
                                <ul className="queue-list">
                                    {barberAppointments.map((appt) => {
                                        const dateObj = new Date(appt.scheduled_time);
                                        // Highlight "Today"
                                        const isToday = new Date().toDateString() === dateObj.toDateString();
                                        
                                        return (
                                            <li key={appt.id} style={{
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '10px',
                                            borderLeft: appt.status === 'pending' ? '4px solid #FFD700' : (isToday ? '4px solid var(--primary-orange)' : '4px solid var(--text-secondary)'), // Yellow for pending
                                            opacity: appt.is_converted_to_queue ? 0.6 : 1,
                                            padding: '10px',
                                            marginBottom: '10px',
                                            background: 'var(--bg-dark)',
                                            borderRadius: '6px',
                                            textAlign: 'center'
                                        }}>
                                            {/* Date & Time */}
                                            <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap: '10px'}}>
                                                <strong style={{fontSize:'1.1rem', color: isToday ? 'var(--primary-orange)' : 'var(--text-primary)'}}>
                                                    {dateObj.toLocaleDateString([], {weekday: 'short', month:'short', day:'numeric'})}
                                                </strong>
                                                <span style={{fontSize:'1.1rem', fontWeight:'bold'}}>
                                                    {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            
                                            {/* Status Badge */}
                                            {appt.status === 'pending' && (
                                                <div style={{background: '#FFD700', color: 'black', fontWeight: 'bold', borderRadius: '4px', fontSize: '0.8rem'}}>
                                                    ⚠️ PENDING APPROVAL
                                                </div>
                                            )}

                                            {/* Customer Name */}
                                            <div style={{fontSize:'1rem'}}>
                                                👤 <strong>{appt.customer_name}</strong>
                                            </div>
                                            
                                            {/* Action Row */}
                                            <div style={{display:'flex', justifyContent:'center', alignItems:'center', marginTop:'5px', gap:'10px'}}>
                                                
                                                {appt.status === 'pending' ? (
                                                    <>
                                                        <button 
                                                            onClick={async () => {
                                                                try {
                                                                    await axios.put(`${API_URL}/appointments/approve`, { appointmentId: appt.id });
                                                                    alert("Appointment Approved!");
                                                                    fetchBarberAppointments();
                                                                } catch(e) { alert("Error approving."); }
                                                            }}
                                                            className="btn btn-success"
                                                            style={{padding: '4px 10px', fontSize: '0.75rem', minHeight: '30px'}}
                                                        >
                                                            ✅ Accept
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRejectAppointment(appt.id)}
                                                            className="btn btn-danger"
                                                            style={{padding: '4px 10px', fontSize: '0.75rem', minHeight: '30px'}}
                                                        >
                                                            ❌ Decline
                                                        </button>
                                                    </>
                                                ) : !appt.is_converted_to_queue ? (
                                                    <button 
                                                        onClick={() => handleRejectAppointment(appt.id)}
                                                        className="btn btn-danger"
                                                        style={{padding: '4px 10px', fontSize: '0.75rem', minHeight: '30px'}}
                                                    >
                                                        ❌ Cancel Appt
                                                    </button>
                                                ) : (
                                                    <span style={{color: 'var(--success-color)', fontWeight:'bold', fontSize:'0.75rem'}}>
                                                        (IN QUEUE)
                                                    </span>
                                                )}
                                            </div>
</li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        
                        <div className="modal-footer single-action">
                            <button onClick={() => setIsApptListOpen(false)} className="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
