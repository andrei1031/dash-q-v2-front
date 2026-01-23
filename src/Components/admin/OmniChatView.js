/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { API_URL } from "../http-commons";
import { supabase } from "../supabase";
import { playSound } from "../helpers/utils";
import { messageNotificationSound } from "../../App";
import { IconRefresh } from "../assets/Icon";
import axios from "axios";


export const OmniChatView = ({ session }) => {
    const [activeChats, setActiveChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [replyText, setReplyText] = useState("");

    // 1. Fetch list of chats (Initial Load)
    const fetchChats = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/active-chats`);
            setActiveChats(res.data);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchChats(); }, []);

    // 2. Realtime Listener for the SELECTED chat (To see incoming messages while chatting)
    useEffect(() => {
        if (!selectedChat) return;

        console.log(`[Admin] Subscribing to chat #${selectedChat.id}`);
        const channel = supabase.channel(`admin_chat_${selectedChat.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `queue_entry_id=eq.${selectedChat.id}`
                },
                (payload) => {
                    const newMsg = payload.new;
                    // Avoid duplicating my own messages (Admin's reply)
                    if (newMsg.sender_id !== session.user.id) {
                        setMessages(prev => [...prev, {
                            senderId: newMsg.sender_id,
                            message: newMsg.message,
                            created_at: newMsg.created_at
                        }]);
                        playSound(messageNotificationSound); 
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedChat]);

    // 3. Load specific conversation (History) & Mark as Read
    const loadConversation = async (chatEntry) => {
        setSelectedChat(chatEntry);
        
        // A. Mark as Read on Server (Clears the badge for Admin)
        try {
            await axios.put(`${API_URL}/chat/read`, { 
                queueId: chatEntry.id, 
                readerId: session.user.id 
            });
            
            // B. Update Local State (Remove badge immediately)
            setActiveChats(prev => prev.map(c => 
                c.id === chatEntry.id ? { ...c, unread_count: 0 } : c
            ));

        } catch (e) {
            console.error("Failed to mark as read", e);
        }

        // C. Fetch Messages
        try {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('queue_entry_id', chatEntry.id)
                .order('created_at', { ascending: true });
            
            setMessages(data.map(m => ({
                senderId: m.sender_id,
                message: m.message,
                created_at: m.created_at
            })));
        } catch (e) { console.error(e); }
    };
    // 4. Handle Admin Reply
    const handleAdminReply = async (e) => {
        e.preventDefault();
        if(!replyText.trim() || !selectedChat) return;

        // Optimistic Update
        const newMsg = { senderId: session.user.id, message: `[ADMIN]: ${replyText}`, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, newMsg]); 
        
        try {
            await axios.post(`${API_URL}/admin/chat/reply`, {
                adminId: session.user.id,
                queueId: selectedChat.id,
                message: replyText
            });
            setReplyText("");
        } catch(e) { alert("Failed to send."); }
    };

    return (
        <div className="admin-chat-layout" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', minHeight: '70vh' }}>
            {/* LEFT: Chat List */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px', height: '70vh' }}>
                <div className="card-header">
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>💬 Active Chats ({activeChats.length})</h3>
                    <button onClick={fetchChats} className="btn btn-icon"><IconRefresh /></button>
                </div>
                <div className="card-body" style={{ overflowY: 'auto', padding: '10px' }}>
                    {loading && <p style={{padding:'10px', textAlign:'center', color:'var(--text-secondary)'}}>Loading chats...</p>}
                    {activeChats.map(chat => (
                        <div 
                            key={chat.id} 
                            onClick={() => loadConversation(chat)}
                            className={`chat-list-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                            style={{
                                padding: '12px', 
                                borderBottom: '1px solid var(--border-color)', 
                                cursor: 'pointer',
                                background: selectedChat?.id === chat.id ? 'var(--bg-dark)' : 'transparent',
                                borderLeft: selectedChat?.id === chat.id ? '3px solid var(--primary-orange)' : '3px solid transparent'
                            }}
                        >
                            {/* --- UNREAD BADGE LOGIC HERE --- */}
                            <div style={{ fontWeight: 'bold', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span>{chat.customer_name}</span>
                                {chat.unread_count > 0 && (
                                    <span className="notification-badge" style={{position:'static', marginLeft:'10px'}}>
                                        {chat.unread_count}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                w/ {chat.barber_profiles?.full_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                Status: <span style={{ color: 'var(--primary-orange)' }}>{chat.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Conversation */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: '2 1 400px', height: '70vh' }}>
                {selectedChat ? (
                    <>
                        <div className="card-header">
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedChat.customer_name}</h3>
                                <small style={{ color: 'var(--text-secondary)' }}>Queue ID: #{selectedChat.id}</small>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '15px', background: 'var(--bg-dark)' }}>
                            {messages.map((msg, idx) => {
                                const isAdminMsg = msg.message.startsWith('[ADMIN]');
                                const isCustomer = msg.senderId === selectedChat.user_id;
                                
                                return (
                                    <div key={idx} style={{
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        alignItems: isCustomer ? 'flex-start' : 'flex-end',
                                        marginBottom: '10px'
                                    }}>
                                        <div style={{
                                            maxWidth: '70%',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            background: isAdminMsg ? '#ff3b30' : (isCustomer ? '#333' : 'var(--primary-orange)'),
                                            color: isAdminMsg ? 'white' : (isCustomer ? 'white' : 'black'),
                                            fontSize: '0.9rem'
                                        }}>
                                            {msg.message}
                                        </div>
                                        <span style={{fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', padding: '0 4px'}}>
                                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                        <form onSubmit={handleAdminReply} style={{ padding: '10px', background: 'var(--surface-color)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
                            <input 
                                value={replyText} 
                                onChange={e => setReplyText(e.target.value)} 
                                placeholder="Reply as Admin..." 
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white' }}
                            />
                            <button type="submit" className="btn btn-primary">Send</button>
                        </form>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                        Select a chat to view messages
                    </div>
                )}
            </div>
        </div>
    );
}
