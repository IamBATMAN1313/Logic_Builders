import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import './NotificationContainer.css';

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification--${notification.type}`}
        >
          <div className="notification-content">
            <div className="notification-icon">
              {notification.type === 'success' && '✅'}
              {notification.type === 'error' && '❌'}
              {notification.type === 'warning' && '⚠️'}
              {notification.type === 'info' && 'ℹ️'}
              {notification.type === 'confirm' && '❓'}
            </div>
            <div className="notification-message">
              {notification.message}
            </div>
            {notification.type === 'confirm' ? (
              <div className="notification-actions">
                <button
                  className="notification-btn notification-btn--confirm"
                  onClick={notification.onConfirm}
                >
                  Yes
                </button>
                <button
                  className="notification-btn notification-btn--cancel"
                  onClick={notification.onCancel}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                className="notification-close"
                onClick={() => removeNotification(notification.id)}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
