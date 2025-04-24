import React, { useEffect, useRef, useState } from 'react';

/**
 * ConversationDisplay - A sidebar chat component that appears in front of the avatar
 * @param {Array} conversation - Array of message objects with 'role' and 'message' properties
 * @param {boolean} isChatOpen - Whether the chat is currently open
 * @param {Function} onSendMessage - Function to handle sending new messages
 */
export function ConversationDisplay({ conversation = [], isChatOpen = false, onSendMessage = () => {} }) {
  // State for the input field
  const [inputMessage, setInputMessage] = useState('');
  
  // References for DOM elements
  const messagesEndRef = useRef(null); // Reference to bottom of messages for scrolling
  const messagesContainerRef = useRef(null); // Reference to message container

  // Effect to scroll to the latest message whenever the conversation updates
  useEffect(() => {
    if (messagesEndRef.current && isChatOpen) {
      // Delay to ensure DOM is fully rendered
      setTimeout(() => {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [conversation, isChatOpen]);

  // Don't render anything if chat is closed
  if (!isChatOpen) return null;

  // Handler for sending messages
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      // Check if onSendMessage is a function before calling it
      if (typeof onSendMessage === 'function') {
        onSendMessage({ role: 'user', message: inputMessage });
      } else {
        console.warn('onSendMessage prop is not a function');
      }
      setInputMessage(''); // Clear input after sending
    }
  };

  return (
    <div className="sidebar-conversation" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '355px',
      height: '70vh',
      backgroundColor: 'rgba(12, 32, 67, 0.95)',
      display: isChatOpen ? 'flex' : 'none',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    }}>
      {/* Header section */}
      <div style={{
        padding: '15px',
        borderBottom: '1px solid #1a3056',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        backgroundColor: 'rgba(26, 48, 86, 0.95)',
      }}>
        Chat with Avatar
      </div>
      
      {/* Messages area */}
      <div 
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '15px',
          display: 'flex',
          flexDirection: 'column-reverse',
          backgroundColor: 'rgba(12, 32, 67, 0.95)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div ref={messagesEndRef} />
          
          {conversation.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#e0e0e0', 
              padding: '30px 0', 
              fontSize: '16px',
              marginTop: 'auto',
              opacity: 0.7,
            }}>
              Start a conversation with the avatar
            </div>
          ) : (
            [...conversation].reverse().map((item, index) => (
              <div 
                key={index}
                style={{
                  marginBottom: '12px',
                  padding: '12px 16px',
                  borderRadius: '18px',
                  maxWidth: '85%',
                  wordWrap: 'break-word',
                  backgroundColor: item.role === 'user' ? '#4CAF50' : '#e0e0e0',
                  color: item.role === 'user' ? 'white' : '#333',
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                  animation: 'fadeIn 0.3s ease-in-out',
                }}
              >
                <div style={{ 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  color: item.role === 'user' ? 'rgba(255, 255, 255, 0.8)' : '#666',
                }}>
                  {item.role === 'user' ? 'You' : 'Avatar'}
                </div>
                <div style={{ fontSize: '16px' }}>
                  {item.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Input area */}
      <form 
        onSubmit={handleSendMessage}
        style={{
          borderTop: '1px solid #1a3056',
          padding: '15px',
          backgroundColor: '#0a1835',
          display: 'flex',
        }}
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '20px',
            border: 'none',
            fontSize: '16px',
            backgroundColor: '#1a3056',
            color: 'white',
            outline: 'none',
          }}
        />
        <button 
          type="submit"
          disabled={!inputMessage.trim()}  // Disable if message is empty
          style={{
            marginLeft: '10px',
            backgroundColor: inputMessage.trim() ? '#4CAF50' : '#45a049',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            opacity: inputMessage.trim() ? 1 : 0.7,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  );
}