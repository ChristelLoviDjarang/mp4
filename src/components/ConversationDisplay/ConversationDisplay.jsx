import React, { useEffect, useRef } from 'react';

export function ConversationDisplay({ conversation, isChatOpen }) {
  const messagesEndRef = useRef(null);
  
  // Scroll to bottom whenever new messages are added
  useEffect(() => {
    if (messagesEndRef.current && isChatOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, isChatOpen]);
  
  if (!isChatOpen) return null;
  
  return (
    <div className="conversation-display" style={{
      position: 'absolute',
      bottom: '150px', // Position above chat input
      width: '300px',
      maxHeight: '300px',
      overflowY: 'auto',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '10px',
      padding: '10px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    }}>
      {conversation.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '20px 0' }}>
          Start a conversation by typing or speaking
        </div>
      ) : (
        conversation.map((item, index) => (
          <div 
            key={index}
            style={{
              marginBottom: '10px',
              padding: '8px 12px',
              borderRadius: '18px',
              maxWidth: '85%',
              wordWrap: 'break-word',
              backgroundColor: item.role === 'user' ? '#DCF8C6' : '#ECECEC',
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              marginLeft: item.role === 'user' ? 'auto' : '0',
            }}
          >
            <div style={{ fontSize: '13px', color: '#555' }}>
              {item.role === 'user' ? 'You' : 'Avatar'}:
            </div>
            <div style={{ marginTop: '3px' }}>
              {item.message}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}