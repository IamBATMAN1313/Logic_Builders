import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import '../css/Notifications.css';

export default function Notifications() {
  const { showSuccess, showError } = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter === 'unread') params.seen_status = 'false';
      if (filter === 'orders') params.category = 'orders';
      if (filter === 'support') params.category = 'support';
      if (filter === 'promos') params.notification_type = 'promo_available';

      const response = await api.get('/notifications', { params });
      setNotifications(response.data);
    } catch (err) {
      setError('Failed to fetch notifications');
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.unread_count);
    } catch (err) {
      console.error('Unread count fetch error:', err);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, seen_status: true }
          : notification
      ));
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      
      // Update local state
      setNotifications(notifications.map(notification => ({
        ...notification,
        seen_status: true
      })));
      
      setUnreadCount(0);
      showSuccess('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      showError('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      
      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      
      // Update unread count if deleting unread notification
      if (deletedNotification && !deletedNotification.seen_status) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      showError('Failed to delete notification');
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.seen_status) {
      markAsRead(notification.id);
    }
    
    // Navigate to link if exists
    if (notification.link || notification.action_url) {
      const url = notification.link || notification.action_url;
      if (url.startsWith('http')) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now - date) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)} days ago`;
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order_status_update': return '📦';
      case 'qa_answered': return '❓';
      case 'promo_available': return '🎉';
      case 'welcome': return '👋';
      case 'general': return '📢';
      default: return '🔔';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e53e3e';
      case 'high': return '#dd6b20';
      case 'normal': return '#38a169';
      case 'low': return '#718096';
      default: return '#718096';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.seen_status;
    if (filter === 'orders') return notification.category === 'orders';
    if (filter === 'support') return notification.category === 'support';
    if (filter === 'promos') return notification.notification_type === 'promo_available';
    return true;
  });

  if (loading) return <div className="loading">Loading notifications...</div>;

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div className="header-content">
          <h2>Notifications</h2>
          {unreadCount > 0 && (
            <span className="unread-count-badge">
              {unreadCount} unread
            </span>
          )}
        </div>
        
        {notifications.length > 0 && unreadCount > 0 && (
          <button 
            className="mark-all-read-btn"
            onClick={markAllAsRead}
          >
            Mark All as Read
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="notifications-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
        <button 
          className={`filter-btn ${filter === 'orders' ? 'active' : ''}`}
          onClick={() => setFilter('orders')}
        >
          Orders
        </button>
        <button 
          className={`filter-btn ${filter === 'support' ? 'active' : ''}`}
          onClick={() => setFilter('support')}
        >
          Support
        </button>
        <button 
          className={`filter-btn ${filter === 'promos' ? 'active' : ''}`}
          onClick={() => setFilter('promos')}
        >
          Promotions
        </button>
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <div className="no-notifications-content">
              <span className="no-notifications-icon">🔔</span>
              <h3>
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </h3>
              <p>
                {filter === 'unread' 
                  ? 'All caught up! You have no unread notifications.'
                  : 'When you have notifications, they will appear here.'
                }
              </p>
            </div>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${!notification.seen_status ? 'unread' : ''} ${
                notification.link || notification.action_url ? 'clickable' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.notification_type)}
              </div>
              
              <div className="notification-content">
                <div className="notification-header">
                  <div className="notification-meta">
                    <span className="notification-type">
                      {notification.notification_type.replace('_', ' ').toUpperCase()}
                    </span>
                    {notification.priority !== 'normal' && (
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(notification.priority) }}
                      >
                        {notification.priority}
                      </span>
                    )}
                  </div>
                  <div className="notification-actions">
                    <span className="notification-time">
                      {formatDate(notification.created_at)}
                    </span>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Delete notification"
                    >
                      ×
                    </button>
                  </div>
                </div>
                
                <div className="notification-text">
                  {notification.notification_text}
                </div>
                
                {(notification.link || notification.action_url) && (
                  <div className="notification-action">
                    <span className="action-indicator">Click to view →</span>
                  </div>
                )}
                
                {notification.expires_at && (
                  <div className="notification-expiry">
                    Expires: {new Date(notification.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              {!notification.seen_status && (
                <div className="unread-indicator">
                  <div className="unread-dot"></div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
