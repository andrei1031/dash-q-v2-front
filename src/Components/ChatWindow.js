import { useEffect, useRef, useState } from "react";
import { IconSend } from "./assets/Icon";

export const ChatWindow = ({ currentUser_id, otherUser_id, messages = [], onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && onSendMessage) {
            onSendMessage(otherUser_id, newMessage);
            setNewMessage('');
        }
    };
    
    return (
        <div className="chat-window">
            <div className="message-list">
                {messages.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>No messages yet.</p>
                ) : (
                    messages.map((msg, index) => {
                    // 🟢 ROBUST FIX: Check both senderId and sender_id
                    const msgSenderId = msg.senderId || msg.sender_id;
                    const isMe = (msg.senderId || msg.sender_id) === currentUser_id;
                    
                    return (
                        <div key={index} className={`message-container ${isMe ? 'my-message-container' : 'other-message-container'}`}>
                            <div className={`message-bubble ${isMe ? 'my-message' : 'other-message'}`}>
                                {msg.message}
                            </div>
                            {/* ... */}
                        </div>
                    );
                })
                )}
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
                <button type="submit" disabled={!onSendMessage || !newMessage.trim()} className="btn btn-icon btn-send">
                    <IconSend />
                </button>
            </form>
        </div>
    );
};