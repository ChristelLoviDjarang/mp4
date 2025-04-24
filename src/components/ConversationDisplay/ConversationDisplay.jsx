import React, { useEffect, useRef, useState } from 'react';

/**
 * ConversationDisplay - A sidebar chat component that appears in front of the avatar
 * @param {Array} conversation - Array of message objects with 'role' and 'message' properties
 * @param {boolean} isChatOpen - Whether the chat is currently open
 * @param {Function} onSendMessage - Function to handle sending new messages
 * @param {boolean} isLoading - Whether the chat is currently loading a response
 */
export function ConversationDisplay({ conversation = [], isChatOpen = false, onSendMessage = () => {}, isLoading = false }) {
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
      onSendMessage(inputMessage);
      setInputMessage('');
    }
  };

  return (
    <div className="sidebar-conversation" style={{
      position: 'fixed',
      bottom: '-10px',
      left: '325px',
      width: '355px',
      height: '79vh',
      backgroundColor: '#0c2043',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 999,
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.2)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      {/* Header section */}
      <div style={{
        padding: '15px',
        borderBottom: '1px solid #1a3056',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
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
              marginTop: 'auto' 
            }}>
              Start a conversation with the avatar
            </div>
          ) : (
            [...conversation].reverse().map((item, index) => (
              <div 
                key={index}
                style={{
                  marginBottom: '12px',
                  padding: '10px 14px',
                  borderRadius: '18px',
                  maxWidth: '85%',
                  wordWrap: 'break-word',
                  backgroundColor: item.role === 'user' ? '#4CAF50' : '#e0e0e0',
                  color: item.role === 'user' ? 'white' : '#333',
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  marginLeft: item.role === 'user' ? 'auto' : '0',
                  display: 'block',
                  float: item.role === 'user' ? 'right' : 'left',
                  clear: 'both',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ 
                  fontSize: '14px', 
                  color: item.role === 'user' ? '#e0e0e0' : '#555',
                  marginBottom: '4px'
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
          disabled={isLoading}
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
          disabled={!inputMessage.trim() || isLoading}
          style={{
            marginLeft: '10px',
            backgroundColor: inputMessage.trim() && !isLoading ? '#4CAF50' : '#45a049',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            opacity: inputMessage.trim() && !isLoading ? 1 : 0.7,
          }}
        >
          {isLoading ? (
            <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
