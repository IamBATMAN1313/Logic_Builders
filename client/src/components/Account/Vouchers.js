import React, { useState, useEffect } from 'react';
import api from '../../api';
import '../css/Vouchers.css';

export default function Vouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const redeemVoucher = async (voucherId) => {
    try {
      await api.post(`/vouchers/${voucherId}/redeem`);
      // Refresh the data
      fetchVouchersAndPoints();
    } catch (err) {
      console.error('Redeem voucher error:', err);
      alert('Failed to redeem voucher');
    }
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
            <button className="redeem-points-btn">Redeem Points</button>
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
                      ? `${voucher.discount_value}% OFF`
                      : `$${voucher.discount_value} OFF`
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
                    
                    {voucher.minimum_amount && (
                      <div className="minimum-amount">
                        Minimum spend: ${voucher.minimum_amount}
                      </div>
                    )}
                    
                    <div className="voucher-expiry">
                      {voucher.status === 'expired' 
                        ? `Expired on ${new Date(voucher.expiry_date).toLocaleDateString()}`
                        : `Expires on ${new Date(voucher.expiry_date).toLocaleDateString()}`
                      }
                    </div>
                  </div>
                </div>

                <div className="voucher-actions">
                  {voucher.status === 'active' ? (
                    <button 
                      className="use-voucher-btn"
                      onClick={() => redeemVoucher(voucher.id)}
                    >
                      Use Now
                    </button>
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

      <div className="rewards-program">
        <div className="rewards-card">
          <h3>Rewards Program</h3>
          <div className="rewards-tiers">
            <div className="tier bronze">
              <div className="tier-name">Bronze</div>
              <div className="tier-requirement">0 - 999 points</div>
              <div className="tier-benefits">Standard rewards</div>
            </div>
            <div className="tier silver">
              <div className="tier-name">Silver</div>
              <div className="tier-requirement">1,000 - 4,999 points</div>
              <div className="tier-benefits">5% bonus points</div>
            </div>
            <div className="tier gold">
              <div className="tier-name">Gold</div>
              <div className="tier-requirement">5,000+ points</div>
              <div className="tier-benefits">10% bonus points + exclusive offers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
