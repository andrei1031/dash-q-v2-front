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
        } else {
            console.warn("[ChatWindow] Cannot send message, handler missing or message empty.");
        }
    };
    
    return (
        <div className="chat-window">
            <div className="message-list">
                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser_id;
                    return (
                        <div key={index} className={`message-container ${isMe ? 'my-message-container' : 'other-message-container'}`}>
                            <div 
                                className={`message-bubble ${isMe ? 'my-message' : 'other-message'}`}
                                style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', maxWidth: '85%', padding: '10px 14px', borderRadius: '18px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                            >
                                {msg.message}
                            </div>
                            <span className="message-timestamp">
                                {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
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
                />
                <button type="submit" disabled={!onSendMessage || !newMessage.trim()} className="btn btn-icon btn-send">
                    <IconSend />
                </button>
            </form>
        </div>
    )
}
