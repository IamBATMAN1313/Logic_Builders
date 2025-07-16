import React, { createContext, useContext, useState } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    const notification = {
      id,
      message,
      type,
      duration
    };

    setNotifications(prev => [...prev, notification]);

    // Auto remove after duration (unless it's a confirmation dialog)
    if (type !== 'confirm') {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const showSuccess = (message, duration = 4000) => {
    return addNotification(message, 'success', duration);
  };

  const showError = (message, duration = 6000) => {
    return addNotification(message, 'error', duration);
  };

  const showInfo = (message, duration = 4000) => {
    return addNotification(message, 'info', duration);
  };

  const showWarning = (message, duration = 5000) => {
    return addNotification(message, 'warning', duration);
  };

  const showConfirm = (message, onConfirm, onCancel) => {
    const id = addNotification(message, 'confirm', 0);
    return new Promise((resolve) => {
      // Override the notification with confirm actions
      setNotifications(prev => prev.map(notification => 
        notification.id === id 
          ? {
              ...notification,
              onConfirm: () => {
                removeNotification(id);
                if (onConfirm) onConfirm();
                resolve(true);
              },
              onCancel: () => {
                removeNotification(id);
                if (onCancel) onCancel();
                resolve(false);
              }
            }
          : notification
      ));
    });
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      showSuccess,
      showError,
      showInfo,
      showWarning,
      showConfirm
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
