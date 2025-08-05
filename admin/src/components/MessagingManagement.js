import React, { useState, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/MessagingManagement.css';

const MessagingManagement = () => {
  const { showSuccess, showError } = useNotification();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/messaging/admin/conversations?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch conversations');
      
      const data = await response.json();
      setConversations(data);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/messaging/admin/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch(`/api/messaging/admin/conversation/${selectedConversation.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          message_text: newMessage
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      setNewMessage('');
      fetchMessages(selectedConversation.id);
      fetchConversations(); // Refresh to update last message
      showSuccess('Message sent successfully');
    } catch (err) {
      showError('Failed to send message');
      console.error('Error sending message:', err);
    }
  };

  const updateConversationStatus = async (conversationId, status) => {
    try {
      const response = await fetch(`/api/messaging/admin/conversation/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update status');

      fetchConversations();
      showSuccess('Conversation status updated successfully');
    } catch (err) {
      showError('Failed to update conversation status');
      console.error('Error updating status:', err);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await fetch(`/api/messaging/admin/read/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      fetchConversations();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
    if (conversation.unread_count > 0) {
      markAsRead(conversation.id);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#d69e2e';
      case 'active': return '#38a169';
      case 'resolved': return '#3182ce';
      case 'closed': return '#718096';
      default: return '#718096';
    }
  };

  if (loading) return <div className="loading">Loading conversations...</div>;

  return (
    <div className="messaging-management">
      <div className="messaging-header">
        <h1>Customer Messages</h1>
        <div className="filter-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Conversations</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="messaging-content">
        <div className="conversations-panel">
          <h3>Conversations</h3>
          {conversations.length === 0 ? (
            <div className="no-conversations">
              <p>Customer messaging system is being set up.</p>
              <p>This feature will be available soon.</p>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map(conversation => (
                <div 
                  key={conversation.id} 
                  className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''} ${conversation.unread_count > 0 ? 'unread' : ''}`}
                  onClick={() => selectConversation(conversation)}
                >
                  <div className="conversation-header">
                    <span className="customer-name">{conversation.customer_name}</span>
                    {conversation.unread_count > 0 && (
                      <span className="unread-badge">{conversation.unread_count}</span>
                    )}
                  </div>
                  <div className="conversation-meta">
                    <span className="subject">{conversation.subject}</span>
                  </div>
                  <div className="conversation-preview">
                    {conversation.last_message}
                  </div>
                  <div className="conversation-footer">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(conversation.status) }}
                    >
                      {conversation.status}
                    </span>
                    <span className="timestamp">
                      {new Date(conversation.last_updated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="messages-panel">
          {selectedConversation ? (
            <>
              <div className="conversation-details">
                <div className="conversation-title">
                  <h3>{selectedConversation.subject}</h3>
                  <div className="conversation-actions">
                    <select
                      value={selectedConversation.status}
                      onChange={(e) => updateConversationStatus(selectedConversation.id, e.target.value)}
                      className="status-select"
                    >
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
                <div className="customer-info">
                  <span><strong>Customer:</strong> {selectedConversation.customer_name}</span>
                  <span><strong>Email:</strong> {selectedConversation.customer_email}</span>
                </div>
              </div>

              <div className="messages-container">
                {messages.map(message => (
                  <div 
                    key={message.id} 
                    className={`message ${message.sender_type === 'admin' ? 'admin-message' : 'customer-message'}`}
                  >
                    <div className="message-header">
                      <span className="sender">{message.sender_name}</span>
                      <span className="timestamp">
                        {new Date(message.sent_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="message-content">
                      {message.message_text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="message-input">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="message-textarea"
                />
                <button 
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="send-btn"
                >
                  Send Reply
                </button>
              </div>
            </>
          ) : (
            <div className="no-selection">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingManagement;
