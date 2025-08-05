import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import '../css/Vouchers.css';
import '../css/SpecsFilter.css'; // Import for spec-select class

export default function Vouchers() {
  const { showSuccess, showError } = useNotification();
  const [vouchers, setVouchers] = useState([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redeemAmount, setRedeemAmount] = useState(100);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  useEffect(() => {
    fetchVouchersAndPoints();
  }, []);

  const fetchVouchersAndPoints = async () => {
    try {
      setLoading(true);
      const response = await api.get('/account/vouchers');
      setVouchers(response.data.vouchers || []);
      setPoints(response.data.points || 0);
    } catch (err) {
      setError('Failed to fetch vouchers and points');
      console.error('Vouchers fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const redeemPoints = async () => {
    if (redeemAmount > points) {
      showError('Not enough points available');
      return;
    }

    if (redeemAmount % 100 !== 0) {
      showError('Points must be redeemed in multiples of 100');
      return;
    }

    try {
      setIsRedeeming(true);
      const response = await api.post('/account/redeem-points', {
        points: redeemAmount
      });
      
      // Update points and vouchers
      await fetchVouchersAndPoints();
      
      const couponsGenerated = Math.floor(redeemAmount / 100);
      showSuccess(`Successfully redeemed ${redeemAmount} points! ${couponsGenerated} new coupon(s) have been generated and sent to your notifications.`);
      
      setShowRedeemModal(false);
      setRedeemAmount(100);
    } catch (err) {
      console.error('Redeem points error:', err);
      showError(err.response?.data?.message || 'Failed to redeem points');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSliderChange = (e) => {
    const value = parseInt(e.target.value);
    setRedeemAmount(value);
  };

  const getMaxRedeemablePoints = () => {
    return Math.floor(points / 100) * 100;
  };

  const getCouponsToGenerate = () => {
    return Math.floor(redeemAmount / 100);
  };

  const getVoucherStatusColor = (status) => {
    switch (status) {
      case 'active': return '#28a745';
      case 'used': return '#6c757d';
      case 'expired': return '#dc3545';
      default: return '#ffc107';
    }
  };

  // Commented out for future use
  // const getPointsForAmount = (amount) => {
  //   // 1 point for every $1 spent
  //   return Math.floor(amount);
  // };

  if (loading) return <div className="loading">Loading vouchers and points...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="vouchers-page">
      <div className="page-header">
        <h2>Vouchers & Points</h2>
        <p>Manage your rewards and discount vouchers</p>
      </div>

      <div className="points-section">
        <div className="points-card">
          <div className="points-header">
            <span className="points-icon">🎯</span>
            <div className="points-info">
              <h3>Your Points</h3>
              <p className="points-balance">{points.toLocaleString()} points</p>
            </div>
          </div>
          
          <div className="points-actions">
            <button 
              className="redeem-points-btn"
              onClick={() => setShowRedeemModal(true)}
              disabled={points < 100}
            >
              Redeem Points
            </button>
            <button className="points-history-btn">View History</button>
          </div>

          <div className="points-info-section">
            <h4>How to earn points:</h4>
            <ul>
              <li>Earn 1 point for every $1 spent</li>
              <li>Write product reviews (50 points)</li>
              <li>Refer friends (100 points)</li>
              <li>Birthday bonus (200 points)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="vouchers-section">
        <h3>Your Vouchers</h3>
        
        {vouchers.length === 0 ? (
          <div className="no-vouchers">
            <div className="no-vouchers-content">
              <span className="no-vouchers-icon">🎫</span>
              <h4>No vouchers yet</h4>
              <p>Vouchers will appear here when you earn or receive them.</p>
            </div>
          </div>
        ) : (
          <div className="vouchers-grid">
            {vouchers.map((voucher) => (
              <div key={voucher.id} className="voucher-card">
                <div className="voucher-header">
                  <div className="voucher-type">
                    <span className="voucher-icon">🎫</span>
                    <span className="voucher-label">{voucher.type}</span>
                  </div>
                  <span 
                    className="voucher-status"
                    style={{ backgroundColor: getVoucherStatusColor(voucher.status) }}
                  >
                    {voucher.status}
                  </span>
                </div>

                <div className="voucher-content">
                  <div className="voucher-value">
                    {voucher.discount_type === 'percentage' 
                      ? `${voucher.value}% OFF`
                      : `$${voucher.value} OFF`
                    }
                  </div>
                  
                  <div className="voucher-title">
                    <h4>{voucher.title}</h4>
                    <p>{voucher.description}</p>
                  </div>

                  <div className="voucher-details">
                    <div className="voucher-code">
                      Code: <strong>{voucher.code}</strong>
                    </div>
                    
                    {voucher.min_order_amount && (
                      <div className="minimum-amount">
                        Minimum spend: ${voucher.min_order_amount}
                      </div>
                    )}
                    
                    <div className="voucher-expiry">
                      {voucher.status === 'expired' 
                        ? `Expired on ${new Date(voucher.expires_at).toLocaleDateString()}`
                        : `Expires on ${new Date(voucher.expires_at).toLocaleDateString()}`
                      }
                    </div>
                  </div>
                </div>

                <div className="voucher-actions">
                  {voucher.status === 'active' ? (
                    <div className="voucher-code-display">
                      <span className="code-label">Code:</span>
                      <span className="voucher-code">{voucher.code}</span>
                      <button 
                        className="copy-code-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(voucher.code);
                          showSuccess('Coupon code copied to clipboard!');
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  ) : voucher.status === 'used' ? (
                    <span className="used-label">Used</span>
                  ) : (
                    <span className="expired-label">Expired</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Points Redemption Modal */}
      {showRedeemModal && (
        <div className="redeem-modal-overlay" onClick={() => setShowRedeemModal(false)}>
          <div className="redeem-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Redeem Points</h3>
              <button 
                className="close-modal"
                onClick={() => setShowRedeemModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="points-summary">
                <div className="available-points">
                  <span className="label">Available Points:</span>
                  <span className="value">{points.toLocaleString()}</span>
                </div>
                <div className="redeemable-points">
                  <span className="label">Max Redeemable:</span>
                  <span className="value">{getMaxRedeemablePoints().toLocaleString()}</span>
                </div>
              </div>

              <div className="redeem-slider-section">
                <label htmlFor="redeem-slider">
                  Points to Redeem: <strong>{redeemAmount.toLocaleString()}</strong>
                </label>
                <input
                  id="redeem-slider"
                  type="range"
                  min="100"
                  max={getMaxRedeemablePoints()}
                  step="100"
                  value={redeemAmount}
                  onChange={handleSliderChange}
                  className="redeem-slider"
                  disabled={getMaxRedeemablePoints() < 100}
                />
                <div className="slider-labels">
                  <span>100</span>
                  <span>{getMaxRedeemablePoints().toLocaleString()}</span>
                </div>
              </div>

              <div className="redemption-preview">
                <div className="coupons-info">
                  <div className="coupon-preview">
                    <span className="coupon-icon">🎫</span>
                    <div className="coupon-details">
                      <strong>{getCouponsToGenerate()} Coupon(s)</strong>
                      <p>You will receive {getCouponsToGenerate()} discount coupon(s)</p>
                    </div>
                  </div>
                  
                  <div className="redemption-details">
                    <div className="detail-row">
                      <span>Points to redeem:</span>
                      <span>{redeemAmount.toLocaleString()}</span>
                    </div>
                    <div className="detail-row">
                      <span>Coupons generated:</span>
                      <span>{getCouponsToGenerate()}</span>
                    </div>
                    <div className="detail-row">
                      <span>Remaining points:</span>
                      <span>{(points - redeemAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowRedeemModal(false)}
                  disabled={isRedeeming}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-redeem-btn"
                  onClick={redeemPoints}
                  disabled={isRedeeming || redeemAmount > points || redeemAmount < 100}
                >
                  {isRedeeming ? 'Redeeming...' : `Redeem ${redeemAmount} Points`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
