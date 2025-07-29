import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import '../css/Messaging.css';
import '../css/SpecsFilter.css'; // Import for spec-select class

export default function Messaging() {
  const { showSuccess, showError, showWarning } = useNotification();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationData, setNewConversationData] = useState({
    subject: '',
    type: 'general',
    message_text: ''
  });

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.conversation_id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/messaging/conversations');
      setConversations(response.data);
    } catch (err) {
      setError('Failed to fetch conversations');
      console.error('Conversations fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await api.get(`/messaging/conversations/${conversationId}/messages`);
      setMessages(response.data);
    } catch (err) {
      console.error('Messages fetch error:', err);
      setError('Failed to fetch messages');
    }
  };

  const startNewConversation = async () => {
    try {
      if (!newConversationData.subject || !newConversationData.message_text) {
        showWarning('Please fill in subject and message');
        return;
      }

      const response = await api.post('/messaging/conversations', newConversationData);
      
      if (response.data.success) {
        // Reset form
        setNewConversationData({
          subject: '',
          type: 'general',
          message_text: ''
        });
        setShowNewConversation(false);
        
        // Refresh conversations
        await fetchConversations();
        
        // Select the new conversation if we can find it
        const newConv = conversations.find(c => c.conversation_id === response.data.conversation_id);
        if (newConv) {
          setSelectedConversation(newConv);
        }
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      showError(err.response?.data?.error || 'Failed to start conversation');
    }
  };

  const sendMessage = async () => {
    try {
      if (!newMessage.trim()) return;

      await api.post(`/messaging/conversations/${selectedConversation.conversation_id}/messages`, {
        message_text: newMessage.trim()
      });

      setNewMessage('');
      await fetchMessages(selectedConversation.conversation_id);
      await fetchConversations(); // Refresh to update unread counts
    } catch (err) {
      console.error('Error sending message:', err);
      showError('Failed to send message');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = (now - date) / (1000 * 60 * 60 * 24);

    if (diffInDays < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#ff4444';
      case 'high': return '#ff8800';
      case 'normal': return '#00aa44';
      case 'low': return '#888888';
      default: return '#00aa44';
    }
  };

  if (loading) return <div className="loading">Loading messages...</div>;

  return (
    <div className="messaging-page">
      <div className="messaging-header">
        <h2>Messages & Support</h2>
        <button 
          className="new-conversation-btn"
          onClick={() => setShowNewConversation(true)}
        >
          Start New Conversation
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showNewConversation && (
        <div className="new-conversation-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Start New Conversation</h3>
              <button 
                className="close-btn"
                onClick={() => setShowNewConversation(false)}
              >
                ×
              </button>
            </div>
            
            <div className="conversation-form">
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={newConversationData.subject}
                  onChange={(e) => setNewConversationData({
                    ...newConversationData,
                    subject: e.target.value
                  })}
                  placeholder="What is this about?"
                />
              </div>

              <div className="form-group">
                <label>Type</label>
                <select
                  className="spec-select"
                  value={newConversationData.type}
                  onChange={(e) => setNewConversationData({
                    ...newConversationData,
                    type: e.target.value
                  })}
                >
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="order_inquiry">Order Inquiry</option>
                  <option value="product_inquiry">Product Question</option>
                </select>
              </div>

              <div className="form-group">
                <label>Message</label>
                <textarea
                  value={newConversationData.message_text}
                  onChange={(e) => setNewConversationData({
                    ...newConversationData,
                    message_text: e.target.value
                  })}
                  placeholder="Describe your question or issue..."
                  rows={4}
                />
              </div>

              <div className="form-actions">
                <button 
                  className="submit-btn"
                  onClick={startNewConversation}
                >
                  Start Conversation
                </button>
                <button 
                  className="cancel-btn"
                  onClick={() => setShowNewConversation(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="messaging-container">
        <div className="conversations-sidebar">
          <h3>Conversations</h3>
          {conversations.length === 0 ? (
            <div className="no-conversations">
              <p>No conversations yet</p>
              <p>Start a new conversation to get support</p>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conversation) => (
                <div
                  key={conversation.conversation_id}
                  className={`conversation-item ${
                    selectedConversation?.conversation_id === conversation.conversation_id 
                      ? 'selected' 
                      : ''
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="conversation-header">
                    <div className="conversation-subject">
                      {conversation.subject}
                    </div>
                    <div className="conversation-meta">
                      {conversation.unread_count > 0 && (
                        <span className="unread-badge">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="conversation-preview">
                    <div className="last-message">
                      {conversation.last_message?.substring(0, 50)}
                      {conversation.last_message?.length > 50 ? '...' : ''}
                    </div>
                    <div className="last-message-time">
                      {formatDate(conversation.last_message_at)}
                    </div>
                  </div>
                  
                  <div className="conversation-status">
                    <span className={`status-badge ${conversation.status}`}>
                      {conversation.status}
                    </span>
                    <span className="conversation-type">
                      {conversation.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="messages-area">
          {selectedConversation ? (
            <>
              <div className="conversation-header">
                <div className="conversation-info">
                  <h3>{selectedConversation.subject}</h3>
                  <div className="conversation-details">
                    <span className="type">{selectedConversation.type.replace('_', ' ')}</span>
                    <span 
                      className="priority"
                      style={{ color: getPriorityColor(selectedConversation.priority) }}
                    >
                      {selectedConversation.priority} priority
                    </span>
                    <span className={`status ${selectedConversation.status}`}>
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="messages-list">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.is_system_message ? 'system' : 'user'}`}
                  >
                    <div className="message-header">
                      <span className="sender-name">{message.sender_name}</span>
                      <span className="message-time">
                        {formatDate(message.sent_at)}
                      </span>
                    </div>
                    <div className="message-text">
                      {message.message_text}
                    </div>
                  </div>
                ))}
              </div>

              {selectedConversation.status === 'active' && (
                <div className="message-input-area">
                  <div className="message-input">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message here..."
                      rows={3}
                    />
                    <button 
                      className="send-btn"
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-conversation-selected">
              <div className="no-conversation-content">
                <span className="icon">💬</span>
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the sidebar to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
