import { useEffect, useRef, useState } from "react";
import { IconSend } from "./assets/Icon";

/**
 * ChatWindow Component
 * @param {string} currentUser_id - The ID of the person currently logged in.
 * @param {string} queueId - The ID of the specific queue entry (used for routing messages).
 * @param {Array} messages - Array of message objects from the database.
 * @param {function} onSendMessage - Handler to trigger the backend API call.
 */
export const ChatWindow = ({ currentUser_id, queueId, messages = [], onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Auto-scroll to the bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!newMessage.trim()) return;

        if (onSendMessage) {
            // Ensure we pass the queueId so the backend knows which chat this belongs to
            onSendMessage(queueId, newMessage);
            setNewMessage('');
        } else {
            console.warn("[ChatWindow] Cannot send message, onSendMessage handler is missing.");
        }
    };
    
    return (
        <div className="chat-window">
            <div className="message-list">
                {messages.map((msg, index) => {
                    // FIX: Changed from msg.senderId to msg.sender_id to match Supabase
                    const isMe = msg.sender_id === currentUser_id;
                    
                    return (
                        <div 
                            key={msg.id || index} 
                            className={`message-container ${isMe ? 'my-message-container' : 'other-message-container'}`}
                        >
                            <div 
                                className={`message-bubble ${isMe ? 'my-message' : 'other-message'}`}
                                style={{ 
                                    whiteSpace: 'pre-wrap', 
                                    wordBreak: 'break-word', 
                                    overflowWrap: 'break-word',
                                    maxWidth: '85%', 
                                    padding: '10px 14px', 
                                    borderRadius: '18px', 
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                    lineHeight: '1.4'
                                }}
                            >
                                {msg.message}
                            </div>
                            <span className="message-timestamp">
                                {msg.created_at 
                                    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                                    : ''}
                            </span>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-input-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    autoComplete="off"
                />
                <button 
                    type="submit" 
                    disabled={!onSendMessage || !newMessage.trim()} 
                    className="btn btn-icon btn-send"
                >
                    <IconSend />
                </button>
            </form>
        </div>
    );
};